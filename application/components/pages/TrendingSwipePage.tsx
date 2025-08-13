"use client";

import React, { useState, useEffect, useRef } from 'react';
import { realTimeService, TrendingToken, PriceUpdate } from '../services/realTimeService';

interface TrendingSwipePageProps {
  onNavigate: (page: string) => void;
  onTokenPurchase: (token: any, amount: number) => void;
}

const TrendingSwipePage: React.FC<TrendingSwipePageProps> = ({ onNavigate, onTokenPurchase }) => {
  // State management
  const [currentToken, setCurrentToken] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [balance] = useState(129.00); // Static for now
  const [buyAmount] = useState(1.00); // Static for now
  
  // Touch/Swipe state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [cardOffset, setCardOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Refs for cleanup and current subscription tracking
  const priceUpdateUnsubscribe = useRef<(() => void) | null>(null);
  const currentSubscribedToken = useRef<string | null>(null);
  const isSubscriptionActive = useRef<boolean>(false);

  // Initialize service and load first token
  useEffect(() => {
    const initializeService = async () => {
      try {
        setLoading(true);
        setError(null);

        // Initialize connection
        await realTimeService.initializeConnection();
        setConnected(true);

        // Fetch trending tokens
        await realTimeService.fetchTrendingTokens();

        // Get first token
        const firstToken = realTimeService.getNextToken();
        if (firstToken) {
          const uiToken = realTimeService.transformTokenForUI(firstToken);
          setCurrentToken(uiToken);
          
          // Subscribe to price updates
          subscribeToCurrentToken(firstToken.pairAddress);
        } else {
          setError('No trending tokens available');
        }

      } catch (err) {
        console.error('Failed to initialize real-time service:', err);
        setError('Failed to connect to real-time data');
      } finally {
        setLoading(false);
      }
    };

    initializeService();

    // Cleanup on unmount
    return () => {
      if (priceUpdateUnsubscribe.current) {
        priceUpdateUnsubscribe.current();
      }
      if (currentSubscribedToken.current) {
        realTimeService.unsubscribeFromToken(currentSubscribedToken.current);
      }
      realTimeService.disconnect();
    };
  }, []);

  /**
   * Subscribe to Price Updates for Current Token
   * 
   * Implements the WebSocket architecture:
   * 1. Unsubscribe from previous token (close old connection)
   * 2. Subscribe to new token (open new connection)
   * 3. Server will emit price updates every 2 seconds for this token only
   * 
   * @param pairAddress - Token pair address to subscribe to
   */
  const subscribeToCurrentToken = (pairAddress: string) => {
    console.log(`🔄 Switching subscription: ${currentSubscribedToken.current} → ${pairAddress}`);

    // Step 1: Unsubscribe from previous token (close old WebSocket connection)
    if (currentSubscribedToken.current && isSubscriptionActive.current) {
      console.log(`📤 Unsubscribing from previous token: ${currentSubscribedToken.current}`);
      realTimeService.unsubscribeFromToken(currentSubscribedToken.current);
    }

    // Step 2: Clean up previous price update subscription
    if (priceUpdateUnsubscribe.current) {
      priceUpdateUnsubscribe.current();
    }

    // Step 3: Subscribe to new token (open new WebSocket connection)
    console.log(`📥 Subscribing to new token: ${pairAddress}`);
    realTimeService.subscribeToToken(pairAddress);
    currentSubscribedToken.current = pairAddress;
    isSubscriptionActive.current = true;

    // Step 4: Register for real-time price updates (every 2 seconds from server)
    priceUpdateUnsubscribe.current = realTimeService.onPriceUpdate((update: PriceUpdate) => {
      // Only process updates for the currently subscribed token
      if (update.pairAddress === pairAddress && isSubscriptionActive.current) {
        console.log(`💰 Price update received for ${pairAddress}: $${update.priceUsd}`);
        
        setCurrentToken((prev: any) => {
          if (!prev || prev.pairAddress !== pairAddress) return prev;
          
          return {
            ...prev,
            price: parseFloat(update.priceUsd),
            priceChange24h: update.priceChange24h
          };
        });
      }
    });

    console.log(`✅ Subscription active for ${pairAddress}`);
  };

  /**
   * Load Next Token and Switch Subscription
   * 
   * When user swipes, this function:
   * 1. Gets the next token from the trending list
   * 2. Displays it immediately (no loading)
   * 3. Switches WebSocket subscription (old closed, new opened)
   * 4. Server starts sending price updates for new token only
   */
  const loadNextToken = () => {
    console.log('👆 User swiped - loading next token...');
    
    // Mark current subscription as inactive
    isSubscriptionActive.current = false;
    
    const nextToken = realTimeService.getNextToken();
    if (nextToken) {
      console.log(`🔄 Switching to token: ${nextToken.baseToken.symbol} (${nextToken.pairAddress})`);
      
      // Display new token immediately (no loading screen)
      const uiToken = realTimeService.transformTokenForUI(nextToken);
      setCurrentToken(uiToken);
      
      // Switch WebSocket subscription (architecture requirement)
      subscribeToCurrentToken(nextToken.pairAddress);
    } else {
      console.log('📝 No more tokens, refreshing list...');
      
      // If no more tokens, refresh the list and get first token
      realTimeService.refreshTokens().then(() => {
        const firstToken = realTimeService.getNextToken();
        if (firstToken) {
          console.log(`🔄 Refreshed - switching to: ${firstToken.baseToken.symbol}`);
          
          const uiToken = realTimeService.transformTokenForUI(firstToken);
          setCurrentToken(uiToken);
          subscribeToCurrentToken(firstToken.pairAddress);
        }
      });
    }
  };

  // Handle swipe actions
  const handleSwipeLeft = () => {
    // Skip token
    loadNextToken();
  };

  const handleSwipeRight = () => {
    // Buy token
    if (currentToken && balance >= buyAmount) {
      onTokenPurchase(currentToken, buyAmount);
      setToastMessage(`Successfully bought $${buyAmount.toFixed(2)} of ${currentToken.name}!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
      // Load next token
      loadNextToken();
    }
  };

  // Touch/Swipe handlers (same as before)
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = e.touches[0].clientX;
    setCurrentX(clientX);
    setCardOffset(clientX - startX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    const offset = currentX - startX;
    const threshold = 100;
    
    if (Math.abs(offset) > threshold) {
      if (offset > 0) {
        handleSwipeRight();
      } else {
        handleSwipeLeft();
      }
    }
    
    setIsDragging(false);
    setCardOffset(0);
    setStartX(0);
    setCurrentX(0);
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setCurrentX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCurrentX(e.clientX);
    setCardOffset(e.clientX - startX);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    const offset = currentX - startX;
    const threshold = 100;
    
    if (Math.abs(offset) > threshold) {
      if (offset > 0) {
        handleSwipeRight();
      } else {
        handleSwipeLeft();
      }
    }
    
    setIsDragging(false);
    setCardOffset(0);
    setStartX(0);
    setCurrentX(0);
  };

  const getCardStyle = () => {
    const rotation = cardOffset * 0.1;
    const opacity = Math.max(0.7, 1 - Math.abs(cardOffset) * 0.002);
    
    return {
      transform: `translateX(${cardOffset}px) rotate(${rotation}deg)`,
      opacity: opacity,
      transition: isDragging ? 'none' : 'all 0.3s ease',
    };
  };

  const getSwipeIndicator = () => {
    if (Math.abs(cardOffset) < 50) return null;
    
    if (cardOffset > 50) {
      return (
        <div className="swipe-indicator buy">
          <span>👍 BUY</span>
        </div>
      );
    } else if (cardOffset < -50) {
      return (
        <div className="swipe-indicator skip">
          <span>👎 SKIP</span>
        </div>
      );
    }
    return null;
  };

  const formatPrice = (price: number) => {
    if (price < 0.000001) {
      return price.toExponential(2);
    }
    return `$${price.toFixed(6)}`;
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toFixed(0)}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="swipe-page">
        <div className="swipe-header">
          <button className="back-btn" onClick={() => onNavigate('landing')}>
            ←
          </button>
        </div>
        <div className="swipe-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Connecting to real-time data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="swipe-page">
        <div className="swipe-header">
          <button className="back-btn" onClick={() => onNavigate('landing')}>
            ←
          </button>
        </div>
        <div className="swipe-container">
          <div className="error-message">
            <p>❌ {error}</p>
            <button className="retry-btn" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No token state
  if (!currentToken) {
    return (
      <div className="swipe-page">
        <div className="swipe-header">
          <button className="back-btn" onClick={() => onNavigate('landing')}>
            ←
          </button>
        </div>
        <div className="swipe-container">
          <p>No more trending tokens available!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="swipe-page">
      {/* Toast Notifications */}
      {showToast && (
        <div className="toast success">
          <div className="toast-content">
            <span className="toast-icon">✅</span>
            <div className="toast-text">
              <div className="toast-title">Token Purchased! 🚀</div>
              <div className="toast-message">{toastMessage}</div>
            </div>
            <button className="toast-close" onClick={() => setShowToast(false)}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* Copy Toast */}
      {showCopyToast && (
        <div className="toast copy-toast">
          <div className="toast-content">
            <span className="toast-icon">📋</span>
            <div className="toast-text">
              <div className="toast-title">Address Copied!</div>
              <div className="toast-message">Contract address copied to clipboard</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="swipe-header">
        <button className="back-btn" onClick={() => onNavigate('landing')}>
          ← 
        </button>
        <h1 className="swipe-title">Trending on Base</h1>
        <div className="swipe-stats">
          <div className="stat-item">Amount: ${buyAmount.toFixed(2)}</div>
          <div className="stat-item">Balance: ${balance.toFixed(2)}</div>
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 LIVE' : '🔴 OFFLINE'}
          </div>
        </div>
      </div>

      {/* Swipe Container */}
      <div className="swipe-container">
        <div className="swipe-instructions">
          <span>👎 Swipe left to skip</span>
          <span>👍 Swipe right to buy</span>
        </div>

        {/* Token Card */}
        <div className="swipe-card-container">
          {getSwipeIndicator()}
          <div 
            ref={cardRef}
            className="swipe-card"
            style={getCardStyle()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Token Header */}
            <div className="token-header">
              <div className="token-icon-large" style={{ backgroundColor: currentToken.color }}>
                {currentToken.imageUrl ? (
                  <img src={currentToken.imageUrl} alt={currentToken.symbol} className="token-image" />
                ) : (
                  <span className="token-emoji">{currentToken.icon}</span>
                )}
              </div>
              
              <div className="token-info">
                <h2 className="token-name-large">{currentToken.name}</h2>
                <p className="token-symbol-large">{currentToken.symbol}</p>
              </div>
              
              <div className={`trust-badge-new ${currentToken.trustLevel}`}>
                {currentToken.trustLevel === 'high' && '🟢 High Trust'}
                {currentToken.trustLevel === 'medium' && '🟡 Medium Trust'}
                {currentToken.trustLevel === 'low' && '🔴 Low Trust'}
              </div>
            </div>

            {/* Price Section */}
            <div className="price-section">
              <div className="token-price-large live-price">{formatPrice(currentToken.price)}</div>
              <div className="price-change-info">
                <span className="change-label">24hr Change</span>
                <div className={`price-change-large ${currentToken.priceChange24h >= 0 ? 'positive' : 'negative'}`}>
                  {currentToken.priceChange24h >= 0 ? '↗' : '↘'} {Math.abs(currentToken.priceChange24h).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Token Address */}
            <div className="token-address-section">
              <div className="address-label">Contract Address</div>
              <div className="address-container">
                <span className="address-text">
                  {currentToken.pairAddress ? 
                    `${currentToken.pairAddress.slice(0, 6)}...${currentToken.pairAddress.slice(-4)}` : 
                    'Loading...'
                  }
                </span>
                <button 
                  className="copy-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentToken.pairAddress) {
                      navigator.clipboard.writeText(currentToken.pairAddress);
                      setShowCopyToast(true);
                      setTimeout(() => setShowCopyToast(false), 2000);
                    }
                  }}
                >
                  📋
                </button>
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label-large">Liquidity</div>
                <div className="stat-value-large">{formatLargeNumber(currentToken.liquidity)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label-large">Market Cap</div>
                <div className="stat-value-large">{formatLargeNumber(currentToken.marketCap)}</div>
              </div>
            </div>
            
            {/* Live Indicator */}
            <div className="live-indicator-new">
              <span className="live-dot"></span>
              <span className="live-text">REAL-TIME</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingSwipePage;
