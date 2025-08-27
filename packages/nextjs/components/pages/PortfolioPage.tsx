"use client";

import React, { useState } from 'react';
import { PortfolioItemUI } from '../../lib/supabase';
import DefaultAmountModal from '../ui/DefaultAmountModal';

type PortfolioItem = PortfolioItemUI;

interface PortfolioPageProps {
  portfolio: PortfolioItem[];
  totalValue: number;
  onDepositClick: () => void;
  onUpdateDefaultAmount?: (amount: number) => void;
  onTokenSell?: (tokenId: string, percentage: number) => Promise<any>;
  currentDefaultAmount?: number;
}

const PortfolioPage: React.FC<PortfolioPageProps> = ({ 
  portfolio, 
  totalValue, 
  onDepositClick, 
  onUpdateDefaultAmount,
  onTokenSell,
  currentDefaultAmount = 0.01 
}) => {
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [sellModalOpen, setSellModalOpen] = useState<string | null>(null);
  const [sellLoading, setSellLoading] = useState<string | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellSuccess, setSellSuccess] = useState<string | null>(null);

  // Handle sell operation with loading states and error handling
  const handleSell = async (tokenId: string, percentage: number) => {
    if (!onTokenSell) return;

    const sellKey = `${tokenId}-${percentage}`;
    setSellLoading(sellKey);
    setSellError(null);
    setSellSuccess(null);

    try {
      await onTokenSell(tokenId, percentage);
      setSellSuccess(`Successfully sold ${percentage}% of your tokens!`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSellSuccess(null), 3000);
    } catch (error: any) {
      console.error('Sell operation failed:', error);
      
      let errorMessage = 'Failed to sell tokens. Please try again.';
      if (error.message?.includes('User rejected')) {
        errorMessage = 'Transaction cancelled by user.';
      } else if (error.message?.includes('insufficient balance')) {
        errorMessage = 'Insufficient token balance.';
      } else if (error.message?.includes('insufficient allowance')) {
        errorMessage = 'Token approval failed.';
      }
      
      setSellError(errorMessage);
      
      // Clear error message after 5 seconds
      setTimeout(() => setSellError(null), 5000);
    } finally {
      setSellLoading(null);
    }
  };

  const formatPrice = (price: number) => {
    if (price < 0.000001) {
      return price.toExponential(2);
    }
    return `$${price.toFixed(6)}`;
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toFixed(0);
  };

  return (
    <div className="portfolio-page">
      {/* Toast Notifications */}
      {sellSuccess && (
        <div className="toast success" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: '#10b981',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          ✅ {sellSuccess}
        </div>
      )}
      
      {sellError && (
        <div className="toast error" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: '#ef4444',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          ❌ {sellError}
        </div>
      )}

      {/* Portfolio Header */}
      <div className="portfolio-header">
        <h1 className="portfolio-title">Your Portfolio</h1>
        <div className="portfolio-value">${totalValue.toFixed(2)}</div>
      </div>

      {/* Settings Section */}
      {onUpdateDefaultAmount && (
        <div className="portfolio-settings">
          <div className="settings-item">
            <div className="settings-info">
              <span className="settings-label">Default Buy Amount</span>
              <span className="settings-value">${currentDefaultAmount.toFixed(2)}</span>
            </div>
            <button 
              className="settings-edit-btn"
              onClick={() => setShowAmountModal(true)}
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Portfolio Items */}
      <div className="portfolio-grid">
        {portfolio.length === 0 ? (
          <div className="portfolio-card">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <h3 style={{ marginBottom: '16px', color: 'var(--text-white)' }}>
                Your portfolio is empty
              </h3>
              <p style={{ color: 'var(--text-gray)', marginBottom: '24px' }}>
                Start swiping to discover and invest in amazing tokens on the Base Network!
              </p>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            </div>
          </div>
        ) : (
          portfolio.map((item) => (
            <div key={item.tokenId} className="portfolio-card">
              <div className="portfolio-item">
                <div 
                  className="portfolio-token-icon"
                  style={{ backgroundColor: item.token.color }}
                >
                  {item.token.icon}
                </div>
                <div className="portfolio-token-info">
                  <div className="portfolio-token-name">{item.token.name}</div>
                  <div className="portfolio-token-symbol">{item.token.symbol}</div>
                </div>
                <div className="portfolio-token-values">
                  <div className="portfolio-token-amount">${item.value.toFixed(2)}</div>
                  <div className={`portfolio-token-change ${item.change >= 0 ? 'positive' : 'negative'}`}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                  </div>
                </div>
              </div>
              
              {/* Additional Token Details */}
              <div style={{ 
                padding: '16px 0', 
                borderTop: '1px solid var(--border-purple)',
                marginTop: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                fontSize: '12px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Amount
                  </div>
                  <div style={{ color: 'var(--text-white)', fontWeight: 600 }}>
                    {formatLargeNumber(item.amount)}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Price
                  </div>
                  <div style={{ color: 'var(--text-white)', fontWeight: 600 }}>
                    {formatPrice(item.token.price)}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Trust
                  </div>
                  <div style={{ 
                    color: item.token.trustLevel === 'high' ? '#10b981' : 
                           item.token.trustLevel === 'medium' ? '#f59e0b' : '#ef4444',
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }}>
                    {item.token.trustLevel}
                  </div>
                </div>
              </div>
              
              {/* Sell Actions */}
              {onTokenSell && (
                <div style={{ 
                  padding: '16px 0 0 0',
                  borderTop: '1px solid var(--border-gray)',
                  marginTop: '16px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px'
                  }}>
                    <button
                      className="sell-btn sell-25"
                      onClick={() => handleSell(item.tokenId, 25)}
                      disabled={sellLoading === `${item.tokenId}-25`}
                    >
                      {sellLoading === `${item.tokenId}-25` ? '...' : 'Sell 25%'}
                    </button>
                    <button
                      className="sell-btn sell-50"
                      onClick={() => handleSell(item.tokenId, 50)}
                      disabled={sellLoading === `${item.tokenId}-50`}
                    >
                      {sellLoading === `${item.tokenId}-50` ? '...' : 'Sell 50%'}
                    </button>
                    <button
                      className="sell-btn sell-75"
                      onClick={() => handleSell(item.tokenId, 75)}
                      disabled={sellLoading === `${item.tokenId}-75`}
                    >
                      {sellLoading === `${item.tokenId}-75` ? '...' : 'Sell 75%'}
                    </button>
                    <button
                      className="sell-btn sell-100"
                      onClick={() => handleSell(item.tokenId, 100)}
                      disabled={sellLoading === `${item.tokenId}-100`}
                    >
                      {sellLoading === `${item.tokenId}-100` ? '...' : 'Sell All'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Portfolio Stats */}
      {portfolio.length > 0 && (
        <div className="portfolio-card" style={{ marginTop: '20px' }}>
          <h3 style={{ 
            color: 'var(--text-white)', 
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            Portfolio Statistics
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                Total Invested
              </div>
              <div style={{ 
                color: 'var(--text-white)', 
                fontSize: '24px',
                fontWeight: 700
              }}>
                ${portfolio.reduce((sum, item) => sum + item.purchasePrice, 0).toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                Total Holdings
              </div>
              <div style={{ 
                color: 'var(--text-white)', 
                fontSize: '24px',
                fontWeight: 700
              }}>
                {portfolio.length} Token{portfolio.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Default Amount Modal */}
      {onUpdateDefaultAmount && (
        <DefaultAmountModal
          isOpen={showAmountModal}
          onClose={() => setShowAmountModal(false)}
          onSetAmount={onUpdateDefaultAmount}
          currentAmount={currentDefaultAmount}
        />
      )}
    </div>
  );
};

export default PortfolioPage;