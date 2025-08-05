import React, { useState, useEffect } from 'react';
import { useWeb3AuthConnect } from "@web3auth/modal/react";
import { useAccount } from "wagmi";

// Import CoinSwipe components
import Navigation from "./ui/Navigation";
import LandingPage from "./pages/LandingPage";
import CategoriesPage from "./pages/CategoriesPage";
import SwipePage from "./pages/SwipePage";
import PortfolioPage from "./pages/PortfolioPage";

// Import data
import { mockPortfolio, mockUserBalance, Token, PortfolioItem } from "./data/mockData";

function App() {
  const { isConnected } = useWeb3AuthConnect();
  const { address } = useAccount();
  
  // App state
  const [currentPage, setCurrentPage] = useState('landing');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(mockPortfolio);
  const [userBalance, setUserBalance] = useState(mockUserBalance);

  // Update current page based on connection status
  useEffect(() => {
    if (isConnected && currentPage === 'landing') {
      setCurrentPage('categories');
    } else if (!isConnected && currentPage !== 'landing') {
      setCurrentPage('landing');
    }
  }, [isConnected, currentPage]);

  const handleNavigation = (page: string, categoryId?: string) => {
    setCurrentPage(page);
    if (categoryId) {
      setSelectedCategory(categoryId);
    }
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
    
    // Update user balance
    setUserBalance(prev => prev - amount);
  };

  const getTotalPortfolioValue = () => {
    return portfolio.reduce((total, item) => total + item.value, 0);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage onNavigate={handleNavigation} />;
      
      case 'categories':
        return <CategoriesPage onNavigate={handleNavigation} />;
      
      case 'swipe':
        return (
          <SwipePage 
            categoryId={selectedCategory} 
            onNavigate={handleNavigation}
            onTokenPurchase={handleTokenPurchase}
          />
        );
      
      case 'portfolio':
        return (
          <PortfolioPage 
            portfolio={portfolio}
            totalValue={getTotalPortfolioValue()}
          />
        );
      
      default:
        return <LandingPage onNavigate={handleNavigation} />;
    }
  };

  return (
    <div className="app-container">
      <Navigation 
        currentPage={currentPage}
        onNavigate={handleNavigation}
        isConnected={isConnected}
      />
      
      <main className="main-content">
        {renderCurrentPage()}
      </main>
    </div>
  );
}

export default App;
