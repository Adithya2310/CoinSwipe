import React, { useState, useEffect } from 'react';
import { useWeb3AuthConnect } from "@web3auth/modal/react";
import { useAccount } from "wagmi";

// Import CoinSwipe components
import Navigation from "./ui/Navigation";
import AccountBalance from "./ui/AccountBalance";
import DepositModal from "./ui/DepositModal";
import LandingPage from "./pages/LandingPage";
import DefaultAmountPage from "./pages/DefaultAmountPage";
import TrendingSwipePage from "./pages/TrendingSwipePage";
import PortfolioPage from "./pages/PortfolioPage";
import ActivityPage from "./pages/ActivityPage";

// Import Supabase integration
import { supabaseService } from "../lib/supabaseService";
import { PortfolioItemUI } from "../lib/supabase";

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

const defaultBuyAmount = 1.00;

function App() {
  const { isConnected } = useWeb3AuthConnect();
  const { address } = useAccount();
  
  // App state
  const [currentPage, setCurrentPage] = useState('landing');
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [buyAmount, setBuyAmount] = useState(defaultBuyAmount);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [hasDefaultAmount, setHasDefaultAmount] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);

  // Update current page based on connection status and user data
  useEffect(() => {
    if (isConnected && currentPage === 'landing' && !isLoadingUserData) {
      // If user has default amount set, go to trending; otherwise go to default amount setup
      if (hasDefaultAmount) {
        setCurrentPage('trending');
      } else {
        setCurrentPage('defaultAmount');
      }
    } else if (!isConnected && currentPage !== 'landing') {
      setCurrentPage('landing');
      setHasDefaultAmount(false);
    }
  }, [isConnected, currentPage, hasDefaultAmount, isLoadingUserData]);

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
  }, [isConnected, address]);

  // Load user portfolio from Supabase
  const loadUserPortfolio = async () => {
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
  };

  // Load user settings (default amount)
  const loadUserSettings = async () => {
    if (!address) return;
    
    setIsLoadingUserData(true);
    try {
      const user = await supabaseService.createOrGetUser(address, defaultBuyAmount);
      if (user) {
        setBuyAmount(user.default_amount);
        // Check if user has set a custom default amount (not the default 1.0)
        setHasDefaultAmount(user.default_amount !== defaultBuyAmount || user.default_amount > 0);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      setHasDefaultAmount(false);
    } finally {
      setIsLoadingUserData(false);
    }
  };

  const handleNavigation = (page: string) => {
    setCurrentPage(page);
  };

  const handleTokenPurchase = async (token: any, amount: number) => {
    if (!address) {
      console.error('No wallet address available');
      return;
    }

    try {
      // Extract token data for Supabase
      const tokenData = {
        contractAddress: token.baseToken?.address || token.contractAddress || token.id,
        pairAddress: token.pairAddress,
        name: token.baseToken?.name || token.name,
        symbol: token.baseToken?.symbol || token.symbol,
        iconUrl: token.baseToken?.info?.imageUrl || token.info?.imageUrl,
        color: '#6366f1', // Default color
        currentPrice: token.priceUsd ? parseFloat(token.priceUsd) : (token.price || 0),
        priceChange24h: token.priceChange?.h24 || token.priceChange24h,
        liquidityUsd: token.liquidity?.usd,
        marketCap: token.marketCap,
        fdv: token.fdv,
        trustLevel: 'medium' as const
      };

      const pricePerToken = tokenData.currentPrice;
      const tokenAmount = amount / pricePerToken;

      // Add purchase to Supabase
      const success = await supabaseService.addTokenPurchase(
        address,
        tokenData,
        tokenAmount,
        pricePerToken
      );

      if (success) {
        // Reload portfolio to reflect the purchase
        await loadUserPortfolio();
        console.log('Token purchase recorded successfully');
      } else {
        console.error('Failed to record token purchase');
        // Fallback to local state for now
        console.log('Using fallback local state update');
      }
    } catch (error) {
      console.error('Error handling token purchase:', error);
      // Fallback to local state management
      console.log('Using fallback local state update due to error');
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
        // Navigate to trending after setting amount
        setCurrentPage('trending');
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
      
      case 'defaultAmount':
        return (
          <DefaultAmountPage 
            onSetAmount={handleUpdateDefaultAmount}
            defaultValue={buyAmount}
          />
        );
      
      case 'trending':
        return (
          <TrendingSwipePage 
            onNavigate={handleNavigation}
            onTokenPurchase={handleTokenPurchase}
            buyAmount={buyAmount}
          />
        );
      
      case 'portfolio':
        return (
          <PortfolioPage 
            portfolio={portfolio}
            totalValue={getTotalPortfolioValue()}
            onDepositClick={handleDepositClick}
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
