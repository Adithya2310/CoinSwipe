# CoinSwipe Node.js Backend Server

A dedicated Node.js server for CoinSwipe providing real-time cryptocurrency price updates via WebSocket connections and REST API endpoints for trending tokens.

## 🏗️ **Architecture Overview**

### **WebSocket Architecture** (Per User Requirements)

1. **User gets a coin** → Frontend subscribes to token price updates
2. **Server emits price updates** every 2 seconds ONLY for subscribed tokens
3. **User swipes** → Old subscription closed, new subscription opened

### **Key Features**

- ✅ **Per-token subscriptions** - Only fetch prices for viewed tokens
- ✅ **Real-time updates** - 2-second price update intervals
- ✅ **Automatic cleanup** - Removes unused subscriptions
- ✅ **Memory efficient** - Smart resource management
- ✅ **Base network focused** - Dedicated to Base blockchain
- ✅ **Rate limiting** - Respects external API limits
- ✅ **Comprehensive logging** - Detailed monitoring and debugging

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 16+ 
- npm or yarn
- Running on port 3002 (configurable)

### **Installation**
```bash
cd server
npm install
```

### **Development**
```bash
# Start development server with auto-reload
npm run dev
```

### **Production**
```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## 📡 **API Endpoints**

### **REST API**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Server status and info |
| `/api/health` | GET | Basic health check |
| `/api/health/detailed` | GET | Detailed system statistics |
| `/api/trending` | GET | Trending tokens from Base network |
| `/api/trending/stats` | GET | Cache statistics |
| `/api/trending/refresh` | POST | Manual cache refresh |

### **WebSocket Events**

#### **Client → Server**
```typescript
// Subscribe to token price updates
socket.emit('subscribe', pairAddress: string);

// Unsubscribe from token
socket.emit('unsubscribe', pairAddress: string);
```

#### **Server → Client**
```typescript
// Connection confirmation
socket.on('connected', (data) => {
  // { message: string, timestamp: number }
});

// Subscription confirmation
socket.on('subscribed', (data) => {
  // { pairAddress: string, message: string, timestamp: number }
});

// Price update (every 2 seconds)
socket.on('priceUpdate', (data) => {
  // { pairAddress: string, priceUsd: string, priceChange24h: number, timestamp: number, change: 'increase'|'decrease'|'unchanged' }
});

// Unsubscription confirmation
socket.on('unsubscribed', (data) => {
  // { pairAddress: string, timestamp: number }
});

// Error handling
socket.on('error', (message: string) => {
  // Error message
});
```

## ⚙️ **Configuration**

### **Environment Variables**

Create a `.env` file in the server directory:

```bash
# Server Configuration
PORT=3002
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# WebSocket Configuration
WEBSOCKET_UPDATE_INTERVAL=2000
MAX_CONNECTIONS_PER_IP=10

# Cache Configuration
TRENDING_CACHE_DURATION=20000

# Logging
LOG_LEVEL=info
```

### **Available Log Levels**
- `error` - Only errors
- `warn` - Warnings and errors
- `info` - General information (default)
- `debug` - Verbose debugging information

## 🧪 **Testing**

### **Run Tests**
```bash
npm test
```

### **Test WebSocket Connection**
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3002');

socket.on('connected', (data) => {
  console.log('Connected:', data);
  
  // Subscribe to a token
  socket.emit('subscribe', '0x1234567890123456789012345678901234567890');
});

socket.on('priceUpdate', (update) => {
  console.log('Price update:', update);
});
```

### **Test REST API**
```bash
# Get trending tokens
curl http://localhost:3002/api/trending

# Health check
curl http://localhost:3002/api/health

# Detailed health
curl http://localhost:3002/api/health/detailed
```

## 📊 **Monitoring**

### **Health Endpoints**

#### **Basic Health Check**
```bash
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": { "seconds": 3600, "human": "1h 0m 0s" },
  "memory": { "used": 45, "total": 128, "external": 2, "rss": 67 },
  "environment": "development"
}
```

#### **Detailed Statistics**
```bash
GET /api/health/detailed
```

