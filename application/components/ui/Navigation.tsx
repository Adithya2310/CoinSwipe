"use client";

import React, { useState, useEffect } from 'react';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { useWeb3AuthDisconnect } from '@web3auth/modal/react';
import { base, baseSepolia, mainnet, sepolia } from 'wagmi/chains';
import WalletModal from './WalletModal';
import styles from './Navigation.module.css';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isConnected: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate, isConnected }) => {
  const { address } = useAccount();
  const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain();
  const chainId = useChainId();
  const { disconnect: web3AuthDisconnect } = useWeb3AuthDisconnect();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false);
  const [copyToastVisible, setCopyToastVisible] = useState(false);

  // Supported networks with their details
  const supportedNetworks = [
    {
      chain: baseSepolia,
      name: 'Base Sepolia',
      icon: '🧪',
      description: 'Testnet'
    },
    {
      chain: base,
      name: 'Base',
      icon: '🟢',
      description: 'Mainnet'
    },
    {
      chain: mainnet,
      name: 'Ethereum',
      icon: '⚡',
      description: 'Mainnet'
    },
    {
      chain: sepolia,
      name: 'Sepolia',
      icon: '🔧',
      description: 'Testnet'
    }
  ];

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getCurrentNetwork = () => {
    return supportedNetworks.find(network => network.chain.id === chainId) || {
      chain: { id: chainId, name: 'Unknown' },
      name: 'Unknown Network',
      icon: '❓',
      description: 'Unknown'
    };
  };

  const handleCopyAddress = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        setCopyToastVisible(true);
        setTimeout(() => setCopyToastVisible(false), 2000);
      } catch (error) {
        console.error('Failed to copy address:', error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await web3AuthDisconnect();
      setIsWalletDropdownOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNetworkSwitch = async (network: any) => {
    try {
      await switchChain({ chainId: network.chain.id });
      setIsNetworkDropdownOpen(false);
    } catch (error) {
      console.error('Network switch failed:', error);
    }
  };

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Close network dropdown if clicked outside
      if (isNetworkDropdownOpen && !target.closest(`.${styles.networkDropdownContainer}`)) {
        setIsNetworkDropdownOpen(false);
      }
      
      // Close wallet dropdown if clicked outside
      if (isWalletDropdownOpen && !target.closest(`.${styles.walletDropdownContainer}`)) {
        setIsWalletDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNetworkDropdownOpen, isWalletDropdownOpen]);

  return (
    <nav className="nav-header">
      <div className="nav-logo">
        Coin Swipe
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
          <button
            className={`nav-item ${currentPage === 'activity' ? 'active' : ''}`}
            onClick={() => handleNavigate('activity')}
          >
            📈 Activity
          </button>
        </div>
      )}

      {/* Copy Toast */}
      {copyToastVisible && (
        <div className={styles.copyToast}>
          <div className={styles.copyToastContent}>
            <span className={styles.copyToastIcon}>📋</span>
            <span className={styles.copyToastText}>Address copied!</span>
          </div>
        </div>
      )}

      {/* Desktop Auth */}
      {isConnected && address && (
        <div className="nav-auth desktop-auth">
          {/* Network Dropdown */}
          <div className={styles.networkDropdownContainer}>
            <button
              className={styles.networkBtn}
              onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
              disabled={isSwitchingNetwork}
            >
              <span className={styles.networkIcon}>{getCurrentNetwork().icon}</span>
              <span className={styles.networkName}>{getCurrentNetwork().name}</span>
              <span className={styles.dropdownArrow}>{isNetworkDropdownOpen ? '▲' : '▼'}</span>
            </button>

            {isNetworkDropdownOpen && (
              <div className={styles.networkDropdown}>
                {supportedNetworks.map((network) => (
                  <button
                    key={network.chain.id}
                    className={`${styles.networkOption} ${chainId === network.chain.id ? styles.active : ''}`}
                    onClick={() => handleNetworkSwitch(network)}
                    disabled={isSwitchingNetwork}
                  >
                    <span className={styles.networkIcon}>{network.icon}</span>
                    <div className={styles.networkDetails}>
                      <div className={styles.networkName}>{network.name}</div>
                      <div className={styles.networkDescription}>{network.description}</div>
                    </div>
                    {chainId === network.chain.id && (
                      <span className={styles.networkActiveIndicator}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Wallet Dropdown */}
          <div className={styles.walletDropdownContainer}>
            <button
              className={styles.walletBtn}
              onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
            >
              <span className={styles.walletIcon}>👤</span>
              <span className={styles.walletAddress}>{formatAddress(address)}</span>
              <span className={styles.dropdownArrow}>{isWalletDropdownOpen ? '▲' : '▼'}</span>
            </button>

            {isWalletDropdownOpen && (
              <div className={styles.walletDropdown}>
                <div className={styles.walletInfo}>
                  <div className={styles.walletSection}>
                    <div className={styles.walletSectionTitle}>Wallet Address</div>
                    <div className={styles.addressContainer}>
                      <div className={styles.addressDisplay}>
                        <span className={styles.addressText}>{formatAddress(address)}</span>
                        <button 
                          className={styles.copyButton}
                          onClick={handleCopyAddress}
                          title="Copy full address"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.walletActions}>
                    <button 
                      className={`${styles.walletActionButton} ${styles.logout}`}
                      onClick={handleLogout}
                    >
                      <span className={styles.actionIcon}>🚪</span>
                      <span className={styles.actionText}>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
              <button
                className={styles.mobileWalletBtn}
                onClick={() => {
                  setIsWalletModalOpen(true);
                  setIsMenuOpen(false);
                }}
              >
                <span className={styles.walletIcon}>👤</span>
                <span className={styles.walletAddress}>{address ? formatAddress(address) : 'Wallet'}</span>
              </button>
              <button className="close-menu-btn" onClick={() => setIsMenuOpen(false)}>
                ×
              </button>
            </div>
            <div className="mobile-menu-items">
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
                className={`mobile-nav-item ${currentPage === 'activity' ? 'active' : ''}`}
                onClick={() => handleNavigate('activity')}
              >
                📈 Activity
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      <WalletModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
      />


    </nav>
  );
};

export default Navigation;