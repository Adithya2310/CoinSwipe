"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { realTimeService, TrendingToken, PriceUpdate } from '../services/realTimeService';


interface TrendingSwipePageProps {
  onNavigate: (page: string) => void;
  onTokenPurchase: (token: any, amount: number) => void;
  buyAmount: number;
  onUpdateDefaultAmount: (amount: number) => void;
  hasDefaultAmount?: boolean;
}

const TrendingSwipePage: React.FC<TrendingSwipePageProps> = ({ onNavigate, onTokenPurchase, buyAmount, onUpdateDefaultAmount, hasDefaultAmount = true }) => {
  // Wallet integration
  const { address } = useAccount();
  const { data: balance, isLoading: balanceLoading } = useBalance({ address });
  
  // State management
  const [currentToken, setCurrentToken] = useState<any>(null);
  const [nextToken, setNextToken] = useState<any>(null); // Preload next token
  const [loading, setLoading] = useState(true);
  const [swipeLoading, setSwipeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showCopyToast, setShowCopyToast] = useState(false);
  // Removed default amount modal - users can set amount in portfolio page
  
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

        // Initialize connection (using mock data for testing)
        await realTimeService.initializeConnection();
        setConnected(true);

        // Fetch trending tokens (hardcoded Base network tokens)
        await realTimeService.fetchTrendingTokens();

        // Get first token
        const firstToken = realTimeService.getNextToken();
        if (firstToken) {
          const uiToken = realTimeService.transformTokenForUI(firstToken);
          setCurrentToken(uiToken);
          
          // Subscribe to price updates
          subscribeToCurrentToken(firstToken.pairAddress);
          
          // Preload next token for smooth swipes
          preloadNextToken();
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
   * Preload Next Token
   * 
   * Preloads the next token for smooth transitions
   */
  const preloadNextToken = () => {
    const nextTokenData = realTimeService.getNextToken();
    if (nextTokenData) {
      const uiToken = realTimeService.transformTokenForUI(nextTokenData);
      setNextToken(uiToken);
    } else {
      // Refresh tokens if needed
      realTimeService.refreshTokens().then(() => {
        const refreshedToken = realTimeService.getNextToken();
        if (refreshedToken) {
          const uiToken = realTimeService.transformTokenForUI(refreshedToken);
          setNextToken(uiToken);
        }
      });
    }
  };

  /**
   * Load Next Token and Switch Subscription
   * 
   * When user swipes, this function:
   * 1. Uses preloaded token for immediate display
   * 2. Switches WebSocket subscription (old closed, new opened)
   * 3. Preloads the next token for future swipes
   */
  const loadNextToken = () => {
    console.log('👆 User swiped - loading next token...');
    
    if (swipeLoading) return; // Prevent multiple rapid swipes
    
    setSwipeLoading(true);
    
    // Mark current subscription as inactive
    isSubscriptionActive.current = false;
    
    if (nextToken) {
      console.log(`🔄 Switching to token: ${nextToken.symbol} (${nextToken.pairAddress})`);
      
      // Use preloaded token for immediate display
      setCurrentToken(nextToken);
      
      // Switch WebSocket subscription (architecture requirement)
      subscribeToCurrentToken(nextToken.pairAddress);
      
      // Preload next token for future swipes
      preloadNextToken();
    } else {
      console.log('📝 No preloaded token, fetching new one...');
      
      const freshToken = realTimeService.getNextToken();
      if (freshToken) {
        const uiToken = realTimeService.transformTokenForUI(freshToken);
        setCurrentToken(uiToken);
        subscribeToCurrentToken(freshToken.pairAddress);
        preloadNextToken();
      } else {
        // Refresh the entire list
        realTimeService.refreshTokens().then(() => {
          const firstToken = realTimeService.getNextToken();
          if (firstToken) {
            const uiToken = realTimeService.transformTokenForUI(firstToken);
            setCurrentToken(uiToken);
            subscribeToCurrentToken(firstToken.pairAddress);
            preloadNextToken();
          }
        });
      }
    }
    
    // Reset swipe loading after a short delay
    setTimeout(() => setSwipeLoading(false), 300);
  };

  // Handle swipe actions
  const handleSwipeLeft = () => {
    // Skip token
    loadNextToken();
  };

  const handleSwipeRight = () => {
    // Buy token
    const walletBalance = getWalletBalance();
    if (currentToken && walletBalance >= buyAmount) {
      onTokenPurchase(currentToken, buyAmount);
      setToastMessage(`Successfully bought $${buyAmount.toFixed(2)} of ${currentToken.name}!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
      // Load next token
      loadNextToken();
    } else {
      setToastMessage(`Insufficient balance. You need at least $${buyAmount.toFixed(2)}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const getWalletBalance = () => {
    if (balanceLoading || !balance) return 0;
    // For simplicity, we'll treat 1 ETH = $3000 (you can integrate a price API later)
    const balanceInEth = parseFloat(formatUnits(balance.value, balance.decimals));
    return balanceInEth * 3000; // Rough ETH to USD conversion
  };

  const formatWalletBalance = () => {
    if (balanceLoading) return 'Loading...';
    if (!balance) return '$0.00';
    
    const balanceValue = parseFloat(formatUnits(balance.value, balance.decimals));
    const usdValue = balanceValue * 3000; // Rough conversion
    return `$${usdValue.toFixed(2)}`;
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
    const rotation = cardOffset * 0.05; // Reduced rotation for more subtle effect
    const scale = Math.max(0.95, 1 - Math.abs(cardOffset) * 0.0005); // Slight scale effect
    
    return {
      transform: `translateX(${cardOffset}px) rotate(${rotation}deg) scale(${scale})`,
      transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      zIndex: isDragging ? 10 : 1,
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
            {/* Token Header - Compact */}
            <div className="token-header-compact">
              <div className="token-icon-compact" style={{ backgroundColor: currentToken.color }}>
                {currentToken.imageUrl ? (
                  <img src={currentToken.imageUrl} alt={currentToken.symbol} className="token-image-compact" />
                ) : (
                  <span className="token-emoji-compact">{currentToken.icon}</span>
                )}
              </div>
              
              <div className="token-info-compact">
                <h2 className="token-name-compact" title={currentToken.name}>
                  {currentToken.name}
                </h2>
                <p className="token-symbol-compact" title={currentToken.symbol}>
                  {currentToken.symbol}
                </p>
                <div className={`trust-badge-compact ${currentToken.trustLevel}`}>
                  <span className="trust-icon">
                    {currentToken.trustLevel === 'high' && '🟢'}
                    {currentToken.trustLevel === 'medium' && '🟡'}
                    {currentToken.trustLevel === 'low' && '🔴'}
                  </span>
                  {currentToken.trustLevel === 'high' && 'High Trust'}
                  {currentToken.trustLevel === 'medium' && 'Medium Trust'}
                  {currentToken.trustLevel === 'low' && 'Low Trust'}
                </div>
              </div>
            </div>

            {/* Price Section - Compact */}
            <div className="price-section-compact">
              <div className="price-main">
                <div className="token-price-compact">{formatPrice(currentToken.price)}</div>
                <div className={`price-change-compact ${currentToken.priceChange24h >= 0 ? 'positive' : 'negative'}`}>
                  <span className="change-arrow">{currentToken.priceChange24h >= 0 ? '↗' : '↘'}</span>
                  <span className="change-percentage">{Math.abs(currentToken.priceChange24h).toFixed(2)}%</span>
                </div>
              </div>
              <span className="price-label">24HR CHANGE</span>
            </div>

            {/* Stats Grid - Compact */}
            <div className="stats-grid-compact">
              <div className="stat-item-compact">
                <div className="stat-label-compact">Liquidity</div>
                <div className="stat-value-compact">{formatLargeNumber(currentToken.liquidity)}</div>
              </div>
              <div className="stat-item-compact">
                <div className="stat-label-compact">Market Cap</div>
                <div className="stat-value-compact">{formatLargeNumber(currentToken.marketCap)}</div>
              </div>
              <div className="stat-item-compact">
                <div className="stat-label-compact">FDV</div>
                <div className="stat-value-compact">{formatLargeNumber(currentToken.fdv || 0)}</div>
              </div>
              <div className="stat-item-compact">
                <div className="stat-label-compact">Created</div>
                <div className="stat-value-compact">28/6/56906</div>
              </div>
            </div>

            {/* Token Address - Compact */}
            <div className="contract-address-compact">
              <span className="address-label-compact">CONTRACT ADDRESS</span>
              <div className="address-container-compact">
                <span className="address-text-compact">
                  {currentToken.pairAddress ? 
                    `${currentToken.pairAddress.slice(0, 6)}...${currentToken.pairAddress.slice(-4)}` : 
                    'Loading...'
                  }
                </span>
                <button 
                  className="copy-button-compact"
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

            {/* Action Buttons - New */}
            <div className="action-buttons-compact">
              <button className="action-btn-compact website-btn">
                🌐 Website
              </button>
              <button className="action-btn-compact dexscreener-btn">
                📊 DexScreener
              </button>
            </div>
            
            {/* Live Indicator - Compact */}
            <div className="live-indicator-compact">
              <span className="live-dot-compact"></span>
              <span className="live-text-compact">REAL-TIME</span>
            </div>

            {/* Loading Overlay for Swipes */}
            {swipeLoading && (
              <div className="swipe-loading-overlay">
                <div className="swipe-loading-spinner"></div>
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
};

export default TrendingSwipePage;