Includes WebSocket connection stats, cache statistics, and configuration details.

### **WebSocket Statistics**

Monitor active connections and subscriptions:
- Total connections
- Unique IP addresses
- Active subscriptions per token
- Subscription uptime and fetch counts

### **Cache Statistics**

Monitor API cache performance:
- Cache hit/miss rates
- Cache size and age
- Automatic refresh status

## 🔧 **Development**

### **Code Structure**

```
server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── routes/               # REST API routes
│   │   ├── trending.ts       # Trending tokens endpoint
│   │   └── health.ts         # Health check endpoints
│   ├── websocket/            # WebSocket implementation
│   │   ├── socketHandler.ts  # WebSocket event handlers
│   │   └── subscriptionManager.ts # Subscription management
│   ├── services/             # External API services
│   │   └── dexScreenerApi.ts # DexScreener integration
│   ├── utils/                # Utility functions
│   │   ├── logger.ts         # Logging utility
│   │   └── validation.ts     # Input validation
│   └── middleware/           # Express middleware
│       └── errorHandler.ts   # Error handling
├── dist/                     # Compiled JavaScript (generated)
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md               # This file
```

### **Key Classes**

#### **PriceSubscriptionManager**
Manages all token subscriptions and price updates:
- Tracks active subscriptions per token
- Starts/stops price fetching based on demand
- Emits updates only when prices change
- Automatic cleanup of unused subscriptions

#### **WebSocket Handler**
Manages WebSocket connections:
- Connection rate limiting
- Event routing (subscribe/unsubscribe)
- Client tracking and cleanup
- Error handling and logging

#### **DexScreener API Service**
Handles external API communication:
- Trending tokens fetching
- Individual token price fetching
- Rate limiting and caching
- Error handling and retries

### **Debugging**

#### **Enable Debug Logging**
```bash
LOG_LEVEL=debug npm run dev
```

#### **Monitor WebSocket Events**
```bash
# Watch server logs for WebSocket activity
tail -f server.log | grep "🔌\|📊\|💰"
```

#### **Check Subscription Status**
```bash
curl http://localhost:3002/api/health/detailed | jq '.websocket'
```

## 🚀 **Deployment**

### **Production Build**
```bash
npm run build
npm start
```

### **Environment Setup**
- Set `NODE_ENV=production`
- Configure proper CORS origins
- Set up process manager (PM2, systemd)
- Configure reverse proxy (nginx)
- Set up monitoring and logging

### **Performance Recommendations**
- Use clustering for multiple CPU cores
- Configure load balancing for high traffic
- Set up Redis for distributed caching
- Monitor memory usage and connection counts

## 🐛 **Troubleshooting**

### **Common Issues**

#### **WebSocket Connection Fails**
- Check CORS configuration
- Verify port 3002 is accessible
- Check firewall settings
- Review connection logs

#### **No Price Updates**
- Verify DexScreener API connectivity
- Check subscription logs
- Ensure valid token addresses
- Review rate limiting settings

#### **High Memory Usage**
- Monitor subscription cleanup
- Check for memory leaks in logs
- Review connection limits
- Consider restarting server periodically

### **Useful Commands**

```bash
# Check server status
curl http://localhost:3002/api/health

# Monitor real-time logs
npm run dev | grep -E "🔌|📊|💰|❌"

# Test WebSocket connection
node -e "const io=require('socket.io-client'); const s=io('http://localhost:3002'); s.on('connected',d=>console.log('OK',d));"

# Force cache refresh
curl -X POST http://localhost:3002/api/trending/refresh
```

## 📋 **TODO / Future Enhancements**

- [ ] Add Redis for distributed caching
- [ ] Implement connection clustering
- [ ] Add metrics collection (Prometheus)
- [ ] Create Docker containers
- [ ] Add automated testing suite
- [ ] Implement circuit breakers for external APIs
- [ ] Add GraphQL endpoint
- [ ] Create admin dashboard

---

*This server is specifically designed for the CoinSwipe application with optimized WebSocket performance and Base network integration.*
