"use client";

import React, { useState, useEffect } from 'react';
import { liveDataService, Category } from '../data/liveData';

interface CategoriesPageProps {
  onNavigate: (page: string, categoryId?: string) => void;
}

const CategoriesPage: React.FC<CategoriesPageProps> = ({ onNavigate }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await liveDataService.getCategories();
        setCategories(cats);
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    onNavigate('swipe', categoryId);
  };

  const handlePortfolioClick = () => {
    onNavigate('portfolio');
  };

  if (loading) {
    return (
      <div className="categories-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading live categories from Base network...</p>
        </div>
      </div>
    );
  }

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
            <div className="token-count">
              {category.tokens.length} tokens available
            </div>
          </div>
        ))}
      </div>

      {/* Ready to Start Swiping Section */}
      <div className="ready-section">
        <h2 className="ready-title">
          🚀 Ready to Start Swiping?
        </h2>
        <p className="ready-description">
          Each category contains carefully curated tokens from the Base Network ecosystem. 
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