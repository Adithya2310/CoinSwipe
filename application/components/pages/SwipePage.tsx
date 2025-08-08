"use client";

import React, { useState, useEffect, useRef } from 'react';
import { categories, mockUserBalance, defaultBuyAmount, Token } from '../data/mockData';

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
  
  // Touch/Swipe state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [cardOffset, setCardOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const category = categories.find(c => c.id === categoryId);
  const tokens = category?.tokens || [];
  const currentToken = tokens[currentTokenIndex];

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
      {/* Toast Notification */}
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

      {/* Header */}
      <div className="swipe-header">
        <button className="back-btn" onClick={handleBackToCategories}>
          ← 
        </button>
        <h1 className="swipe-title">{category.name}</h1>
        <div className="swipe-stats">
          <div className="stat-item">Amount: ${buyAmount.toFixed(2)}</div>
          <div className="stat-item">Balance: ${balance.toFixed(2)}</div>
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
            onMouseLeave={handleMouseUp} // Handle mouse leaving the card area
          >
            <div className="token-icon" style={{ backgroundColor: currentToken.color }}>
              {currentToken.icon}
            </div>
          
          <h2 className="token-name">{currentToken.name}</h2>
          <p className="token-symbol">{currentToken.symbol}</p>
          
          <div className={`trust-badge ${currentToken.trustLevel}`}>
            {currentToken.trustLevel === 'high' && '● High Trust'}
            {currentToken.trustLevel === 'medium' && '● Medium Trust'}
            {currentToken.trustLevel === 'low' && '● Low Trust'}
          </div>
          
          <div className="token-price">{formatPrice(currentToken.price)}</div>
          <div className={`price-change ${currentToken.priceChange24h >= 0 ? 'positive' : 'negative'}`}>
            {currentToken.priceChange24h >= 0 ? '↗' : '↘'} {Math.abs(currentToken.priceChange24h).toFixed(2)}%
          </div>
          
          <div className="token-stats">
            <div className="stat-group">
              <div className="stat-label">Liquidity</div>
              <div className="stat-value">{formatLargeNumber(currentToken.liquidity)}</div>
            </div>
            <div className="stat-group">
              <div className="stat-label">Market Cap</div>
              <div className="stat-value">{formatLargeNumber(currentToken.marketCap)}</div>
            </div>
          </div>
          
            <div className="fdv-stat">
              <div className="stat-label">FDV</div>
              <div className="stat-value">{formatLargeNumber(currentToken.fdv)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwipePage;