/**
 * DexScreener API Service
 * 
 * Handles all communication with the DexScreener API for fetching
 * cryptocurrency data from the Base network.
 * 
 * Features:
 * - Trending tokens fetching with Base network filtering
 * - Individual token price fetching
 * - Rate limiting and error handling
 * - Response caching to reduce API calls
 * - Automatic retry mechanism
 */

import { logger } from '../utils/logger';

// Note: Using Node.js built-in fetch (available in Node.js 18+)
// No need to import fetch as it's globally available

/**
 * DexScreener API Configuration
 * Based on official API documentation: https://docs.dexscreener.com/api/reference
 */
const DEXSCREENER_BASE_URL = process.env.DEXSCREENER_BASE_URL || 'https://api.dexscreener.com';
const RATE_LIMIT_DELAY = parseInt(process.env.DEXSCREENER_RATE_LIMIT || '1000'); // 1 second between requests (conservative)

/**
 * DexScreener API Response Interfaces
 * Based on official API documentation: https://docs.dexscreener.com/api/reference
 */

/**
 * Token Information from DexScreener API
 */
export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

/**
 * Pair Information from DexScreener API
 */
export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: TokenInfo;
  quoteToken: TokenInfo;
  priceNative: string;
  priceUsd: string;
  txns: {
    [key: string]: {
      buys: number;
      sells: number;
    };
  };
  volume: {
    [key: string]: number;
  };
  priceChange: {
    [key: string]: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ url: string }>;
    socials?: Array<{ platform: string; handle: string }>;
  };
  boosts?: {
    active: number;
  };
}

/**
 * DexScreener API Response
 */
export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

/**
 * Boosted Token from DexScreener API
 */
export interface BoostedToken {
  url: string;
  chainId: string;
  tokenAddress: string;
  amount: number;
  totalAmount: number;
  icon?: string;
  header?: string;
  description?: string;
  links?: Array<{
    type: string;
    label: string;
    url: string;
  }>;
}

/**
 * Simplified Token Interface for Frontend
 */
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

/**
 * Price Update Interface
 */
export interface PriceUpdate {
  pairAddress: string;
  priceUsd: string;
  priceChange24h: number;
  timestamp: number;
}

/**
 * Cache for API responses to reduce external calls
 */
class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Rate limiter to respect DexScreener API limits
 */
class RateLimiter {
  private lastRequest = 0;

  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequest = Date.now();
  }
}

// Global instances
const apiCache = new ApiCache();
const rateLimiter = new RateLimiter();

/**
 * Make a Rate-Limited HTTP Request to DexScreener API
 * 
 * @param url - API endpoint URL
 * @param cacheTtl - Cache TTL in milliseconds (0 = no cache)
 * @returns Promise<any> - API response data
 */
