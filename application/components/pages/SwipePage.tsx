"use client";

import React, { useState, useEffect, useRef } from 'react';
import { liveDataService, mockUserBalance, defaultBuyAmount, Token, Category } from '../data/liveData';

interface SwipePageProps {
  categoryId: string;
  onNavigate: (page: string) => void;
  onTokenPurchase: (token: Token, amount: number) => void;
}

const SwipePage: React.FC<SwipePageProps> = ({ categoryId, onNavigate, onTokenPurchase }) => {
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);
  const [balance, setBalance] = useState(mockUserBalance);
  const [buyAmount, setBuyAmount] = useState(defaultBuyAmount);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showCopyToast, setShowCopyToast] = useState(false);
  
  // Live data state
  const [category, setCategory] = useState<Category | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentToken, setCurrentToken] = useState<Token | null>(null);
  
  // Touch/Swipe state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [cardOffset, setCardOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Load category data and set up real-time updates
  useEffect(() => {
    const loadCategoryData = async () => {
      setLoading(true);
      try {
        // Get category info
        const categories = await liveDataService.getCategories();
        const foundCategory = categories.find(c => c.id === categoryId);
        
        if (foundCategory) {
          setCategory(foundCategory);
          setTokens(foundCategory.tokens);
          setCurrentToken(foundCategory.tokens[0] || null);
          
          // Start real-time price updates for these tokens
          if (foundCategory.tokens.length > 0) {
            await liveDataService.startPriceUpdates(foundCategory.tokens, 3000); // Update every 3 seconds
          }
        }
      } catch (error) {
        console.error('Error loading category data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategoryData();

    // Cleanup function
    return () => {
      liveDataService.stopAllPriceUpdates();
    };
  }, [categoryId]);

  // Update current token when index changes
  useEffect(() => {
    if (tokens.length > 0 && currentTokenIndex < tokens.length) {
      setCurrentToken(tokens[currentTokenIndex]);
    }
  }, [currentTokenIndex, tokens]);

  // Subscribe to price updates
  useEffect(() => {
    const unsubscribe = liveDataService.subscribeToUpdates((tokenId: string, newPrice: number, priceChange24h: number) => {
      // Update the token in our state
      setTokens(prevTokens => 
        prevTokens.map(token => 
          token.id === tokenId || token.pairAddress === tokenId
            ? { ...token, price: newPrice, priceChange24h }
            : token
        )
      );

      // Update current token if it's the one being updated
      setCurrentToken(prevToken => {
        if (prevToken && (prevToken.id === tokenId || prevToken.pairAddress === tokenId)) {
          return { ...prevToken, price: newPrice, priceChange24h };
        }
        return prevToken;
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const showSuccessToast = (tokenName: string, newBalance: number) => {
    setToastMessage(`Successfully swapped $${buyAmount.toFixed(2)} for ${tokenName}. New balance: $${newBalance.toFixed(2)}`);
    setShowToast(true);
  };

  const handleSwipeLeft = () => {
    // Skip token
    if (currentTokenIndex < tokens.length - 1) {
      setCurrentTokenIndex(prev => prev + 1);
    } else {
      // No more tokens, go back to categories
      onNavigate('categories');
    }
  };

  const handleSwipeRight = () => {
    // Buy token
    if (currentToken && balance >= buyAmount) {
      const newBalance = balance - buyAmount;
      setBalance(newBalance);
      onTokenPurchase(currentToken, buyAmount);
      showSuccessToast(currentToken.name, newBalance);
      
      // Move to next token
      if (currentTokenIndex < tokens.length - 1) {
        setCurrentTokenIndex(prev => prev + 1);
      } else {
        // No more tokens, go back to categories
        onNavigate('categories');
      }
    }
  };

  const handleBackToCategories = () => {
    onNavigate('categories');
  };

  // Touch/Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const clientX = e.touches[0].clientX;
    setCurrentX(clientX);
    const offset = clientX - startX;
    setCardOffset(offset);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const offset = currentX - startX;
    const threshold = 100; // Minimum swipe distance
    
    if (Math.abs(offset) > threshold) {
      if (offset > 0) {
        // Swipe right - buy
        handleSwipeRight();
      } else {
        // Swipe left - skip
        handleSwipeLeft();
      }
    }
    
    // Reset swipe state
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
    const offset = e.clientX - startX;
    setCardOffset(offset);
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
    const rotation = cardOffset * 0.1; // Subtle rotation
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

  if (loading) {
    return (
      <div className="swipe-page">
        <div className="swipe-header">
          <button className="back-btn" onClick={handleBackToCategories}>
            ←
          </button>
        </div>
        <div className="swipe-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading live data from Base network...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!category || tokens.length === 0) {
    return (
      <div className="swipe-page">
        <div className="swipe-header">
          <button className="back-btn" onClick={handleBackToCategories}>
            ←
          </button>
        </div>
        <div className="swipe-container">
          <p>No tokens found in this category.</p>
          <button className="retry-btn" onClick={() => window.location.reload()}>
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  if (currentTokenIndex >= tokens.length) {
    return (
      <div className="swipe-page">
        <div className="swipe-header">
          <button className="back-btn" onClick={handleBackToCategories}>
            ← Back to Categories
          </button>
        </div>
        <div className="swipe-container">
          <p>You&apos;ve seen all tokens in this category!</p>
          <button className="portfolio-btn" onClick={() => onNavigate('categories')}>
            Explore More Categories
          </button>
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

      {/* Copy Toast Notification */}
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
        <button className="back-btn" onClick={handleBackToCategories}>
          ← 
        </button>
        <h1 className="swipe-title">{category.name}</h1>
        {/* <div className="swipe-stats">
          <div className="stat-item">Amount: ${buyAmount.toFixed(2)}</div>
          <div className="stat-item">Balance: ${balance.toFixed(2)}</div>
        </div> */}  
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
            onMouseLeave={handleMouseUp} // Handle mouse leaving the card area
          >
            {currentToken && (
              <>
                {/* Token Icon and Header */}
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
                {/* <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-label-large">Liquidity</div>
                    <div className="stat-value-large">{formatLargeNumber(currentToken.liquidity)}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label-large">Market Cap</div>
                    <div className="stat-value-large">{formatLargeNumber(currentToken.marketCap)}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label-large">FDV</div>
                    <div className="stat-value-large">{formatLargeNumber(currentToken.fdv)}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label-large">DEX</div>
                    <div className="stat-value-large">{currentToken.dexId || 'Unknown'}</div>
                  </div>
                </div> */}
                
                {/* Live Indicator */}
                {/* <div className="live-indicator-new">
                  <span className="live-dot"></span>
                  <span className="live-text">LIVE DATA</span>
                </div> */}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwipePage;