"use client";

import React from 'react';
import { useWeb3AuthDisconnect, useWeb3AuthUser } from "@web3auth/modal/react";

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isConnected: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate, isConnected }) => {
  const { disconnect, loading: disconnectLoading } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();

  const handleLogout = () => {
    disconnect();
  };

  return (
    <nav className="nav-header">
      <div className="nav-logo">
        Ic Swipe
      </div>
      
      {isConnected && (
        <div className="nav-menu">
          <button
            className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => onNavigate('home')}
          >
            🏠 Home
          </button>
          <button
            className={`nav-item ${currentPage === 'categories' ? 'active' : ''}`}
            onClick={() => onNavigate('categories')}
          >
            📱 Categories
          </button>
          <button
            className={`nav-item ${currentPage === 'portfolio' ? 'active' : ''}`}
            onClick={() => onNavigate('portfolio')}
          >
            📊 Portfolio
          </button>
        </div>
      )}

      {isConnected && (
        <div className="nav-auth">
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
    </nav>
  );
};

export default Navigation;