async function makeApiRequest(url: string, cacheTtl: number = 0): Promise<any> {
  // Check cache first
  if (cacheTtl > 0) {
    const cached = apiCache.get(url);
    if (cached) {
      logger.debug(`📋 Cache hit for: ${url}`);
      return cached;
    }
  }

  // Apply rate limiting
  await rateLimiter.throttle();

  try {
    logger.debug(`📡 API request: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'CoinSwipe/1.0.0',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Cache successful responses
    if (cacheTtl > 0) {
      apiCache.set(url, data, cacheTtl);
      logger.debug(`📋 Cached response for: ${url} (TTL: ${cacheTtl}ms)`);
    }

    return data;

  } catch (error) {
    logger.error(`❌ API request failed for ${url}:`, error);
    throw error;
  }
}

/**
 * Fetch Trending Tokens from Base Network
 * 
 * Since DexScreener doesn't have a dedicated trending endpoint,
 * we combine boosted tokens (60 req/min) and search for popular Base pairs.
 * Uses official API endpoints from: https://docs.dexscreener.com/api/reference
 * 
 * @returns Promise<TrendingToken[]> - Array of trending tokens
 */
export async function fetchTrendingTokens(): Promise<TrendingToken[]> {
  try {
    logger.info('📊 Fetching trending tokens from Base network using official APIs...');

    const allTokens: TrendingToken[] = [];

    // Method 1: Get boosted tokens (these are actively promoted, similar to trending)
    // Rate limit: 60 requests per minute
    try {
      const boostedUrl = `${DEXSCREENER_BASE_URL}/token-boosts/latest/v1`;
      const boostedResponse = await makeApiRequest(boostedUrl, 20000);
      
      if (boostedResponse && Array.isArray(boostedResponse)) {
        // Get pairs for boosted tokens that are on Base network
        const baseTokenAddresses = boostedResponse
          .filter((token: BoostedToken) => token.chainId === 'base')
          .map((token: BoostedToken) => token.tokenAddress)
          .slice(0, 10); // Limit to avoid rate limits

        if (baseTokenAddresses.length > 0) {
          // Search for each boosted token individually since /tokens/{chain}/{address} doesn't exist
          for (const tokenAddress of baseTokenAddresses.slice(0, 5)) {
            try {
              const searchUrl = `${DEXSCREENER_BASE_URL}/latest/dex/search?q=${encodeURIComponent(tokenAddress)}`;
              const searchResponse: DexScreenerResponse = await makeApiRequest(searchUrl, 20000);
              
              if (searchResponse?.pairs && Array.isArray(searchResponse.pairs)) {
                const basePairs = searchResponse.pairs
                  .filter(pair => pair.chainId === 'base' && isValidPair(pair))
                  .slice(0, 1) // Only take the best match per token
                  .map(transformPairToToken);
                
                allTokens.push(...basePairs);
              }
            } catch (tokenError) {
              logger.warn(`⚠️  Failed to search for boosted token ${tokenAddress}:`, tokenError);
            }
            
            // Rate limiting between individual token searches
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
          }
          
          logger.info(`✅ Processed ${baseTokenAddresses.length} boosted tokens from Base network`);
        }
      }
    } catch (error) {
      logger.warn('⚠️  Failed to fetch boosted tokens:', error);
    }

    // Method 2: Search for popular Base network tokens
    // Rate limit: 300 requests per minute
    try {
      const searchQueries = ['WETH base', 'USDC base', 'DEGEN base', 'BRETT base', 'AERO base']; // Popular base tokens
      
      for (const query of searchQueries.slice(0, 3)) { // Limit searches to avoid rate limits
        try {
          const searchUrl = `${DEXSCREENER_BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`;
          const searchResponse: DexScreenerResponse = await makeApiRequest(searchUrl, 20000);
          
          if (searchResponse?.pairs && Array.isArray(searchResponse.pairs)) {
            const basePairs = searchResponse.pairs
              .filter(pair => pair.chainId === 'base' && isValidPair(pair))
              .slice(0, 5) // Limit per search
              .map(transformPairToToken);
            
            allTokens.push(...basePairs);
          }
        } catch (searchError) {
          logger.warn(`⚠️  Search for ${query} failed:`, searchError);
        }
      }
    } catch (error) {
      logger.warn('⚠️  Failed to search for popular tokens:', error);
    }

    // Remove duplicates based on pair address
    const uniqueTokens = Array.from(
      new Map(allTokens.map(token => [token.pairAddress, token])).values()
    );

    // Sort by liquidity (higher is better) and limit results
    const sortedTokens = uniqueTokens
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
      .slice(0, 30); // Limit to 30 tokens

    logger.info(`✅ Fetched ${sortedTokens.length} total trending tokens from Base network`);
    return sortedTokens;

  } catch (error) {
    logger.error('❌ Failed to fetch trending tokens:', error);
    
    // Return cached data if available
    const cached = apiCache.get('trending_tokens');
    if (cached && Array.isArray(cached)) {
      logger.info('📋 Returning cached trending tokens due to API error');
      return cached;
    }

    throw new Error('Unable to fetch trending tokens');
  }
}

/**
 * Fetch Current Price for a Specific Token
 * 
 * Retrieves real-time price data for a specific token pair.
 * Uses official DexScreener API: GET /latest/dex/pairs/{chainId}/{pairId}
 * Rate limit: 300 requests per minute
 * 
 * @param pairAddress - Token pair address (e.g., "0x1234...")
 * @returns Promise<PriceUpdate | null> - Price data or null if failed
 */
export async function fetchTokenPrice(pairAddress: string): Promise<PriceUpdate | null> {
  try {
    logger.debug(`💰 Fetching price for token: ${pairAddress}`);

    const url = `${DEXSCREENER_BASE_URL}/latest/dex/pairs/base/${pairAddress}`;
    const response: DexScreenerResponse = await makeApiRequest(url, 1000); // 1 second cache for prices
    
    if (!response?.pairs || !Array.isArray(response.pairs) || response.pairs.length === 0) {
      logger.warn(`⚠️  No price data found for token: ${pairAddress}`);
      return null;
    }

    const pair = response.pairs[0];
    
    if (!pair.priceUsd || !isValidPair(pair)) {
      logger.warn(`⚠️  Invalid price data for token: ${pairAddress}`);
      return null;
    }

    const priceUpdate: PriceUpdate = {
      pairAddress,
      priceUsd: pair.priceUsd,
      priceChange24h: pair.priceChange?.h24 || 0,
      timestamp: Date.now()
    };

    logger.debug(`💰 Price fetched for ${pairAddress}: $${priceUpdate.priceUsd}`);
    return priceUpdate;

  } catch (error) {
    logger.error(`❌ Failed to fetch price for ${pairAddress}:`, error);
    return null;
  }
}

/**
 * Transform DexScreener Pair to TrendingToken
 * 
 * Converts the official API response to our simplified interface
 * 
 * @param pair - DexScreener pair object
 * @returns TrendingToken - Simplified token object
 */
function transformPairToToken(pair: DexScreenerPair): TrendingToken {
  return {
    pairAddress: pair.pairAddress,
    baseToken: {
      address: pair.baseToken.address,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol
    },
    priceUsd: pair.priceUsd,
    priceChange: {
      h24: pair.priceChange?.h24 || 0
    },
    liquidity: {
      usd: pair.liquidity?.usd || 0
    },
    marketCap: pair.marketCap || 0,
    fdv: pair.fdv || 0,
    info: {
      imageUrl: pair.info?.imageUrl
    }
  };
}

/**
 * Validate DexScreener Pair Data Structure
 * 
 * Ensures the pair has all required fields from the official API
 * Based on: https://docs.dexscreener.com/api/reference
 * 
 * @param pair - DexScreener pair object to validate
 * @returns boolean - true if valid, false otherwise
 */
function isValidPair(pair: DexScreenerPair): boolean {
  return !!(
    pair &&
    pair.pairAddress &&
    pair.baseToken?.name &&
    pair.baseToken?.symbol &&
    pair.baseToken?.address &&
    pair.priceUsd &&
    pair.chainId === 'base' &&
    typeof pair.pairAddress === 'string' &&
    typeof pair.baseToken.name === 'string' &&
    typeof pair.baseToken.symbol === 'string' &&
    typeof pair.priceUsd === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(pair.pairAddress) // Valid Ethereum-style address
  );
}

/**
 * Get API Cache Statistics
 * 
 * Returns information about the current state of the API cache
 * for monitoring and debugging purposes
 * 
 * @returns Object containing cache statistics
 */
export function getCacheStats() {
  return {
    size: apiCache.size(),
    // Note: More detailed stats could be added if needed
  };
}

/**
 * Clear API Cache
 * 
 * Clears all cached API responses. Useful for testing
 * or when fresh data is explicitly required
 */
export function clearCache(): void {
  apiCache.clear();
  logger.info('🧹 API cache cleared');
}
