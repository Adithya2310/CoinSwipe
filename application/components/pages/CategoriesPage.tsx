"use client";

import React from 'react';
import { categories, mockUserBalance } from '../data/mockData';

interface CategoriesPageProps {
  onNavigate: (page: string, categoryId?: string) => void;
}

const CategoriesPage: React.FC<CategoriesPageProps> = ({ onNavigate }) => {
  const handleCategoryClick = (categoryId: string) => {
    onNavigate('swipe', categoryId);
  };

  const handlePortfolioClick = () => {
    onNavigate('portfolio');
  };

  return (
    <div className="categories-page">
      {/* Categories Grid */}
      <div className="categories-grid">
        {categories.map((category) => (
          <div
            key={category.id}
            className="category-card"
            onClick={() => handleCategoryClick(category.id)}
          >
            <div className={`category-icon ${category.iconClass}`}>
              {category.icon}
            </div>
            <h3 className="category-title">{category.name}</h3>
            <p className="category-description">{category.description}</p>
          </div>
        ))}
      </div>

      {/* Ready to Start Swiping Section */}
      <div className="ready-section">
        <h2 className="ready-title">
          🚀 Ready to Start Swiping?
        </h2>
        <p className="ready-description">
          Each category contains carefully curated tokens from the Internet Computer ecosystem. 
          Swipe right to invest, left to pass, and build your perfect CoinSwipe portfolio.
        </p>
        <button className="portfolio-btn" onClick={handlePortfolioClick}>
          View Your Portfolio
        </button>
      </div>
    </div>
  );
};

export default CategoriesPage;