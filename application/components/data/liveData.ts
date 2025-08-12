// Live data service that replaces mock data with real DexScreener data
import { dexScreenerApi, Token as ApiToken } from './dexScreenerApi';

// Re-export interfaces for backward compatibility
export interface Token {
  id: string;
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  trustLevel: 'high' | 'medium' | 'low';
  icon: string;
  color: string;
  category: string;
  pairAddress?: string;
  dexId?: string;
  volume24h?: number;
  txCount24h?: number;
  createdAt?: number;
  imageUrl?: string;
}

export interface PortfolioItem {
  tokenId: string;
  token: Token;
  amount: number;
  value: number;
  purchasePrice: number;
  change: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconClass: string;
  tokens: Token[];
}

// Price update event system
type PriceUpdateCallback = (tokenId: string, newPrice: number, priceChange24h: number) => void;

class LiveDataService {
  private priceSubscriptions = new Map<string, () => void>();
  private tokenCache = new Map<string, Token[]>();
  private cacheTimestamp = new Map<string, number>();
  private cacheTimeout = 60000; // 1 minute cache for categories
  private priceUpdateCallbacks = new Set<PriceUpdateCallback>();

  // Real-time price update subscriptions
  private activeSubscriptions = new Map<string, () => void>();

  constructor() {
    // Initialize with some default data while API loads
    this.initializeCache();
  }

  private async initializeCache() {
    // Pre-load popular categories
    const categories = ['new', 'blue', 'meme'];
    await Promise.all(categories.map(category => this.getTokensByCategory(category)));
  }

  // Subscribe to price updates
  subscribeToUpdates(callback: PriceUpdateCallback): () => void {
    this.priceUpdateCallbacks.add(callback);
    return () => {
      this.priceUpdateCallbacks.delete(callback);
    };
  }

  // Emit price update to all subscribers
  private emitPriceUpdate(tokenId: string, newPrice: number, priceChange24h: number) {
    this.priceUpdateCallbacks.forEach(callback => {
      try {
        callback(tokenId, newPrice, priceChange24h);
      } catch (error) {
        console.error('Error in price update callback:', error);
      }
    });
  }

  // Get tokens by category with caching
  async getTokensByCategory(categoryId: string, forceRefresh: boolean = false): Promise<Token[]> {
    const cacheKey = `category_${categoryId}`;
    const cached = this.tokenCache.get(cacheKey);
    const cacheTime = this.cacheTimestamp.get(cacheKey) || 0;
    const now = Date.now();

    // Return cached data if it's fresh and not forcing refresh
    if (!forceRefresh && cached && (now - cacheTime) < this.cacheTimeout) {
      return cached;
    }

    try {
      // Fetch fresh data from API
      const tokens = await dexScreenerApi.getTokensByCategory(categoryId, 20);
      
      // Update cache
      this.tokenCache.set(cacheKey, tokens);
      this.cacheTimestamp.set(cacheKey, now);

      return tokens;
    } catch (error) {
      console.error(`Error fetching tokens for category ${categoryId}:`, error);
      // Return cached data if available, otherwise empty array
      return cached || [];
    }
  }

  // Start real-time price updates for specific tokens
  async startPriceUpdates(tokens: Token[], intervalMs: number = 5000): Promise<void> {
    // Stop existing subscriptions for these tokens
    tokens.forEach(token => {
      if (token.pairAddress) {
        this.stopPriceUpdatesForToken(token.pairAddress);
      }
    });

    // Group tokens by pair address
    const pairAddresses = tokens
      .filter(token => token.pairAddress)
      .map(token => token.pairAddress!);

    if (pairAddresses.length === 0) return;

    try {
      const cleanup = await dexScreenerApi.subscribeToPriceUpdates(
        pairAddresses,
        (updates) => {
          // Update cache and emit events
          updates.forEach((updatedToken, pairAddress) => {
            // Update token in cache
            this.updateTokenInCache(updatedToken);
            
            // Emit price update event
            this.emitPriceUpdate(
              updatedToken.id,
              updatedToken.price,
              updatedToken.priceChange24h
            );
          });
        },
        intervalMs
      );

      // Store cleanup function
      const subscriptionKey = pairAddresses.join(',');
      this.activeSubscriptions.set(subscriptionKey, cleanup);

    } catch (error) {
      console.error('Error starting price updates:', error);
    }
  }

