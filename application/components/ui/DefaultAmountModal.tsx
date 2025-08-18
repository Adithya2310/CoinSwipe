"use client";

import React, { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatUnits } from 'viem';

interface DefaultAmountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetAmount: (amount: number) => void;
  currentAmount?: number;
}

const DefaultAmountModal: React.FC<DefaultAmountModalProps> = ({ 
  isOpen, 
  onClose, 
  onSetAmount, 
  currentAmount = 0.001 
}) => {
  const [buyAmount, setBuyAmount] = useState(currentAmount);
  const { address } = useAccount();
  const { data: balance, isLoading: balanceLoading } = useBalance({ address });

  const handleSetAmount = () => {
    if (buyAmount > 0) {
      onSetAmount(buyAmount);
      onClose();
    }
  };

  const formatWalletBalance = () => {
    if (balanceLoading) return 'Loading...';
    if (!balance) return '0.00 ETH';
    
    const balanceValue = parseFloat(formatUnits(balance.value, balance.decimals));
    return `${balanceValue.toFixed(6)} ETH`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Set Default Buy Amount</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="balance-display">
            <span className="balance-label">Wallet Balance</span>
            <span className="balance-value">{formatWalletBalance()}</span>
          </div>

          <div className="amount-input-section">
            <label className="input-label">Default Buy Amount (ETH)</label>
            <div className="input-wrapper">
              <span className="currency-prefix">ETH</span>
              <input
                type="number"
                className="amount-input-modal"
                value={buyAmount}
                onChange={(e) => setBuyAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.001"
                step="0.001"
                min="0.0001"
                max="10"
              />
            </div>
          </div>

          <div className="amount-presets">
            {[0.0001, 0.001, 0.01, 0.1].map((amount) => (
              <button
                key={amount}
                className={`preset-btn ${buyAmount === amount ? 'active' : ''}`}
                onClick={() => setBuyAmount(amount)}
              >
                {amount} ETH
              </button>
            ))}
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            className="modal-btn primary"
            onClick={handleSetAmount}
            disabled={buyAmount <= 0}
          >
            Save Amount
          </button>
        </div>
      </div>
    </div>
  );
};

export default DefaultAmountModal;
