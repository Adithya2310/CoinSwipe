import React, { useState, useEffect } from 'react';
import { useWeb3AuthConnect } from "@web3auth/modal/react";
import { useAccount } from "wagmi";

// Import CoinSwipe components
import Navigation from "./ui/Navigation";
import AccountBalance from "./ui/AccountBalance";
import DepositModal from "./ui/DepositModal";
import LandingPage from "./pages/LandingPage";
import TrendingSwipePage from "./pages/TrendingSwipePage";
import PortfolioPage from "./pages/PortfolioPage";

// Simplified data types
interface Token {
  id: string;
  name: string;
  symbol: string;
  price: number;
  pairAddress?: string;
}

interface PortfolioItem {
  tokenId: string;
  token: Token;
  amount: number;
  value: number;
  purchasePrice: number;
  change: number;
}

const defaultBuyAmount = 1.00;

function App() {
  const { isConnected } = useWeb3AuthConnect();
  const { address } = useAccount();
  
  // App state
  const [currentPage, setCurrentPage] = useState('landing');
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [buyAmount, setBuyAmount] = useState(defaultBuyAmount);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  // Update current page based on connection status
  useEffect(() => {
    if (isConnected && currentPage === 'landing') {
      setCurrentPage('trending'); // Go directly to trending swipe
    } else if (!isConnected && currentPage !== 'landing') {
      setCurrentPage('landing');
    }
  }, [isConnected, currentPage]);

  const handleNavigation = (page: string) => {
    setCurrentPage(page);
  };

  const handleTokenPurchase = (token: Token, amount: number) => {
    // Check if token already exists in portfolio
    const existingItemIndex = portfolio.findIndex(item => item.tokenId === token.id);
    
    if (existingItemIndex >= 0) {
      // Update existing portfolio item
      const updatedPortfolio = [...portfolio];
      const existingItem = updatedPortfolio[existingItemIndex];
      const newAmount = existingItem.amount + (amount / token.price);
      const newValue = existingItem.value + amount;
      const avgPurchasePrice = (existingItem.purchasePrice * existingItem.value + amount * amount) / newValue;
      
      updatedPortfolio[existingItemIndex] = {
        ...existingItem,
        amount: newAmount,
        value: newValue,
        purchasePrice: avgPurchasePrice,
        change: ((newValue - avgPurchasePrice) / avgPurchasePrice) * 100
      };
      
      setPortfolio(updatedPortfolio);
    } else {
      // Add new portfolio item
      const newItem: PortfolioItem = {
        tokenId: token.id,
        token: token,
        amount: amount / token.price,
        value: amount,
        purchasePrice: amount,
        change: 0
      };
      
      setPortfolio([...portfolio, newItem]);
    }
    
    // User balance is now handled by the wallet
  };

  const getTotalPortfolioValue = () => {
    return portfolio.reduce((total, item) => total + item.value, 0);
  };

  const handleUpdateDefaultAmount = (amount: number) => {
    setBuyAmount(amount);
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
