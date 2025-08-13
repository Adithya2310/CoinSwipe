/**
 * Trending Tokens API Route
 * 
 * Provides cached trending cryptocurrency tokens from the Base network.
 * This endpoint replaces the Next.js /api/trending route with improved
 * performance and better error handling.
 * 
 * Features:
 * - 20-second server-side caching
 * - Base network filtering at API level
 * - Comprehensive error handling
 * - Response metadata for cache status
 * - Rate limiting and request validation
 */

import { Router, Request, Response } from 'express';
import { fetchTrendingTokens, TrendingToken } from '../services/dexScreenerApi';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Cache configuration for trending tokens
 */
const CACHE_DURATION = parseInt(process.env.TRENDING_CACHE_DURATION || '20000'); // 20 seconds
let cachedTokens: TrendingToken[] = [];
let lastFetch = 0;
let fetchInProgress = false;

/**
 * Response interface for trending tokens
 */
interface TrendingResponse {
  tokens: TrendingToken[];
  meta: {
    cached: boolean;
    lastUpdate: number;
    nextUpdate: number;
    count: number;
    cacheHit: boolean;
    fetchDuration?: number;
  };
}

/**
 * GET /api/trending
 * 
 * Returns trending cryptocurrency tokens from the Base network.
 * 
 * Query Parameters:
 * - limit: Maximum number of tokens to return (default: 50, max: 100)
 * - force: Force refresh cache (default: false)
 * 
 * Response:
 * - tokens: Array of trending token objects
 * - meta: Cache and timing information
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    logger.debug('📊 Trending tokens request received');

    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const forceRefresh = req.query.force === 'true';

    // Check if we need to refresh the cache
    const now = Date.now();
    const cacheAge = now - lastFetch;
    const shouldRefresh = forceRefresh || 
                         cachedTokens.length === 0 || 
                         cacheAge > CACHE_DURATION;

    let cacheHit = true;
    let fetchDuration: number | undefined;

    if (shouldRefresh && !fetchInProgress) {
      cacheHit = false;
      fetchInProgress = true;
      
      try {
        logger.info(`🔄 Refreshing trending tokens cache (age: ${cacheAge}ms, force: ${forceRefresh})`);
        
        const fetchStart = Date.now();
        const freshTokens = await fetchTrendingTokens();
        fetchDuration = Date.now() - fetchStart;
        
        // Update cache
        cachedTokens = freshTokens;
        lastFetch = now;
        
        logger.info(`✅ Trending tokens cache refreshed: ${freshTokens.length} tokens (fetch: ${fetchDuration}ms)`);
        
      } catch (error) {
        logger.error('❌ Failed to refresh trending tokens cache:', error);
        
        // If we have cached data, use it; otherwise throw error
        if (cachedTokens.length === 0) {
          throw new Error('No trending tokens available');
        }
        
        logger.warn('⚠️  Using stale cached data due to fetch error');
        
      } finally {
        fetchInProgress = false;
      }
    }

    // Prepare response
    const limitedTokens = cachedTokens.slice(0, limit);
    const response: TrendingResponse = {
      tokens: limitedTokens,
      meta: {
        cached: true,
        lastUpdate: lastFetch,
        nextUpdate: lastFetch + CACHE_DURATION,
        count: limitedTokens.length,
        cacheHit,
        ...(fetchDuration && { fetchDuration })
      }
    };

    // Set cache headers
    const maxAge = Math.max(0, Math.floor((CACHE_DURATION - cacheAge) / 1000));
    res.set({
      'Cache-Control': `public, max-age=${maxAge}`,
      'X-Cache-Status': cacheHit ? 'HIT' : 'MISS',
      'X-Cache-Age': cacheAge.toString(),
      'X-Total-Tokens': cachedTokens.length.toString()
    });

    // Log request details
    const requestDuration = Date.now() - startTime;
    logger.debug(`📊 Trending tokens response: ${limitedTokens.length} tokens (${requestDuration}ms, cache: ${cacheHit ? 'HIT' : 'MISS'})`);

    res.json(response);

  } catch (error) {
    logger.error('❌ Trending tokens request failed:', error);

    const requestDuration = Date.now() - startTime;
    res.status(500).json({
      error: 'Failed to fetch trending tokens',
      message: error instanceof Error ? error.message : 'Unknown error',
      meta: {
        cached: false,
        lastUpdate: lastFetch,
        count: 0,
        cacheHit: false,
        requestDuration
      }
    });
  }
});

/**
 * GET /api/trending/stats
 * 
 * Returns statistics about the trending tokens cache.
 * Useful for monitoring and debugging.
 */
router.get('/stats', (req: Request, res: Response) => {
  const now = Date.now();
  const cacheAge = now - lastFetch;
  
  res.json({
    cache: {
      tokenCount: cachedTokens.length,
      lastUpdate: lastFetch,
      cacheAge: cacheAge,
      cacheAgeHuman: formatDuration(cacheAge),
      nextUpdate: lastFetch + CACHE_DURATION,
      cacheDuration: CACHE_DURATION,
      isStale: cacheAge > CACHE_DURATION,
      fetchInProgress
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: now
    }
  });
});

/**
 * POST /api/trending/refresh
 * 
 * Manually triggers a cache refresh.
 * Useful for testing and administrative purposes.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  if (fetchInProgress) {
    return res.status(429).json({
      error: 'Refresh already in progress',
      message: 'Please wait for the current refresh to complete'
    });
  }

  const startTime = Date.now();
  
  try {
    logger.info('🔄 Manual cache refresh triggered');
    
    fetchInProgress = true;
    const freshTokens = await fetchTrendingTokens();
    const fetchDuration = Date.now() - startTime;
    
    // Update cache
    const oldCount = cachedTokens.length;
    cachedTokens = freshTokens;
    lastFetch = Date.now();
    
    logger.info(`✅ Manual cache refresh completed: ${freshTokens.length} tokens (was: ${oldCount})`);
    
    res.json({
      success: true,
      message: 'Cache refreshed successfully',
      data: {
        oldTokenCount: oldCount,
        newTokenCount: freshTokens.length,
        fetchDuration,
        lastUpdate: lastFetch
      }
    });
    
  } catch (error) {
    logger.error('❌ Manual cache refresh failed:', error);
    
    res.status(500).json({
      error: 'Failed to refresh cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      fetchDuration: Date.now() - startTime
    });
    
  } finally {
    fetchInProgress = false;
  }
});

/**
 * Format duration in milliseconds to human-readable string
 * 
 * @param ms - Duration in milliseconds
 * @returns Human-readable duration string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export { router as trendingRouter };