  // Stop price updates for a specific token
  stopPriceUpdatesForToken(pairAddress: string): void {
    // Find and cleanup subscription
    for (const [key, cleanup] of this.activeSubscriptions) {
      if (key.includes(pairAddress)) {
        cleanup();
        this.activeSubscriptions.delete(key);
        break;
      }
    }
  }

  // Stop all price updates
  stopAllPriceUpdates(): void {
    this.activeSubscriptions.forEach(cleanup => cleanup());
    this.activeSubscriptions.clear();
  }

  // Update token in cache
  private updateTokenInCache(updatedToken: Token): void {
    this.tokenCache.forEach((tokens, cacheKey) => {
      const index = tokens.findIndex(token => 
        token.id === updatedToken.id || token.pairAddress === updatedToken.pairAddress
      );
      if (index !== -1) {
        tokens[index] = { ...tokens[index], ...updatedToken };
      }
    });
  }

  // Get specific token data
  async getTokenData(tokenId: string): Promise<Token | null> {
    // First check cache
    for (const tokens of this.tokenCache.values()) {
      const token = tokens.find(t => t.id === tokenId || t.pairAddress === tokenId);
      if (token) return token;
    }

    // If not in cache, try to fetch from API
    try {
      const pairData = await dexScreenerApi.getPairData(tokenId);
      if (pairData) {
        return dexScreenerApi.transformPairToToken(pairData);
      }
    } catch (error) {
      console.error('Error fetching token data:', error);
    }

    return null;
  }

  // Search tokens
  async searchTokens(query: string): Promise<Token[]> {
    try {
      const pairs = await dexScreenerApi.searchTokens(query);
      return pairs.map(pair => dexScreenerApi.transformPairToToken(pair));
    } catch (error) {
      console.error('Error searching tokens:', error);
      return [];
    }
  }

  // Force refresh category data
  async refreshCategory(categoryId: string): Promise<Token[]> {
    return this.getTokensByCategory(categoryId, true);
  }

  // Get all categories with live data
  async getCategories(): Promise<Category[]> {
    const categoryConfigs = [
      {
        id: "meme",
        name: "Meme Coins",
        description: "Popular and trending meme tokens on Base",
        icon: "⭐",
        iconClass: "meme",
      },
      {
        id: "risky",
        name: "Risky Degens",
        description: "High risk, high reward tokens",
        icon: "💀",
        iconClass: "risky",
      },
      {
        id: "new",
        name: "Newly Launched",
        description: "Recently launched tokens on Base Network",
        icon: "🚀",
        iconClass: "new",
      },
      {
        id: "blue",
        name: "Blue Chips",
        description: "Established and trusted Base tokens",
        icon: "⭐",
        iconClass: "blue",
      },
      {
        id: "ai",
        name: "AI Analyzed",
        description: "AI-recommended tokens based on Base data",
        icon: "🧠",
        iconClass: "ai",
      }
    ];

    // Load tokens for each category
    const categories = await Promise.all(
      categoryConfigs.map(async (config) => {
        const tokens = await this.getTokensByCategory(config.id);
        return {
          ...config,
          tokens
        };
      })
    );

    return categories;
  }
}

// Create singleton instance
export const liveDataService = new LiveDataService();

// Export for backward compatibility
export const categories: Category[] = [];
export const mockUserBalance = 129.00;
export const defaultBuyAmount = 1.00;

// Mock portfolio data (this could be enhanced with real portfolio tracking)
export const mockPortfolio: PortfolioItem[] = [
  // This would be replaced with real portfolio data from user's wallet/transactions
];

// Initialize categories (async)
liveDataService.getCategories().then(cats => {
  categories.splice(0, categories.length, ...cats);
});

export default liveDataService;
