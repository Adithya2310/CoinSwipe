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
   * Initialize Connection - Mock Mode for Testing
   * 
   * Simulates connection to backend server for testing with hardcoded data.
   * Skips actual WebSocket connection and uses mock price updates.
   */
  async initializeConnection(): Promise<void> {
    try {
      console.log('🔌 Initializing mock connection for testing...');
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.isConnected = true;
      console.log('✅ Mock connection established - using hardcoded data');
      
      // Start mock price updates
      this.startMockPriceUpdates();
      
    } catch (error) {
      console.error('Failed to initialize mock connection:', error);
      throw error;
    }
  }

  /**
   * Start Mock Price Updates
   * 
   * Simulates real-time price updates for testing purposes
   */
  private startMockPriceUpdates(): void {
    setInterval(() => {
      if (this.trendingTokens.length > 0) {
        // Generate mock price update for a random token
        const randomToken = this.trendingTokens[Math.floor(Math.random() * this.trendingTokens.length)];
        const currentPrice = parseFloat(randomToken.priceUsd);
        
        // Generate small price variation (-2% to +2%)
        const variation = (Math.random() - 0.5) * 0.04;
        const newPrice = currentPrice * (1 + variation);
        
        const mockUpdate: PriceUpdate = {
          pairAddress: randomToken.pairAddress,
          priceUsd: newPrice.toString(),
          priceChange24h: randomToken.priceChange.h24 + variation * 100,
          timestamp: Date.now()
        };

        // Update the token's price in our mock data
        randomToken.priceUsd = newPrice.toString();
        randomToken.priceChange.h24 = mockUpdate.priceChange24h;

        // Emit to callbacks
        this.priceCallbacks.forEach(callback => {
          try {
            callback(mockUpdate);
          } catch (error) {
            console.error('Error in price update callback:', error);
          }
        });
      }
    }, 3000); // Update every 3 seconds
  }

  /**
   * Fetch Trending Tokens - Using Hardcoded Data for Testing
   * 
   * Returns mock trending tokens for Base network to test functionality
   * and Supabase integration without requiring backend server.
   */
  async fetchTrendingTokens(): Promise<TrendingToken[]> {
    try {
      console.log('📊 Loading hardcoded trending tokens for Base network...');
      
      // Hardcoded trending tokens for Base network testing
      const mockTokens: TrendingToken[] = [
        {
          pairAddress: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
          baseToken: {
            address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            name: 'USD Coin',
            symbol: 'USDC'
          },
          priceUsd: '1.0001',
          priceChange: { h24: 0.02 },
          liquidity: { usd: 15420000 },
          marketCap: 32500000000,
          fdv: 32500000000,
          info: { imageUrl: 'https://coin-images.coingecko.com/coins/images/6319/large/USD_Coin_icon.png' }
        },
        {
          pairAddress: '0x6446021f4e396da3df4235c62537b035c3c5d60a',
          baseToken: {
            address: '0x4200000000000000000000000000000000000006',
            name: 'Wrapped Ethereum',
            symbol: 'WETH'
          },
          priceUsd: '3247.82',
          priceChange: { h24: 2.45 },
          liquidity: { usd: 8920000 },
          marketCap: 390000000000,
          fdv: 390000000000,
          info: { imageUrl: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png' }
        },
        {
          pairAddress: '0x88a43bbdf9d098eec7bcdcbaf22ca6a7b5151890',
          baseToken: {
            address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
            name: 'Dai Stablecoin',
            symbol: 'DAI'
          },
          priceUsd: '0.9998',
          priceChange: { h24: -0.01 },
          liquidity: { usd: 2340000 },
          marketCap: 5200000000,
          fdv: 5200000000,
          info: { imageUrl: 'https://coin-images.coingecko.com/coins/images/9956/large/Badge_Dai.png' }
        },
        {
          pairAddress: '0xc5b208b3b5e3fa3a43ce8f8b6e0b2c5e7d4f3a2b',
          baseToken: {
            address: '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
            name: 'Aerodrome Finance',
            symbol: 'AERO'
          },
          priceUsd: '1.23',
          priceChange: { h24: 8.67 },
          liquidity: { usd: 1850000 },
          marketCap: 890000000,
          fdv: 1200000000,
          info: { imageUrl: 'https://coin-images.coingecko.com/coins/images/31745/large/token.png' }
        },
        {
          pairAddress: '0xa1b2c3d4e5f6789012345678901234567890abcd',
          baseToken: {
            address: '0x2416092f143378750bb29b79ed961ab195cceea5',
            name: 'EzETH',
            symbol: 'ezETH'
          },
          priceUsd: '3298.45',
          priceChange: { h24: 3.21 },
          liquidity: { usd: 1200000 },
          marketCap: 450000000,
          fdv: 650000000,
          info: { imageUrl: 'https://coin-images.coingecko.com/coins/images/34753/large/Ezeth_logo_circle.png' }
        },
        {
          pairAddress: '0xf1e2d3c4b5a6978901234567890123456789cdef',
          baseToken: {
            address: '0x78a087d713be963bf307b18f2ff8122ef9a63ae9',
            name: 'Base God',
            symbol: 'TYBG'
          },
          priceUsd: '0.0000234',
          priceChange: { h24: 15.43 },
          liquidity: { usd: 890000 },
          marketCap: 23400000,
          fdv: 45600000,
          info: { imageUrl: 'https://coin-images.coingecko.com/coins/images/31832/large/basegod.png' }
        },
        {
          pairAddress: '0x9876543210fedcba0987654321fedcba09876543',
          baseToken: {
            address: '0xa88594d404727625a9437c3f886c7643872296ae',
            name: 'WELL',
            symbol: 'WELL'
          },
          priceUsd: '0.0456',
          priceChange: { h24: -2.34 },
          liquidity: { usd: 670000 },
          marketCap: 12300000,
          fdv: 18900000,
          info: { imageUrl: 'https://coin-images.coingecko.com/coins/images/31661/large/well.png' }
        },
        {
          pairAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
          baseToken: {
            address: '0x27d2decb4bfc9c76f0309b8e88dec3a601fe25a8',
            name: 'Bald',
            symbol: 'BALD'
          },
          priceUsd: '0.0000891',
          priceChange: { h24: 22.67 },
          liquidity: { usd: 1450000 },
          marketCap: 8900000,
          fdv: 8900000,
          info: { imageUrl: 'https://coin-images.coingecko.com/coins/images/31271/large/bald.png' }
        }
      ];

      this.trendingTokens = mockTokens;
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

  // Subscribe to price updates for a specific token (Mock Mode)
  subscribeToToken(pairAddress: string): void {
    if (!this.isConnected) {
      console.error('❌ Cannot subscribe: not connected to service');
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

    console.log(`📊 Mock subscribing to price updates for ${pairAddress}`);
    this.activeSubscriptions.add(pairAddress);
  }

  // Unsubscribe from price updates (Mock Mode)
  unsubscribeFromToken(pairAddress: string): void {
    if (!this.isConnected) {
      return;
    }

    // Only unsubscribe if actually subscribed
    if (this.activeSubscriptions.has(pairAddress)) {
      console.log(`📊 Mock unsubscribing from ${pairAddress}`);
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

  // Clean disconnect (Mock Mode)
  disconnect(): void {
    console.log('🔌 Disconnecting mock service...');
    
    // Clear all subscriptions
    this.activeSubscriptions.clear();
    this.priceCallbacks.clear();
    this.isConnected = false;
    this.socket = null;
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
