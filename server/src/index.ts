/**
 * CoinSwipe Backend Server
 * 
 * Main entry point for the CoinSwipe Node.js backend server.
 * Provides REST API endpoints for trending tokens and WebSocket
 * connections for real-time price updates.
 * 
 * Architecture:
 * - Express.js server for REST API endpoints
 * - Socket.IO for WebSocket connections
 * - Per-token price subscription system
 * - Automatic cleanup of unused subscriptions
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import route handlers
import { trendingRouter } from './routes/trending';
import { healthRouter } from './routes/health';

// Import WebSocket handler
import { initializeWebSocket } from './websocket/socketHandler';

// Import utilities
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

/**
 * Server Configuration
 */
const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

/**
 * Initialize Express Application
 */
const app = express();
const server = createServer(app);

/**
 * Security Middleware
 */
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow WebSocket connections
  contentSecurityPolicy: false     // Allow Socket.IO
}));

/**
 * CORS Configuration
 * Allow connections from the Next.js frontend
 */
app.use(cors({
  origin: CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/**
 * Request Logging
 */
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

/**
 * Body Parsing Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * API Routes
 */
app.use('/api/health', healthRouter);      // Health check endpoint
app.use('/api/trending', trendingRouter);  // Trending tokens endpoint

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    message: 'CoinSwipe Backend Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      trending: '/api/trending',
      websocket: '/socket.io'
    }
  });
});

/**
 * Initialize Socket.IO Server
 * 
 * Socket.IO is configured to handle WebSocket connections
 * for real-time price updates with the following features:
 * 
 * 1. Per-token subscriptions
 * 2. Automatic cleanup of unused subscriptions
 * 3. Rate limiting and connection management
 * 4. Cross-origin support for frontend integration
 */
const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGIN.split(','),
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

/**
 * Initialize WebSocket Event Handlers
 * 
 * This sets up all WebSocket event listeners and
 * the subscription management system
 */
initializeWebSocket(io);

/**
 * Error Handling Middleware
 * Must be last middleware to catch all errors
 */
app.use(errorHandler);

/**
 * Handle 404 errors
 */
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/trending',
      'WebSocket /socket.io'
    ]
  });
});

/**
 * Graceful Shutdown Handler
 * 
 * Properly close server and clean up resources
 * when the process is terminated
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

/**
 * Start the Server
 */
server.listen(PORT, () => {
  logger.info(`🚀 CoinSwipe Server started on port ${PORT}`);
  logger.info(`📊 Environment: ${NODE_ENV}`);
  logger.info(`🌐 CORS Origin: ${CORS_ORIGIN}`);
  logger.info(`🔌 WebSocket endpoint: ws://localhost:${PORT}/socket.io`);
  logger.info(`📡 API endpoint: http://localhost:${PORT}/api`);
  
  if (NODE_ENV === 'development') {
    logger.info('🛠️  Development mode: Verbose logging enabled');
  }
});

// Export for testing
export { app, server, io };
