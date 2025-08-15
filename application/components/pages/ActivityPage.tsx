"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from "wagmi";
import { supabaseService } from '../../lib/supabaseService';
import { Activity } from '../../lib/supabase';

interface ActivityPageProps {
  onNavigate: (page: string) => void;
}

const ActivityPage: React.FC<ActivityPageProps> = ({ onNavigate }) => {
  const { address } = useAccount();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (address) {
      loadUserActivities();
    }
  }, [address]);

  const loadUserActivities = async () => {
    if (!address) return;
    
    setIsLoading(true);
    try {
      const activityData = await supabaseService.getUserActivities(address, 100);
      setActivities(activityData);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (price: number) => {
    if (price < 0.000001) {
      return price.toExponential(2);
    }
    return `$${price.toFixed(6)}`;
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K`;
    }
    return amount.toFixed(6);
  };

  if (isLoading) {
    return (
      <div className="activity-page">
        <div className="activity-header">
          <h1 className="activity-title">Transaction History</h1>
        </div>
        <div className="activity-loading">
          <div className="loading-spinner"></div>
          <p>Loading your transaction history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-page">
      {/* Activity Header */}
      <div className="activity-header">
        <h1 className="activity-title">Transaction History</h1>
        <p className="activity-subtitle">
          {activities.length} transaction{activities.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Activity List */}
      <div className="activity-list">
        {activities.length === 0 ? (
          <div className="activity-empty">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <h3 style={{ marginBottom: '16px', color: 'var(--text-white)' }}>
                No transactions yet
              </h3>
              <p style={{ color: 'var(--text-gray)', marginBottom: '24px' }}>
                Start swiping to make your first investment!
              </p>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
              <button
                onClick={() => onNavigate('trending')}
                style={{
                  background: 'var(--primary-purple)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Start Trading
              </button>
            </div>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon">
                <div 
                  className={`activity-type-badge ${activity.activity_type}`}
                  style={{
                    backgroundColor: activity.activity_type === 'buy' ? '#10b981' : '#ef4444',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  {activity.activity_type}
                </div>
              </div>
              
              <div className="activity-info">
                <div className="activity-token">
                  <div className="activity-token-name">
                    {activity.token?.name || 'Unknown Token'}
                  </div>
                  <div className="activity-token-symbol">
                    {activity.token?.symbol || 'UNK'}
                  </div>
                </div>
                
                <div className="activity-details">
                  <div className="activity-amount">
                    {formatAmount(activity.amount)} {activity.token?.symbol}
                  </div>
                  <div className="activity-price">
                    @ {formatPrice(activity.price_per_token)}
                  </div>
                </div>
              </div>
              
              <div className="activity-value">
                <div className="activity-total">
                  ${activity.total_value.toFixed(2)}
                </div>
                <div className="activity-date">
                  {formatDate(activity.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Activity Summary */}
      {activities.length > 0 && (
        <div className="activity-summary">
          <h3 style={{ 
            color: 'var(--text-white)', 
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            Summary
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                Total Invested
              </div>
              <div style={{ 
                color: 'var(--text-white)', 
                fontSize: '24px',
                fontWeight: 700
              }}>
                ${activities
                  .filter(a => a.activity_type === 'buy')
                  .reduce((sum, a) => sum + a.total_value, 0)
                  .toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                Transactions
              </div>
              <div style={{ 
                color: 'var(--text-white)', 
                fontSize: '24px',
                fontWeight: 700
              }}>
                {activities.filter(a => a.activity_type === 'buy').length} Buy
                {activities.filter(a => a.activity_type === 'sell').length > 0 && 
                  ` • ${activities.filter(a => a.activity_type === 'sell').length} Sell`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityPage;
