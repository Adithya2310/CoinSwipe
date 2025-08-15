/**
 * Price Subscription Manager for CoinSwipe
 * 
 * Manages real-time price subscriptions for cryptocurrency tokens.
 * Implements the core WebSocket architecture:
 * 
 * 1. Maintains a map of token subscriptions
 * 2. Fetches prices every 2 seconds ONLY for subscribed tokens
 * 3. Automatically starts/stops price updates based on subscription count
 * 4. Emits price updates only when prices actually change
 * 5. Cleans up unused subscriptions to optimize memory and API usage
 */

import { logger } from '../utils/logger';
import { fetchTokenPrice } from '../services/dexScreenerApi';

/**
 * Price update event structure sent to clients
 */
export interface PriceUpdateEvent {
  pairAddress: string;
  priceUsd: string;
  priceChange24h: number;
  timestamp: number;
  change: 'increase' | 'decrease' | 'unchanged';
}

/**
 * Callback function type for price update notifications
 */
type PriceUpdateCallback = (priceUpdate: PriceUpdateEvent) => void;

/**
 * Subscription information for a single token
 */
interface TokenSubscription {
  pairAddress: string;
  clients: Map<string, PriceUpdateCallback>; // clientId -> callback function
  lastPrice: string | null;                 // Last known price for change detection
  updateInterval: NodeJS.Timeout | null;    // Timer for price updates
  lastFetch: number;                         // Timestamp of last price fetch
  fetchCount: number;                        // Total number of price fetches
  errorCount: number;                        // Number of consecutive fetch errors
}

/**
 * Price Subscription Manager Class
 * 
 * Centrally manages all price subscriptions and updates.
 * Ensures efficient API usage by only fetching prices for
 * tokens that have active subscribers.
 */
export class PriceSubscriptionManager {
  /**
   * Map of token subscriptions
   * Key: pairAddress (token contract address)
   * Value: TokenSubscription object with client callbacks and update timer
   */
  private subscriptions = new Map<string, TokenSubscription>();

  /**
   * Price update interval in milliseconds
   * Can be configured via environment variable
   */
  private readonly UPDATE_INTERVAL = parseInt(
    process.env.WEBSOCKET_UPDATE_INTERVAL || '2000'
  ); // Default: 2 seconds

  /**
   * Maximum number of consecutive errors before stopping updates
   */
  private readonly MAX_ERROR_COUNT = 5;

  constructor() {
    logger.info(`📊 Price Subscription Manager initialized (update interval: ${this.UPDATE_INTERVAL}ms)`);
  }

  /**
   * Add a Client Subscription to a Token
   * 
   * When a user swipes to a new token, this method is called to
   * subscribe them to real-time price updates for that token.
   * 
   * @param pairAddress - Token pair address (e.g., "0x1234...")
   * @param clientId - Unique client identifier (socket ID)
   * @param callback - Function to call when price updates
   * @returns Promise<boolean> - true if this is a new subscription, false if existing
   */
  async addSubscription(
    pairAddress: string,
    clientId: string,
    callback: PriceUpdateCallback
  ): Promise<boolean> {
    logger.debug(`📈 Adding subscription: ${clientId} → ${pairAddress}`);

    let subscription = this.subscriptions.get(pairAddress);
    let isNewSubscription = false;

    if (!subscription) {
      // Create new subscription for this token
      subscription = {
        pairAddress,
        clients: new Map(),
        lastPrice: null,
        updateInterval: null,
        lastFetch: 0,
        fetchCount: 0,
        errorCount: 0
      };

      this.subscriptions.set(pairAddress, subscription);
      isNewSubscription = true;

      logger.info(`🆕 Created new subscription for token ${pairAddress}`);
    }

    // Add client to this subscription
    subscription.clients.set(clientId, callback);

    // Start price updates if this is the first subscriber
    if (subscription.clients.size === 1 && !subscription.updateInterval) {
      this.startPriceUpdates(subscription);
      logger.info(`🚀 Started price updates for ${pairAddress} (first subscriber: ${clientId})`);
    }

    logger.debug(`✅ Client ${clientId} subscribed to ${pairAddress} (total clients: ${subscription.clients.size})`);

    return isNewSubscription;
  }

