/**
 * Real-time Service for CoinSwipe Frontend
 * 
 * Connects to the Node.js backend server for real-time price updates.
 * Implements the WebSocket architecture:
 * 
 * 1. User gets a coin → subscribes to token price updates
 * 2. Server emits updated price every 2 seconds
 * 3. User swipes → unsubscribe old, subscribe new
 * 
 * Ultra lightweight and optimized for performance.
 */

import { io, Socket } from 'socket.io-client';

/**
 * Backend server configuration
 */
const BACKEND_SERVER_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

export interface TrendingToken {
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange: {
    h24: number;
  };
  liquidity?: {
    usd?: number;
  };
  marketCap?: number;
  fdv?: number;
  info?: {
    imageUrl?: string;
  };
}

export interface PriceUpdate {
  pairAddress: string;
  priceUsd: string;
  priceChange24h: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

class RealTimeService {
  private socket: Socket | null = null;
  private isConnected = false;
  private trendingTokens: TrendingToken[] = [];
  private currentTokenIndex = 0;
  private priceCallbacks = new Set<PriceUpdateCallback>();
  private activeSubscriptions = new Set<string>(); // Track active subscriptions
  private maxSubscriptions = 5; // Server limit

  /**
   * Initialize WebSocket Connection to Node.js Backend
   * 
   * Connects to the dedicated Node.js server instead of Next.js API routes.
   * This provides better WebSocket performance and reliability.
   */
  async initializeConnection(): Promise<void> {
    try {
      console.log(`🔌 Connecting to backend server: ${BACKEND_SERVER_URL}`);
      
      this.socket = io(BACKEND_SERVER_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Failed to create socket'));
          return;
        }

        this.socket.on('connect', () => {
          console.log('✅ Connected to real-time price service');
          this.isConnected = true;
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('❌ Disconnected from real-time service');
          this.isConnected = false;
        });

        this.socket.on('connected', (data) => {
          console.log('🚀 Real-time service ready:', data.message);
        });

        this.socket.on('priceUpdate', (update: PriceUpdate) => {
          // Emit to all registered callbacks
          this.priceCallbacks.forEach(callback => {
            try {
              callback(update);
            } catch (error) {
              console.error('Error in price update callback:', error);
            }
          });
        });

        this.socket.on('subscribed', (data) => {
          console.log(`📈 Subscribed to ${data.pairAddress}`);
        });

        this.socket.on('error', (error) => {
          console.error('❌ Socket error:', error);
          reject(new Error(error));
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 5000);
      });
    } catch (error) {
      console.error('Failed to initialize connection:', error);
      throw error;
    }
  }

  /**
   * Fetch Trending Tokens from Node.js Backend
   * 
   * Connects to the dedicated backend server to get trending tokens
   * from the Base network with improved caching and performance.
   */
  async fetchTrendingTokens(): Promise<TrendingToken[]> {
    try {
      console.log('📊 Fetching trending tokens from backend server...');
      
      const response = await fetch(`${BACKEND_SERVER_URL}/api/trending`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.trendingTokens = data.tokens || [];
      this.currentTokenIndex = 0;

      console.log(`✅ Loaded ${this.trendingTokens.length} trending tokens from backend`);
      return this.trendingTokens;
    } catch (error) {
      console.error('❌ Error fetching trending tokens:', error);
      throw error;
    }
  }

  // Get next token for swiping
  getNextToken(): TrendingToken | null {
    if (this.trendingTokens.length === 0) {
      return null;
    }

    // Cycle through tokens
    if (this.currentTokenIndex >= this.trendingTokens.length) {
      this.currentTokenIndex = 0;
    }

    const token = this.trendingTokens[this.currentTokenIndex];
    this.currentTokenIndex++;

    return token;
  }

  // Get random token (alternative to sequential)
  getRandomToken(): TrendingToken | null {
    if (this.trendingTokens.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * this.trendingTokens.length);
    return this.trendingTokens[randomIndex];
  }

  // Subscribe to price updates for a specific token
  subscribeToToken(pairAddress: string): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Cannot subscribe: not connected to real-time service');
      return;
    }

