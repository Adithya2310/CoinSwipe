"use client";

import React, { useState } from 'react';
import { useWeb3AuthDisconnect, useWeb3AuthUser } from "@web3auth/modal/react";

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isConnected: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate, isConnected }) => {
  const { disconnect, loading: disconnectLoading } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    disconnect();
    setIsMenuOpen(false);
  };

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="nav-header">
      <div className="nav-logo">
        Coin Swipe
      </div>
      
      {/* Desktop Menu */}
      {isConnected && (
        <div className="nav-menu desktop-menu">
          <button
            className={`nav-item ${currentPage === 'landing' ? 'active' : ''}`}
            onClick={() => handleNavigate('landing')}
          >
            🏠 Home
          </button>
          <button
            className={`nav-item ${currentPage === 'trending' ? 'active' : ''}`}
            onClick={() => handleNavigate('trending')}
          >
            🔥 Trending
          </button>
          <button
            className={`nav-item ${currentPage === 'portfolio' ? 'active' : ''}`}
            onClick={() => handleNavigate('portfolio')}
          >
            📊 Portfolio
          </button>
        </div>
      )}

      {/* Desktop Auth */}
      {isConnected && (
        <div className="nav-auth desktop-auth">
          <div className="auth-status">
            ● Connected
          </div>
          <button
            className="logout-btn"
            onClick={handleLogout}
            disabled={disconnectLoading}
          >
            {disconnectLoading ? '...' : '🚪 Logout'}
          </button>
        </div>
      )}

      {/* Mobile Hamburger */}
      {isConnected && (
        <button className="hamburger-btn" onClick={toggleMenu}>
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
        </button>
      )}

      {/* Mobile Menu Overlay */}
      {isConnected && isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <div className="auth-status">● Connected</div>
              <button className="close-menu-btn" onClick={() => setIsMenuOpen(false)}>
                ×
              </button>
            </div>
            <div className="mobile-menu-items">
              <button
                className={`mobile-nav-item ${currentPage === 'landing' ? 'active' : ''}`}
                onClick={() => handleNavigate('landing')}
              >
                🏠 Home
              </button>
              <button
                className={`mobile-nav-item ${currentPage === 'trending' ? 'active' : ''}`}
                onClick={() => handleNavigate('trending')}
              >
                🔥 Trending
              </button>
              <button
                className={`mobile-nav-item ${currentPage === 'portfolio' ? 'active' : ''}`}
                onClick={() => handleNavigate('portfolio')}
              >
                📊 Portfolio
              </button>
              <button
                className="mobile-nav-item logout"
                onClick={handleLogout}
                disabled={disconnectLoading}
              >
                {disconnectLoading ? '⏳ Logging out...' : '🚪 Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;