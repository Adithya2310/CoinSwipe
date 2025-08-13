/**
 * WebSocket Handler for CoinSwipe Real-time Price Updates
 * 
 * Architecture Overview:
 * 1. User gets a coin in swipe page → subscribes to token price updates
 * 2. Server emits updated price every 2 seconds ONLY for subscribed tokens
 * 3. When user swipes → old subscription closed, new subscription opened
 * 
 * Key Features:
 * - Per-token subscription management
 * - Automatic cleanup of unused subscriptions
 * - Real-time price updates (2-second intervals)
 * - Memory efficient (only fetch prices for active subscriptions)
 * - Connection rate limiting and error handling
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { PriceSubscriptionManager } from './subscriptionManager';
import { validatePairAddress } from '../utils/validation';

/**
 * Interface for client subscription events
 */
interface ClientToServerEvents {
  subscribe: (pairAddress: string) => void;
  unsubscribe: (pairAddress: string) => void;
}

/**
 * Interface for server emission events
 */
interface ServerToClientEvents {
  connected: (data: { message: string; timestamp: number }) => void;
  subscribed: (data: { pairAddress: string; message: string; timestamp: number }) => void;
  unsubscribed: (data: { pairAddress: string; timestamp: number }) => void;
  priceUpdate: (data: PriceUpdateEvent) => void;
  error: (message: string) => void;
}

/**
 * Price update event structure
 */
interface PriceUpdateEvent {
  pairAddress: string;
  priceUsd: string;
  priceChange24h: number;
  timestamp: number;
  change: 'increase' | 'decrease' | 'unchanged';
}

/**
 * Connection tracking for rate limiting
 */
const connectionTracker = new Map<string, {
  count: number;
  lastConnection: number;
  subscriptions: Set<string>;
}>();

/**
 * Global subscription manager instance
 * Handles all price subscriptions and updates across all clients
 */
const subscriptionManager = new PriceSubscriptionManager();

/**
 * Initialize WebSocket Server with Event Handlers
 * 
 * Sets up all WebSocket event listeners and manages the
 * real-time price subscription system
 * 
 * @param io - Socket.IO server instance
 */
export function initializeWebSocket(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>) {
  logger.info('🔌 Initializing WebSocket server...');

  /**
   * Handle new client connections
   */
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const clientIP = socket.handshake.address;
    const clientId = socket.id;
    
    logger.info(`📱 Client connected: ${clientId} from ${clientIP}`);

    // Rate limiting: Track connections per IP
    if (!enforceRateLimit(clientIP, socket)) {
      return; // Connection rejected due to rate limiting
    }

    // Initialize client tracking
    initializeClientTracking(clientIP, clientId);

    // Send connection confirmation to client
    socket.emit('connected', {
      message: 'Connected to CoinSwipe real-time price service',
      timestamp: Date.now()
    });

    /**
     * Handle Token Subscription
     * 
     * When a user gets a coin in the swipe page, this event is triggered.
     * The server will start emitting price updates for this specific token.
     * 
     * Flow:
     * 1. Validate the pair address
     * 2. Add client to subscription for this token
     * 3. Start price updates if this is the first subscriber
     * 4. Send confirmation to client
     */
    socket.on('subscribe', async (pairAddress: string) => {
      try {
        logger.info(`📊 Client ${clientId} subscribing to ${pairAddress}`);

        // Validate pair address format
        if (!validatePairAddress(pairAddress)) {
          socket.emit('error', 'Invalid pair address format');
          logger.warn(`❌ Invalid pair address from client ${clientId}: ${pairAddress}`);
          return;
        }

        // Check subscription limits per client
        const clientTracker = connectionTracker.get(clientIP);
        if (clientTracker && clientTracker.subscriptions.size >= 5) {
          socket.emit('error', 'Maximum subscriptions per client exceeded (5)');
          logger.warn(`❌ Client ${clientId} exceeded subscription limit`);
          return;
        }

        // Add client to subscription
        const isNewSubscription = await subscriptionManager.addSubscription(
          pairAddress, 
          clientId,
          (priceUpdate: PriceUpdateEvent) => {
            // Emit price update to this specific client
            socket.emit('priceUpdate', priceUpdate);
          }
        );

        // Track subscription for this client
        if (clientTracker) {
          clientTracker.subscriptions.add(pairAddress);
        }

        // Send confirmation to client
        socket.emit('subscribed', {
          pairAddress,
          message: `Successfully subscribed to price updates for ${pairAddress}`,
          timestamp: Date.now()
        });

        logger.info(`✅ Client ${clientId} subscribed to ${pairAddress} (new: ${isNewSubscription})`);

      } catch (error) {
        logger.error(`❌ Subscription error for client ${clientId}:`, error);
        socket.emit('error', 'Failed to subscribe to token price updates');
      }
    });

    /**
     * Handle Token Unsubscription
     * 
     * When a user swipes to a new token, the old subscription should be closed.
     * This event cleans up the old subscription and stops price updates if
     * no other clients are subscribed to this token.
     * 
     * Flow:
     * 1. Remove client from subscription
     * 2. Stop price updates if no more subscribers
     * 3. Send confirmation to client
     */
    socket.on('unsubscribe', async (pairAddress: string) => {
      try {
        logger.info(`📊 Client ${clientId} unsubscribing from ${pairAddress}`);

        // Remove client from subscription
        const hasRemainingSubscribers = await subscriptionManager.removeSubscription(
          pairAddress,
          clientId
        );

        // Remove from client tracking
        const clientTracker = connectionTracker.get(clientIP);
        if (clientTracker) {
          clientTracker.subscriptions.delete(pairAddress);
        }

        // Send confirmation to client
        socket.emit('unsubscribed', {
          pairAddress,
          timestamp: Date.now()
        });

        logger.info(`✅ Client ${clientId} unsubscribed from ${pairAddress} (remaining: ${hasRemainingSubscribers})`);

      } catch (error) {
        logger.error(`❌ Unsubscription error for client ${clientId}:`, error);
        socket.emit('error', 'Failed to unsubscribe from token price updates');
      }
    });

    /**
     * Handle Client Disconnection
     * 
     * When a client disconnects (closes browser, network issues, etc.),
     * we need to clean up all their subscriptions to prevent memory leaks
     * and unnecessary API calls.
     * 
     * Flow:
     * 1. Get all subscriptions for this client
     * 2. Remove client from all subscriptions
     * 3. Stop price updates for tokens with no remaining subscribers
     * 4. Clean up connection tracking
     */
    socket.on('disconnect', async (reason: string) => {
      logger.info(`📱 Client disconnected: ${clientId} (reason: ${reason})`);

      try {
        // Get client's subscriptions
        const clientTracker = connectionTracker.get(clientIP);
        const subscriptions = clientTracker?.subscriptions || new Set();

        // Remove client from all subscriptions
        for (const pairAddress of subscriptions) {
          await subscriptionManager.removeSubscription(pairAddress, clientId);
          logger.debug(`🧹 Cleaned up subscription ${pairAddress} for disconnected client ${clientId}`);
        }

        // Clean up connection tracking
        cleanupClientTracking(clientIP, clientId);

        logger.info(`✅ Cleaned up ${subscriptions.size} subscriptions for client ${clientId}`);

      } catch (error) {
        logger.error(`❌ Error cleaning up client ${clientId}:`, error);
      }
    });

    /**
     * Handle Socket Errors
     * 
     * Log and handle any socket-level errors to prevent
     * server crashes and maintain stability
     */
    socket.on('error', (error: Error) => {
      logger.error(`❌ Socket error for client ${clientId}:`, error);
    });
  });

  // Log WebSocket server initialization
  logger.info('✅ WebSocket server initialized successfully');
  logger.info('📡 Ready to handle real-time price subscriptions');
}

