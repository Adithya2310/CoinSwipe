/**
 * Health Check API Route
 * 
 * Provides system health and status information for monitoring
 * and debugging purposes.
 */

import { Router, Request, Response } from 'express';
import { getCacheStats } from '../services/dexScreenerApi';
import { getWebSocketStats } from '../websocket/socketHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/health
 * 
 * Basic health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptime,
      human: formatUptime(uptime)
    },
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024),
      total: Math.round(memory.heapTotal / 1024 / 1024),
      external: Math.round(memory.external / 1024 / 1024),
      rss: Math.round(memory.rss / 1024 / 1024)
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/health/detailed
 * 
 * Detailed health check with WebSocket and cache statistics
 */
router.get('/detailed', (req: Request, res: Response) => {
  try {
    const wsStats = getWebSocketStats();
    const cacheStats = getCacheStats();
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: {
        uptime: {
          seconds: uptime,
          human: formatUptime(uptime)
        },
        memory: {
          used: Math.round(memory.heapUsed / 1024 / 1024),
          total: Math.round(memory.heapTotal / 1024 / 1024),
          external: Math.round(memory.external / 1024 / 1024),
          rss: Math.round(memory.rss / 1024 / 1024)
        },
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid
      },
      websocket: wsStats,
      cache: cacheStats,
      configuration: {
        port: process.env.PORT || 3002,
        updateInterval: process.env.WEBSOCKET_UPDATE_INTERVAL || '2000',
        maxConnections: process.env.MAX_CONNECTIONS_PER_IP || '10'
      }
    });
    
  } catch (error) {
    logger.error('❌ Health check error:', error);
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to gather system statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Format uptime in seconds to human-readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export { router as healthRouter };
