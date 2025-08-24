import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3AuthConnect } from "@web3auth/modal/react";
import { useAccount } from "wagmi";

// Import CoinSwipe components
import Navigation from "./ui/Navigation";
import AccountBalance from "./ui/AccountBalance";
import DepositModal from "./ui/DepositModal";
import LandingPage from "./pages/LandingPage";
import TrendingSwipePage from "./pages/TrendingSwipePage";
import PortfolioPage from "./pages/PortfolioPage";


// Import Supabase integration
import { supabaseService, TokenObject } from "../lib/supabaseService";
import { PortfolioItemUI, supabase } from "../lib/supabase";

// Data types for backward compatibility
interface Token {
  id: string;
  name: string;
  symbol: string;
  price: number;
  pairAddress?: string;
}

// Use PortfolioItemUI for compatibility with existing components
type PortfolioItem = PortfolioItemUI;

const defaultBuyAmount = 0.01;

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

  // Convert TokenObject to PortfolioItemUI for compatibility
  const convertToPortfolioItemUI = (tokens: TokenObject[]): PortfolioItemUI[] => {
    return tokens.map((token, index) => ({
      tokenId: token.address,
      token: {
        id: token.address,
        name: token.name,
        symbol: token.symbol,
        price: token.price,
        priceChange24h: 0, // Not available in new schema
        trustLevel: 'medium' as const,
        icon: token.logo || '🪙',
        color: '#2563EB',
        contractAddress: token.address,
        pairAddress: undefined
      },
      amount: token.amount || 0,
      value: token.value_usd || 0,
      purchasePrice: token.price,
      change: 0, // Calculate if needed
      totalInvested: token.value_usd || 0
    }));
  };

  // Load user portfolio from Supabase
  const loadUserPortfolio = useCallback(async () => {
    if (!address) return;
    
    setIsLoadingPortfolio(true);
    try {
      const portfolioData = await supabaseService.getUserPortfolio(address);
      const convertedPortfolio = convertToPortfolioItemUI(portfolioData);
      setPortfolio(convertedPortfolio);
      
      const totalValue = portfolioData.reduce((sum, item) => sum + (item.value_usd || 0), 0);
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
    if (isConnected) {
      // Always go to trending when connected - this is our main landing page
      if (currentPage === 'landing') {
        setCurrentPage('trending');
      }
    } else if (!isConnected) {
      // Show landing page when not connected
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
        color: '#2563EB', // Use new blue theme color
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

  const handleTokenSell = async (tokenId: string, percentage: number) => {
    if (!address) {
      console.error('No wallet address available');
      return;
    }

    try {
      // Find the token in portfolio
      const tokenToSell = portfolio.find(item => item.tokenId === tokenId);
      if (!tokenToSell) {
        console.error('Token not found in portfolio');
        return;
      }

      // Calculate sell amount
      const sellAmount = (tokenToSell.amount * percentage) / 100;
      const sellValue = sellAmount * tokenToSell.token.price;

      // Get current portfolio from Supabase
      const currentPortfolio = await supabaseService.getUserPortfolio(address);
      
      // Find and update the token in portfolio
      const updatedPortfolio = currentPortfolio.map((token: TokenObject) => {
        if (token.address === tokenToSell.token.contractAddress) {
          const newAmount = (token.amount || 0) - sellAmount;
          return {
            ...token,
            amount: Math.max(0, newAmount), // Ensure amount doesn't go negative
            value_usd: Math.max(0, newAmount * token.price)
          };
        }
        return token;
      }).filter((token: TokenObject) => (token.amount || 0) > 0); // Remove tokens with 0 amount

      // Update portfolio in Supabase
      const { error: portfolioError } = await supabase
        .from('portfolio')
        .update({
          tokens: updatedPortfolio,
          updated_at: new Date().toISOString()
        })
        .eq('user_address', address);

      if (portfolioError) {
        console.error('Error updating portfolio:', portfolioError);
        return;
      }

      // Log the sell activity
      const activityToken = {
        address: tokenToSell.token.contractAddress,
        name: tokenToSell.token.name,
        symbol: tokenToSell.token.symbol,
        logo: tokenToSell.token.icon,
        price: tokenToSell.token.price
      };

      const { error: activityError } = await supabase
        .from('activities')
        .insert([
          {
            user_address: address,
            token: activityToken,
            action: 'SELL',
            amount: sellValue // Amount in ETH received
          }
        ]);

      if (activityError) {
        console.error('Error logging sell activity:', activityError);
      }

      // Reload portfolio to reflect the sale
      await loadUserPortfolio();
      
      console.log(`Successfully sold ${percentage}% of ${tokenToSell.token.symbol} for $${sellValue.toFixed(2)}`);
      
    } catch (error) {
      console.error('Error handling token sale:', error);
    }
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
            onTokenSell={handleTokenSell}
            currentDefaultAmount={buyAmount}
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
