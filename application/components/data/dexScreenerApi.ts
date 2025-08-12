// DexScreener API service for Base network
// Base chain ID: 8453 (0x2105)

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: {
      buys: number;
      sells: number;
    };
    h1: {
      buys: number;
      sells: number;
    };
    h6: {
      buys: number;
      sells: number;
    };
    h24: {
      buys: number;
      sells: number;
    };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{
      label: string;
      url: string;
    }>;
    socials?: Array<{
      type: string;
      url: string;
    }>;
  };
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

export interface DexScreenerSearchResponse extends DexScreenerResponse {}

// Transform DexScreener data to our Token interface
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

class DexScreenerApiService {
  private baseUrl = 'https://api.dexscreener.com/latest/dex';
  private baseChainId = 'base'; // Base network
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 30000; // 30 seconds cache

  // Rate limiting
  private lastRequestTime = 0;
  private minRequestInterval = 200; // 200ms between requests to respect rate limits

  private async makeRequest(url: string): Promise<any> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    // Check cache
    const cacheKey = url;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Cache the response
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      
      return data;
    } catch (error) {
      console.error('DexScreener API request failed:', error);
      throw error;
    }
  }

  // Get latest pairs for Base network
  async getLatestPairs(limit: number = 100): Promise<DexScreenerPair[]> {
    try {
      const url = `${this.baseUrl}/search?q=base`;
      const response: DexScreenerSearchResponse = await this.makeRequest(url);
      
      // Filter for Base network pairs and sort by volume
      const basePairs = response.pairs
        .filter(pair => pair.chainId === this.baseChainId)
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, limit);
      
      return basePairs;
    } catch (error) {
      console.error('Error fetching latest pairs:', error);
      return [];
    }
  }

  // Get specific pair data
  async getPairData(pairAddress: string): Promise<DexScreenerPair | null> {
    try {
      const url = `${this.baseUrl}/pairs/${this.baseChainId}/${pairAddress}`;
      const response: DexScreenerResponse = await this.makeRequest(url);
      return response.pairs?.[0] || null;
    } catch (error) {
      console.error('Error fetching pair data:', error);
      return null;
    }
  }

  // Search for tokens by name or symbol
  async searchTokens(query: string): Promise<DexScreenerPair[]> {
    try {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
      const response: DexScreenerSearchResponse = await this.makeRequest(url);
      
      // Filter for Base network pairs
      return response.pairs.filter(pair => pair.chainId === this.baseChainId);
    } catch (error) {
      console.error('Error searching tokens:', error);
      return [];
    }
  }

  // Transform DexScreener pair to our Token interface
  transformPairToToken(pair: DexScreenerPair, category: string = 'new'): Token {
    const price = parseFloat(pair.priceUsd || '0');
    const priceChange24h = pair.priceChange?.h24 || 0;
    const liquidity = pair.liquidity?.usd || 0;
    const marketCap = pair.marketCap || 0;
    const fdv = pair.fdv || marketCap;
    const volume24h = pair.volume?.h24 || 0;
    const txCount24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);

    // Determine trust level based on liquidity and age
    let trustLevel: 'high' | 'medium' | 'low' = 'low';
    if (liquidity > 100000 && volume24h > 50000) {
      trustLevel = 'high';
    } else if (liquidity > 25000 && volume24h > 10000) {
      trustLevel = 'medium';
    }

    // Generate icon and color based on symbol
    const icon = this.generateTokenIcon(pair.baseToken.symbol);
    const color = this.generateTokenColor(pair.baseToken.symbol);

    return {
      id: pair.pairAddress,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      price,
      priceChange24h,
      liquidity,
      marketCap,
      fdv,
      trustLevel,
      icon,
      color,
      category,
      pairAddress: pair.pairAddress,
      dexId: pair.dexId,
      volume24h,
      txCount24h,
      createdAt: pair.pairCreatedAt,
      imageUrl: pair.info?.imageUrl,
    };
  }

  // Generate icon for token based on symbol
  private generateTokenIcon(symbol: string): string {
    const icons = ['🚀', '💎', '🌙', '⭐', '🔥', '💰', '🎯', '⚡', '🌟', '💫', '🔮', '🎪', '🎨', '🎭', '🎬'];
    const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return icons[hash % icons.length];
  }

  // Generate color for token based on symbol
  private generateTokenColor(symbol: string): string {
    const colors = [
      '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#8b5cf6',
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6'
    ];
    const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  // Get tokens by category
  async getTokensByCategory(category: string, limit: number = 20): Promise<Token[]> {
    try {
      let pairs: DexScreenerPair[];

      switch (category) {
        case 'new':
          // Get newest pairs (sorted by creation date)
          pairs = await this.getLatestPairs(limit * 2);
          pairs = pairs.filter(pair => {
            const daysSinceCreation = pair.pairCreatedAt 
              ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24)
              : 999;
            return daysSinceCreation <= 7; // Less than 7 days old
          }).slice(0, limit);
          break;

        case 'blue':
          // Get established tokens with high liquidity
          pairs = await this.getLatestPairs(limit * 3);
          pairs = pairs.filter(pair => 
            (pair.liquidity?.usd || 0) > 100000 && 
            (pair.volume?.h24 || 0) > 50000
          ).slice(0, limit);
          break;

        case 'meme':
          // Search for meme-related tokens
          const memeSearches = ['pepe', 'doge', 'shib', 'moon', 'safe'];
          const memeResults = await Promise.all(
            memeSearches.map(term => this.searchTokens(term))
          );
          pairs = memeResults.flat().slice(0, limit);
          break;

        case 'risky':
          // Get tokens with high volatility and lower liquidity
          pairs = await this.getLatestPairs(limit * 2);
          pairs = pairs.filter(pair => 
            Math.abs(pair.priceChange?.h24 || 0) > 50 && 
            (pair.liquidity?.usd || 0) < 50000
          ).slice(0, limit);
          break;

        case 'ai':
          // Search for AI-related tokens
          const aiSearches = ['ai', 'neural', 'brain', 'smart', 'algorithm'];
          const aiResults = await Promise.all(
            aiSearches.map(term => this.searchTokens(term))
          );
          pairs = aiResults.flat().slice(0, limit);
          break;

        default:
          pairs = await this.getLatestPairs(limit);
      }

      return pairs.map(pair => this.transformPairToToken(pair, category));
    } catch (error) {
      console.error(`Error fetching tokens for category ${category}:`, error);
      return [];
    }
  }

  // Real-time price updates for specific pairs
  async subscribeToPriceUpdates(
    pairAddresses: string[], 
    callback: (updates: Map<string, Token>) => void,
    intervalMs: number = 5000
  ): Promise<() => void> {
    const updatePrices = async () => {
      try {
        const updates = new Map<string, Token>();
        
        // Fetch updated data for each pair
        for (const pairAddress of pairAddresses) {
          const pairData = await this.getPairData(pairAddress);
          if (pairData) {
            const token = this.transformPairToToken(pairData);
            updates.set(pairAddress, token);
          }
        }

        if (updates.size > 0) {
          callback(updates);
        }
      } catch (error) {
        console.error('Error updating prices:', error);
      }
    };

    // Initial update
    await updatePrices();

    // Set up interval for continuous updates
    const intervalId = setInterval(updatePrices, intervalMs);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
    };
  }
}

export const dexScreenerApi = new DexScreenerApiService();
export default dexScreenerApi;
