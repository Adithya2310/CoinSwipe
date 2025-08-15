"use client";

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useBalance } from 'wagmi';

interface DefaultAmountPageProps {
  onSetAmount: (amount: number) => void;
  defaultValue?: number;
}

const DefaultAmountPage: React.FC<DefaultAmountPageProps> = ({ onSetAmount, defaultValue = 1.0 }) => {
  const [buyAmount, setBuyAmount] = useState(defaultValue);
  const { address } = useAccount();
  const { data: balance, isLoading: balanceLoading } = useBalance({ address });

  const handleSetAmount = () => {
    if (buyAmount > 0) {
      onSetAmount(buyAmount);
    }
  };

  const formatBalance = () => {
    if (balanceLoading) return 'Loading...';
    if (!balance) return '$0.00';
    
    const balanceValue = parseFloat(formatUnits(balance.value, balance.decimals));
    return `${balanceValue.toFixed(4)} ${balance.symbol}`;
  };

  return (
    <div className="default-amount-page">
      <div className="amount-container">
        <div className="amount-header">
          <h1 className="amount-title">Set Your Default Buy Amount</h1>
          <p className="amount-subtitle">
            Choose how much you want to invest per token when you swipe right
          </p>
        </div>

        <div className="balance-info">
          <div className="balance-label">Your Wallet Balance</div>
          <div className="balance-value">{formatBalance()}</div>
        </div>

        <div className="amount-input-container">
          <label className="amount-label">
            Default Buy Amount (USD)
          </label>
          <div className="amount-input-wrapper">
            <span className="currency-symbol">$</span>
            <input
              type="number"
              className="amount-input"
              value={buyAmount}
              onChange={(e) => setBuyAmount(parseFloat(e.target.value) || 0)}
              placeholder="1.00"
              step="0.01"
              min="0.01"
              max="1000"
            />
          </div>
          <div className="amount-suggestions">
            <button 
              className={`suggestion-btn ${buyAmount === 0.5 ? 'active' : ''}`}
              onClick={() => setBuyAmount(0.5)}
            >
              $0.50
            </button>
            <button 
              className={`suggestion-btn ${buyAmount === 1.0 ? 'active' : ''}`}
              onClick={() => setBuyAmount(1.0)}
            >
              $1.00
            </button>
            <button 
              className={`suggestion-btn ${buyAmount === 5.0 ? 'active' : ''}`}
              onClick={() => setBuyAmount(5.0)}
            >
              $5.00
            </button>
            <button 
              className={`suggestion-btn ${buyAmount === 10.0 ? 'active' : ''}`}
              onClick={() => setBuyAmount(10.0)}
            >
              $10.00
            </button>
          </div>
        </div>

        <button 
          className="continue-btn"
          onClick={handleSetAmount}
          disabled={buyAmount <= 0}
        >
          Continue to Trading →
        </button>

        <div className="info-note">
          <p>💡 You can change this amount anytime in your settings</p>
        </div>
      </div>
    </div>
  );
};

export default DefaultAmountPage;
