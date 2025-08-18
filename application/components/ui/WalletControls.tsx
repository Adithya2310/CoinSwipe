"use client";

import React, { useState } from 'react';
import { useAccount, useDisconnect, useSwitchChain, useChainId } from 'wagmi';
import { useWeb3AuthDisconnect } from '@web3auth/modal/react';
import { base, baseSepolia, mainnet, sepolia } from 'wagmi/chains';
import styles from './WalletControls.module.css';

interface WalletControlsProps {
  onClose?: () => void;
}

const WalletControls: React.FC<WalletControlsProps> = ({ onClose }) => {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain, chains, isPending: isSwitchingNetwork } = useSwitchChain();
  const chainId = useChainId();
  const { disconnect: web3AuthDisconnect } = useWeb3AuthDisconnect();
  
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Supported networks with their details
  const supportedNetworks = [
    {
      chain: base,
      name: 'Base',
      icon: '🟢',
      description: 'Mainnet'
    },
    {
      chain: baseSepolia,
      name: 'Base Sepolia',
      icon: '🧪',
      description: 'Testnet'
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
      if (onClose) onClose();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNetworkSwitch = async (network: any) => {
    try {
      await switchChain({ chainId: network.chain.id });
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Network switch failed:', error);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!address) {
    return null;
  }

  const currentNetwork = getCurrentNetwork();

  return (
    <div className={styles.walletControls}>
      {/* Copy Toast */}
      {copyToastVisible && (
        <div className={styles.copyToast}>
          <div className={styles.copyToastContent}>
            <span className={styles.copyToastIcon}>📋</span>
            <span className={styles.copyToastText}>Address copied!</span>
          </div>
        </div>
      )}

      {/* Network Section */}
      <div className={styles.walletSection}>
        <div className={styles.walletSectionTitle}>Network</div>
        <div className={styles.networkSelector}>
          <button 
            className={styles.networkButton}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={isSwitchingNetwork}
          >
            <div className={styles.networkInfo}>
              <span className={styles.networkIcon}>{currentNetwork.icon}</span>
              <div className={styles.networkDetails}>
                <div className={styles.networkName}>{currentNetwork.name}</div>
                <div className={styles.networkDescription}>{currentNetwork.description}</div>
              </div>
            </div>
            <span className={styles.dropdownArrow}>{isDropdownOpen ? '▲' : '▼'}</span>
          </button>

          {isDropdownOpen && (
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
      </div>

      {/* Wallet Address Section */}
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
          <div className={styles.fullAddress}>
            {address}
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div className={styles.walletSection}>
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
  );
};

export default WalletControls;