/**
 * Enforce Rate Limiting per IP Address
 * 
 * Prevents abuse by limiting the number of connections
 * from a single IP address
 * 
 * @param clientIP - Client's IP address
 * @param socket - Socket connection to potentially reject
 * @returns true if connection is allowed, false if rejected
 */
function enforceRateLimit(clientIP: string, socket: Socket): boolean {
  const MAX_CONNECTIONS_PER_IP = parseInt(process.env.MAX_CONNECTIONS_PER_IP || '10');
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  
  const now = Date.now();
  const tracker = connectionTracker.get(clientIP);

  if (tracker) {
    // Check if within rate limit window
    if (now - tracker.lastConnection < RATE_LIMIT_WINDOW) {
      if (tracker.count >= MAX_CONNECTIONS_PER_IP) {
        logger.warn(`❌ Rate limit exceeded for IP ${clientIP} (${tracker.count} connections)`);
        socket.emit('error', 'Too many connections from this IP address');
        socket.disconnect(true);
        return false;
      }
    } else {
      // Reset counter after rate limit window
      tracker.count = 0;
      tracker.lastConnection = now;
    }
  }

  return true;
}

/**
 * Initialize Client Connection Tracking
 * 
 * Set up tracking for a new client connection
 * to monitor subscriptions and enforce limits
 * 
 * @param clientIP - Client's IP address
 * @param clientId - Socket ID for this client
 */
function initializeClientTracking(clientIP: string, clientId: string): void {
  const tracker = connectionTracker.get(clientIP);
  
  if (tracker) {
    tracker.count++;
    tracker.lastConnection = Date.now();
  } else {
    connectionTracker.set(clientIP, {
      count: 1,
      lastConnection: Date.now(),
      subscriptions: new Set()
    });
  }

  logger.debug(`📊 Client tracking initialized for ${clientId} (IP: ${clientIP})`);
}

/**
 * Clean Up Client Connection Tracking
 * 
 * Remove tracking information when a client disconnects
 * to free up memory and reset rate limiting
 * 
 * @param clientIP - Client's IP address
 * @param clientId - Socket ID for this client
 */
function cleanupClientTracking(clientIP: string, clientId: string): void {
  const tracker = connectionTracker.get(clientIP);
  
  if (tracker) {
    tracker.count = Math.max(0, tracker.count - 1);
    
    // Remove IP tracking if no more connections
    if (tracker.count === 0) {
      connectionTracker.delete(clientIP);
      logger.debug(`🧹 Removed IP tracking for ${clientIP}`);
    }
  }

  logger.debug(`📊 Client tracking cleaned up for ${clientId} (IP: ${clientIP})`);
}

/**
 * Get Current WebSocket Statistics
 * 
 * Returns current statistics about WebSocket connections
 * and subscriptions for monitoring and debugging
 * 
 * @returns Object containing current statistics
 */
export function getWebSocketStats() {
  return {
    totalConnections: Array.from(connectionTracker.values())
      .reduce((sum, tracker) => sum + tracker.count, 0),
    uniqueIPs: connectionTracker.size,
    activeSubscriptions: subscriptionManager.getActiveSubscriptionsCount(),
    subscriptionDetails: subscriptionManager.getSubscriptionStats()
  };
}
