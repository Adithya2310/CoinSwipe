"use client";

import React from 'react';
import WalletControls from './WalletControls';
import styles from './WalletModal.module.css';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.walletModalOverlay} onClick={onClose}>
      <div className={styles.walletModalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.walletModalHeader}>
          <h2 className={styles.walletModalTitle}>Wallet Settings</h2>
          <button className={styles.walletModalClose} onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className={styles.walletModalBody}>
          <WalletControls onClose={onClose} />
        </div>
      </div>


    </div>
  );
};

export default WalletModal;