    // Check if already subscribed
    if (this.activeSubscriptions.has(pairAddress)) {
      console.log(`📊 Already subscribed to ${pairAddress}`);
      return;
    }

    // Check subscription limit
    if (this.activeSubscriptions.size >= this.maxSubscriptions) {
      console.warn(`⚠️ Maximum subscriptions (${this.maxSubscriptions}) reached. Cleaning up oldest subscription.`);
      const oldestSubscription = Array.from(this.activeSubscriptions)[0];
      this.unsubscribeFromToken(oldestSubscription);
    }

    console.log(`📊 Subscribing to price updates for ${pairAddress}`);
    this.socket.emit('subscribe', pairAddress);
    this.activeSubscriptions.add(pairAddress);
  }

  // Unsubscribe from price updates
  unsubscribeFromToken(pairAddress: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    // Only unsubscribe if actually subscribed
    if (this.activeSubscriptions.has(pairAddress)) {
      console.log(`📊 Unsubscribing from ${pairAddress}`);
      this.socket.emit('unsubscribe', pairAddress);
      this.activeSubscriptions.delete(pairAddress);
    }
  }

  // Register callback for price updates
  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.priceCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.priceCallbacks.delete(callback);
    };
  }

  // Get current connection status
  isConnectionReady(): boolean {
    return this.isConnected && this.socket !== null;
  }

  // Get loaded tokens count
  getTokensCount(): number {
    return this.trendingTokens.length;
  }

  // Refresh trending tokens
  async refreshTokens(): Promise<TrendingToken[]> {
    return this.fetchTrendingTokens();
  }

  // Clean disconnect
  disconnect(): void {
    if (this.socket) {
      // Unsubscribe from all active subscriptions
      this.activeSubscriptions.forEach(pairAddress => {
        this.socket?.emit('unsubscribe', pairAddress);
      });
      this.activeSubscriptions.clear();
      
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
    this.priceCallbacks.clear();
  }

  // Get current subscriptions (for debugging)
  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions);
  }

  // Clear all subscriptions (utility method)
  clearAllSubscriptions(): void {
    if (this.socket && this.isConnected) {
      this.activeSubscriptions.forEach(pairAddress => {
        this.socket?.emit('unsubscribe', pairAddress);
      });
      this.activeSubscriptions.clear();
    }
  }

  // Transform token for UI compatibility
  transformTokenForUI(token: TrendingToken): any {
    const price = parseFloat(token.priceUsd || '0');
    const priceChange24h = token.priceChange?.h24 || 0;
    const liquidity = token.liquidity?.usd || 0;
    const marketCap = token.marketCap || 0;

    // Simple trust level based on liquidity
    let trustLevel: 'high' | 'medium' | 'low' = 'low';
    if (liquidity > 100000) trustLevel = 'high';
    else if (liquidity > 25000) trustLevel = 'medium';

    // Generate simple icon
    const icons = ['🚀', '💎', '🌙', '⭐', '🔥', '💰', '🎯', '⚡'];
    const iconIndex = token.baseToken.symbol.charCodeAt(0) % icons.length;

    return {
      id: token.pairAddress,
      name: token.baseToken.name,
      symbol: token.baseToken.symbol,
      price,
      priceChange24h,
      liquidity,
      marketCap,
      fdv: token.fdv || marketCap,
      trustLevel,
      icon: icons[iconIndex],
      color: `hsl(${(token.baseToken.symbol.charCodeAt(0) * 137) % 360}, 70%, 50%)`,
      pairAddress: token.pairAddress,
      imageUrl: token.info?.imageUrl
    };
  }
}

// Create singleton instance
export const realTimeService = new RealTimeService();
export default realTimeService;
