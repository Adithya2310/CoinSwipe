"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useWeb3AuthDisconnect, useWeb3AuthUser } from "@web3auth/modal/react";
import { useAccount } from 'wagmi';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isConnected: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate, isConnected }) => {
  const { disconnect, loading: disconnectLoading } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();
  const { address } = useAccount();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleLogout = () => {
    disconnect();
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  };

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const copyAddress = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        // You could add a toast notification here
        console.log('Address copied to clipboard');
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
    setIsProfileOpen(false);
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      {/* Top Navigation (Desktop & Mobile) */}
      <nav className="nav-header">
        <div className="nav-logo">
          CoinSwipe
        </div>
        
        {/* Desktop Menu */}
        {isConnected && (
          <div className="nav-menu desktop-menu">
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

        {/* Profile Dropdown (Desktop & Mobile) */}
        {isConnected && (
          <div className="nav-auth">
            <div className="profile-container" ref={profileRef}>
              <button
                className="profile-btn"
                onClick={toggleProfile}
                disabled={disconnectLoading}
              >
                <span className="profile-icon">👤</span>
                <span className="profile-address desktop-only">{formatAddress(address || '')}</span>
                <span className="profile-arrow">{isProfileOpen ? '▲' : '▼'}</span>
              </button>
              
              {isProfileOpen && (
                <div className="profile-dropdown">
                  <button className="profile-dropdown-item" onClick={copyAddress}>
                    <span className="dropdown-icon">📋</span>
                    Copy Address
                  </button>
                  <button 
                    className="profile-dropdown-item logout" 
                    onClick={handleLogout}
                    disabled={disconnectLoading}
                  >
                    <span className="dropdown-icon">🚪</span>
                    {disconnectLoading ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Navigation (Mobile) */}
      {isConnected && (
        <nav className="mobile-bottom-nav">
          <div className="mobile-nav-items">
            <button
              className={`mobile-nav-btn ${currentPage === 'trending' ? 'active' : ''}`}
              onClick={() => handleNavigate('trending')}
            >
              <span className="nav-icon">🔥</span>
              Trending
            </button>
            <button
              className={`mobile-nav-btn ${currentPage === 'portfolio' ? 'active' : ''}`}
              onClick={() => handleNavigate('portfolio')}
            >
              <span className="nav-icon">📊</span>
              Portfolio
            </button>
          </div>
        </nav>
      )}
    </>
  );
};

export default Navigation;