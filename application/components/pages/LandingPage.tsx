"use client";

import React, { useState } from 'react';
import { useWeb3AuthConnect } from "@web3auth/modal/react";
import { defaultBuyAmount } from '../data/mockData';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { connect, loading: connectLoading, error: connectError } = useWeb3AuthConnect();
  const [buyAmount, setBuyAmount] = useState(defaultBuyAmount);
  const [showAmountInput, setShowAmountInput] = useState(false);

  const handleLogin = () => {
    connect();
  };

  const handleSetAmount = () => {
    // This would typically update user preferences
    console.log('Setting default buy amount to:', buyAmount);
    setShowAmountInput(false);
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <h1 className="hero-title">
        Discover Crypto Like Never Before With Ic Swipe
      </h1>
      <p className="hero-subtitle">
        Swipe right to discover and invest in the next big cryptocurrency tokens on
        the Internet Computer. Your crypto journey is just a flick away.
      </p>

      {/* Login Card */}
      <div className="login-card">
        {!showAmountInput ? (
          <>
            <button
              className="login-btn"
              onClick={handleLogin}
              disabled={connectLoading}
            >
              {connectLoading ? (
                <>⏳ Connecting...</>
              ) : (
                <>Login</>
              )}
            </button>
            {connectError && (
              <div className="error">{connectError.message}</div>
            )}
          </>
        ) : (
          <div className="amount-input-section">
            <div className="auth-status">🟢 Connected to Internet Computer</div>
            <label className="amount-label">
              Default Buy Amount (in Dollars)
            </label>
            <input
              type="number"
              className="amount-input"
              value={buyAmount}
              onChange={(e) => setBuyAmount(parseFloat(e.target.value) || 0)}
              placeholder="1"
              step="0.01"
              min="0.01"
            />
            <button className="set-amount-btn" onClick={handleSetAmount}>
              Set Amount →
            </button>
          </div>
        )}
      </div>

      {/* Feature Cards */}
      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">→</div>
          <h3 className="feature-title">Swipe to Discover</h3>
          <p className="feature-description">
            Find your next investment with our intuitive swipe interface built on ICP.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🚪</div>
          <h3 className="feature-title">Decentralized Trading</h3>
          <p className="feature-description">
            Trade tokens directly on-chain with the security of the Internet Computer.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3 className="feature-title">Portfolio Management</h3>
          <p className="feature-description">
            Track and manage your ICP-based investments with real-time data.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;