  /**
   * Remove a Client Subscription from a Token
   * 
   * When a user swipes away from a token, this method is called to
   * unsubscribe them from price updates. If no other clients are
   * subscribed to this token, price updates are stopped.
   * 
   * @param pairAddress - Token pair address
   * @param clientId - Client identifier to remove
   * @returns Promise<boolean> - true if other subscribers remain, false if none
   */
  async removeSubscription(pairAddress: string, clientId: string): Promise<boolean> {
    logger.debug(`📉 Removing subscription: ${clientId} ← ${pairAddress}`);

    const subscription = this.subscriptions.get(pairAddress);
    if (!subscription) {
      logger.warn(`⚠️  Attempted to remove subscription for non-existent token: ${pairAddress}`);
      return false;
    }

    // Remove client from subscription
    const wasSubscribed = subscription.clients.delete(clientId);
    if (!wasSubscribed) {
      logger.warn(`⚠️  Client ${clientId} was not subscribed to ${pairAddress}`);
    }

    const remainingClients = subscription.clients.size;

    // Stop price updates if no more subscribers
    if (remainingClients === 0) {
      this.stopPriceUpdates(subscription);
      this.subscriptions.delete(pairAddress);
      
      logger.info(`🛑 Stopped price updates for ${pairAddress} (no remaining subscribers)`);
      return false;
    }

    logger.debug(`✅ Client ${clientId} unsubscribed from ${pairAddress} (remaining clients: ${remainingClients})`);
    return true;
  }

  /**
   * Start Real-time Price Updates for a Token
   * 
   * Begins fetching price data every 2 seconds for the specified token.
   * Only emits updates when the price actually changes to reduce
   * unnecessary network traffic.
   * 
   * @param subscription - Token subscription to start updates for
   */
  private startPriceUpdates(subscription: TokenSubscription): void {
    const { pairAddress } = subscription;

    // Clear any existing interval (safety check)
    if (subscription.updateInterval) {
      clearInterval(subscription.updateInterval);
    }

    // Create new update interval
    subscription.updateInterval = setInterval(async () => {
      try {
        // Fetch current price from DexScreener API
        const priceData = await fetchTokenPrice(pairAddress);
        subscription.lastFetch = Date.now();
        subscription.fetchCount++;

        if (!priceData) {
          subscription.errorCount++;
          logger.warn(`⚠️  Failed to fetch price for ${pairAddress} (error count: ${subscription.errorCount})`);

          // Stop updates if too many consecutive errors
          if (subscription.errorCount >= this.MAX_ERROR_COUNT) {
            logger.error(`❌ Too many errors for ${pairAddress}, stopping updates`);
            this.stopPriceUpdates(subscription);
            this.subscriptions.delete(pairAddress);
          }
          return;
        }

        // Reset error count on successful fetch
        subscription.errorCount = 0;

        // Check if price has changed
        const currentPrice = priceData.priceUsd;
        const hasChanged = subscription.lastPrice !== currentPrice;

        if (hasChanged || subscription.lastPrice === null) {
          // Determine price change direction
          let change: 'increase' | 'decrease' | 'unchanged' = 'unchanged';
          if (subscription.lastPrice && currentPrice) {
            const oldPrice = parseFloat(subscription.lastPrice);
            const newPrice = parseFloat(currentPrice);
            change = newPrice > oldPrice ? 'increase' : newPrice < oldPrice ? 'decrease' : 'unchanged';
          }

          // Create price update event
          const priceUpdate: PriceUpdateEvent = {
            pairAddress,
            priceUsd: currentPrice,
            priceChange24h: priceData.priceChange24h,
            timestamp: Date.now(),
            change
          };

          // Emit to all subscribed clients
          let emitCount = 0;
          subscription.clients.forEach((callback, clientId) => {
            try {
              callback(priceUpdate);
              emitCount++;
            } catch (error) {
              logger.error(`❌ Error emitting price update to client ${clientId}:`, error);
              // Remove problematic client to prevent future errors
              subscription.clients.delete(clientId);
            }
          });

          // Update last known price
          subscription.lastPrice = currentPrice;

          logger.debug(`💰 Price update emitted for ${pairAddress}: $${currentPrice} (${change}) → ${emitCount} clients`);
        } else {
          logger.debug(`📊 Price unchanged for ${pairAddress}: $${currentPrice}`);
        }

      } catch (error) {
        subscription.errorCount++;
        logger.error(`❌ Error in price update for ${pairAddress}:`, error);

        // Stop updates if too many consecutive errors
        if (subscription.errorCount >= this.MAX_ERROR_COUNT) {
          logger.error(`❌ Too many errors for ${pairAddress}, stopping updates`);
          this.stopPriceUpdates(subscription);
          this.subscriptions.delete(pairAddress);
        }
      }
    }, this.UPDATE_INTERVAL);

    logger.debug(`⏰ Price update timer started for ${pairAddress} (interval: ${this.UPDATE_INTERVAL}ms)`);
  }

  /**
   * Stop Real-time Price Updates for a Token
   * 
   * Stops the price update timer for a token when there are
   * no more subscribers. This prevents unnecessary API calls
   * and conserves resources.
   * 
   * @param subscription - Token subscription to stop updates for
   */
  private stopPriceUpdates(subscription: TokenSubscription): void {
    if (subscription.updateInterval) {
      clearInterval(subscription.updateInterval);
      subscription.updateInterval = null;
      
      logger.debug(`⏹️  Price update timer stopped for ${subscription.pairAddress}`);
      logger.debug(`📊 Final stats for ${subscription.pairAddress}: ${subscription.fetchCount} fetches, ${subscription.errorCount} errors`);
    }
  }

  /**
   * Get Active Subscriptions Count
   * 
   * Returns the total number of tokens currently being tracked
   * for price updates. Used for monitoring and statistics.
   * 
   * @returns number - Count of active token subscriptions
   */
  getActiveSubscriptionsCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get Detailed Subscription Statistics
   * 
   * Returns detailed information about all active subscriptions
   * for monitoring, debugging, and performance analysis.
   * 
   * @returns Object containing subscription statistics
   */
  getSubscriptionStats() {
    const stats = {
      totalSubscriptions: this.subscriptions.size,
      totalClients: 0,
      subscriptions: [] as Array<{
        pairAddress: string;
        clientCount: number;
        lastPrice: string | null;
        fetchCount: number;
        errorCount: number;
        lastFetch: number;
        uptimeSeconds: number;
      }>
    };

    const now = Date.now();

    this.subscriptions.forEach((subscription, pairAddress) => {
      stats.totalClients += subscription.clients.size;
      
      const uptimeSeconds = subscription.lastFetch ? 
        Math.floor((now - (subscription.lastFetch - (subscription.fetchCount * this.UPDATE_INTERVAL))) / 1000) : 0;

      stats.subscriptions.push({
        pairAddress,
        clientCount: subscription.clients.size,
        lastPrice: subscription.lastPrice,
        fetchCount: subscription.fetchCount,
        errorCount: subscription.errorCount,
        lastFetch: subscription.lastFetch,
        uptimeSeconds
      });
    });

    return stats;
  }

  /**
   * Clean Up All Subscriptions
   * 
   * Stops all price updates and clears all subscriptions.
   * Used during server shutdown to ensure clean termination.
   */
  cleanup(): void {
    logger.info(`🧹 Cleaning up ${this.subscriptions.size} active subscriptions`);

    this.subscriptions.forEach((subscription) => {
      this.stopPriceUpdates(subscription);
    });

    this.subscriptions.clear();
    logger.info('✅ All subscriptions cleaned up');
  }
}
