"use client";

import React, { useState } from 'react';
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";

interface AccountBalanceProps {
  onDepositClick: () => void;
}

const AccountBalance: React.FC<AccountBalanceProps> = ({ onDepositClick }) => {
  const { address } = useAccount();
  const { data: balanceData, isLoading, error } = useBalance({ address });

  const formatBalance = (value: bigint, decimals: number, symbol: string) => {
    const formatted = formatUnits(value, decimals);
    const numericValue = parseFloat(formatted);
    
    // Show balance in a more readable format
    if (numericValue >= 1000) {
      return `${(numericValue / 1000).toFixed(2)}K ${symbol}`;
    } else if (numericValue >= 1) {
      return `${numericValue.toFixed(2)} ${symbol}`;
    } else {
      return `${numericValue.toFixed(6)} ${symbol}`;
    }
  };

  const getBalanceValue = () => {
    if (isLoading) return "Loading...";
    if (error) return "Error loading balance";
    if (!balanceData?.value) return "0.00 ETH";
    
    return formatBalance(balanceData.value, balanceData.decimals, balanceData.symbol);
  };

  // Convert balance to USD equivalent (mock conversion for demo)
  const getUSDBalance = () => {
    if (!balanceData?.value) return "$0.00";
    
    const ethValue = parseFloat(formatUnits(balanceData.value, balanceData.decimals));
    const mockEthPrice = 2500; // Mock ETH price in USD
    const usdValue = ethValue * mockEthPrice;
    
    return `$${usdValue.toFixed(2)}`;
  };

  if (!address) {
    return null;
  }

  return (
    <div className="account-balance-container">
      <div className="balance-header">
        <h3 className="balance-title">Account Balance</h3>
        <button className="deposit-btn" onClick={onDepositClick}>
          + Deposit $
        </button>
      </div>
      
      <div className="balance-content">
        <div className="balance-item">
          <div className="balance-label">USDC Balance</div>
          <div className="balance-value primary">{getUSDBalance()}</div>
        </div>
        
        <div className="balance-item">
          <div className="balance-label">Default Swap Amount</div>
          <div className="balance-value secondary">$1.00</div>
        </div>
      </div>
    </div>
  );
};

export default AccountBalance;