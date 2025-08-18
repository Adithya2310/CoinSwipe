import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3AuthConnect } from "@web3auth/modal/react";
import { useAccount, useWalletClient } from "wagmi";

// Import CoinSwipe components
import Navigation from "./ui/Navigation";
import AccountBalance from "./ui/AccountBalance";
import DepositModal from "./ui/DepositModal";
import LandingPage from "./pages/LandingPage";
import TrendingSwipePage from "./pages/TrendingSwipePage";
import PortfolioPage from "./pages/PortfolioPage";
import ActivityPage from "./pages/ActivityPage";

// Import Supabase integration
import { supabaseService } from "../lib/supabaseService";
import { PortfolioItemUI } from "../lib/supabase";

// Import UniSwap integration
import { uniswapService, SwapResult } from "./services/uniswapService";

// Data types for backward compatibility
interface Token {
  id: string;
  name: string;
  symbol: string;
  price: number;
  pairAddress?: string;
}

// Use Supabase types for portfolio
type PortfolioItem = PortfolioItemUI;

const defaultBuyAmount = 0.001; // Changed to ETH instead of USD

function App() {
  const { isConnected } = useWeb3AuthConnect();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // App state
  const [currentPage, setCurrentPage] = useState('landing');
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [buyAmount, setBuyAmount] = useState(defaultBuyAmount);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [hasDefaultAmount, setHasDefaultAmount] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);

  // Load user portfolio from Supabase
  const loadUserPortfolio = useCallback(async () => {
    if (!address) return;
    
    setIsLoadingPortfolio(true);
    try {
      const portfolioData = await supabaseService.getUserPortfolio(address);
      setPortfolio(portfolioData);
      
      const totalValue = portfolioData.reduce((sum, item) => sum + item.value, 0);
      setTotalPortfolioValue(totalValue);
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [address]);

  // Load user settings (default amount)
  const loadUserSettings = useCallback(async () => {
    if (!address) return;
    
    setIsLoadingUserData(true);
    try {
      // Check if user exists without creating
      const existingUser = await supabaseService.getUserByWalletAddress(address);
      if (existingUser && existingUser.default_amount && existingUser.default_amount !== 0) {
        // User exists and has explicitly set a default amount
        setBuyAmount(existingUser.default_amount);
        setHasDefaultAmount(true);
      } else {
        // User doesn't exist OR exists but hasn't set a default amount
        setHasDefaultAmount(false);
        setBuyAmount(defaultBuyAmount);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      setHasDefaultAmount(false);
    } finally {
      setIsLoadingUserData(false);
    }
  }, [address]);

  // Update current page based on connection status
  useEffect(() => {
    if (isConnected && currentPage === 'landing') {
      // Always go to trending when connected - modal will show if needed
      setCurrentPage('trending');
    } else if (!isConnected && currentPage !== 'landing') {
      setCurrentPage('landing');
      setHasDefaultAmount(false);
    }
  }, [isConnected, currentPage]);

  // Load portfolio data when user connects
  useEffect(() => {
    if (isConnected && address) {
      loadUserPortfolio();
      loadUserSettings();
    } else {
      // Reset portfolio when disconnected
      setPortfolio([]);
      setTotalPortfolioValue(0);
      setBuyAmount(defaultBuyAmount);
    }
  }, [isConnected, address, loadUserPortfolio, loadUserSettings]);

  const handleNavigation = (page: string) => {
    setCurrentPage(page);
  };

  const handleTokenPurchase = async (token: any, amount: number) => {
    if (!address || !walletClient) {
      console.error('No wallet address or client available');
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      console.log('🚀 Starting token purchase with UniSwap...');
      
      // Execute the actual swap using UniSwap V3
      // Note: Using hardcoded 0.0001 ETH (will fallback to simulation if real swap fails)
      const swapResult: SwapResult = await uniswapService.executeSwap(
        walletClient,
        address,
        '0.0001' // Small amount with fallback simulation for testnet
      );

      if (!swapResult.success) {
        console.error('❌ Swap failed:', swapResult.error);
        return { success: false, error: swapResult.error };
      }

      console.log('✅ Swap successful! Recording in database...');

      // Extract token data for Supabase (only record if swap succeeded)
      const tokenData = {
        contractAddress: '0x285A1d09bB5E6E8D99242A485dEA615267808844', // Hardcoded target token
        pairAddress: token.pairAddress,
        name: token.baseToken?.name || token.name || 'Target Token',
        symbol: token.baseToken?.symbol || token.symbol || 'TARGET',
        iconUrl: token.baseToken?.info?.imageUrl || token.info?.imageUrl,
        color: '#6366f1', // Default color
        currentPrice: token.priceUsd ? parseFloat(token.priceUsd) : (token.price || 0),
        priceChange24h: token.priceChange?.h24 || token.priceChange24h,
        liquidityUsd: token.liquidity?.usd,
        marketCap: token.marketCap,
        fdv: token.fdv,
        trustLevel: 'medium' as const
      };

      // Calculate token amount received from swap
      const ethAmountSpent = 0.0001; // Hardcoded amount for testnet with simulation fallback
      const pricePerToken = tokenData.currentPrice || 0.01; // Fallback price
      const tokenAmountReceived = swapResult.amountOut 
        ? parseFloat(uniswapService.formatAmount(swapResult.amountOut))
        : ethAmountSpent / pricePerToken; // Estimate if amountOut not available

      // Record the successful swap in Supabase
      const dbSuccess = await supabaseService.addTokenPurchase(
        address,
        tokenData,
        tokenAmountReceived,
        pricePerToken
      );

      if (dbSuccess) {
        // Reload portfolio to reflect the purchase
        await loadUserPortfolio();
        console.log('💾 Token purchase recorded successfully');
      } else {
        console.warn('⚠️ Swap succeeded but failed to record in database');
      }

      return { 
        success: true, 
        transactionHash: swapResult.transactionHash,
        amountOut: swapResult.amountOut 
      };

    } catch (error: any) {
      console.error('💥 Error handling token purchase:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction was rejected by user';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH balance';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { success: false, error: errorMessage };
    }
  };

  const getTotalPortfolioValue = () => {
    return totalPortfolioValue;
  };

  const handleUpdateDefaultAmount = async (amount: number) => {
    setBuyAmount(amount);
    setHasDefaultAmount(true);
    
    // Update default amount in Supabase
    if (address) {
      try {
        await supabaseService.updateUserDefaultAmount(address, amount);
      } catch (error) {
        console.error('Error updating default amount:', error);
      }
    }
  };

  const handleDepositClick = () => {
    setIsDepositModalOpen(true);
  };

  const handleDepositModalClose = () => {
    setIsDepositModalOpen(false);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'landing':
        return (
          <LandingPage 
            onNavigate={handleNavigation}
            userBalance={0} // This will be replaced by actual wallet balance
            onUpdateDefaultAmount={handleUpdateDefaultAmount}
          />
        );
      

      
      case 'trending':
        return (
          <TrendingSwipePage 
            onNavigate={handleNavigation}
            onTokenPurchase={handleTokenPurchase}
            buyAmount={buyAmount}
            onUpdateDefaultAmount={handleUpdateDefaultAmount}
            hasDefaultAmount={hasDefaultAmount}
          />
        );
      
      case 'portfolio':
        return (
          <PortfolioPage 
            portfolio={portfolio}
            totalValue={getTotalPortfolioValue()}
            onDepositClick={handleDepositClick}
            onUpdateDefaultAmount={handleUpdateDefaultAmount}
            currentDefaultAmount={buyAmount}
          />
        );
      
      case 'activity':
        return (
          <ActivityPage 
            onNavigate={handleNavigation}
          />
        );
      
      default:
        return (
          <LandingPage 
            onNavigate={handleNavigation}
            userBalance={0}
            onUpdateDefaultAmount={handleUpdateDefaultAmount}
          />
        );
    }
  };

  return (
    <div className="app-container">
      <Navigation 
        currentPage={currentPage}
        onNavigate={handleNavigation}
        isConnected={isConnected}
      />
      
      {/* Account Balance - Show only on portfolio page */}
      {isConnected && currentPage === 'portfolio' && (
        <AccountBalance onDepositClick={handleDepositClick} />
      )}
      
      <main className="main-content">
        {renderCurrentPage()}
      </main>

      {/* Deposit Modal */}
      <DepositModal 
        isOpen={isDepositModalOpen}
        onClose={handleDepositModalClose}
      />
    </div>
  );
}

export default App;
