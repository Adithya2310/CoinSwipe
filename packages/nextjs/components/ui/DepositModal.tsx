"use client";

import React, { useState } from 'react';
import { useAccount } from "wagmi";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose }) => {
  const { address } = useAccount();
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyAddress = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Deposit Funds</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <p className="deposit-instruction">
            Send funds to your wallet address below:
          </p>
          
          <div className="address-container">
            <div className="address-label">Your Wallet Address</div>
            <div className="address-display">
              <span className="address-text">
                {address ? formatAddress(address) : 'No address available'}
              </span>
              <button 
                className="copy-btn"
                onClick={handleCopyAddress}
                disabled={!address}
              >
                {copySuccess ? '✓' : '📋'}
              </button>
            </div>
            
            {address && (
              <div className="full-address">
                <small>{address}</small>
              </div>
            )}
          </div>
          
          <div className="deposit-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>Important:</strong> Only send funds that are compatible with your wallet network. 
              Sending incompatible tokens may result in permanent loss.
            </div>
          </div>
          
          <div className="deposit-steps">
            <h4>How to deposit:</h4>
            <ol>
              <li>Copy your wallet address above</li>
              <li>Go to your exchange or external wallet</li>
              <li>Send funds to this address</li>
              <li>Wait for network confirmation</li>
            </ol>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="modal-btn secondary" onClick={onClose}>
            Close
          </button>
          {address && (
            <button className="modal-btn primary" onClick={handleCopyAddress}>
              {copySuccess ? 'Address Copied!' : 'Copy Address'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepositModal;