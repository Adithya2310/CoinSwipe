import { supabase } from './supabase';

/**
 * Token Object Schema (as defined in backendstructure.md)
 */
export interface TokenObject {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  price: number;
  amount?: number; // Only used in portfolio
  value_usd?: number; // Only used in portfolio
}

/**
 * Supabase Service for CoinSwipe Base Network
 * 
 * This service handles all database operations according to the new schema:
 * - users: address (PK), email, default_amount, created_at
 * - portfolio: user_address (PK), tokens (jsonb), updated_at
 * - watchlist: user_address (PK), tokens (jsonb), updated_at
 * - activities: id (PK), user_address, token (jsonb), action, amount, created_at
 */
export class SupabaseService {
  
  /**
   * USER MANAGEMENT
   */
  
  // Create or get user by wallet address
  async createOrGetUser(address: string, defaultAmount: number = 0.01): Promise<any> {
    try {
      // First, try to get existing user
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('address', address)
        .single();

      if (existingUser) {
        return existingUser;
      }

      // If user doesn't exist, create new one
      if (fetchError && fetchError.code === 'PGRST116') {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([
            {
              address: address,
              default_amount: defaultAmount
            }
          ])
          .select()
          .single();

        if (createError) {
          console.error('Error creating user:', createError);
          return null;
        }

        return newUser;
      }

      console.error('Error fetching user:', fetchError);
      return null;
    } catch (error) {
      console.error('Error in createOrGetUser:', error);
      return null;
    }
  }

  // Check if user exists without creating
  async getUserByWalletAddress(address: string): Promise<any> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('address', address)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user:', error);
        return null;
      }

      return user;
    } catch (error) {
      console.error('Error in getUserByWalletAddress:', error);
      return null;
    }
  }

  // Update user's default amount
  async updateUserDefaultAmount(address: string, defaultAmount: number): Promise<boolean> {
    try {
      // First try to update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({ default_amount: defaultAmount })
        .eq('address', address);

      if (updateError && updateError.code === 'PGRST116') {
        // User doesn't exist, create new one
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              address: address,
              default_amount: defaultAmount
            }
          ]);

        if (insertError) {
          console.error('Error creating user:', insertError);
          return false;
        }
      } else if (updateError) {
        console.error('Error updating user default amount:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateUserDefaultAmount:', error);
      return false;
    }
  }

  /**
   * PORTFOLIO MANAGEMENT
   */

  // Get user's portfolio
  async getUserPortfolio(address: string): Promise<any[]> {
    try {
      // Ensure user exists
      await this.createOrGetUser(address);
      
      // Get portfolio
      const { data: portfolio, error } = await supabase
        .from('portfolio')
        .select('tokens')
        .eq('user_address', address)
        .single();

      if (error && error.code === 'PGRST116') {
        // Portfolio doesn't exist, return empty array
        return [];
      }

      if (error) {
        console.error('Error fetching portfolio:', error);
        return [];
      }

      return portfolio?.tokens || [];
    } catch (error) {
      console.error('Error in getUserPortfolio:', error);
      return [];
    }
  }

  // Add a token purchase to portfolio
  async addTokenPurchase(
    address: string,
    tokenData: {
      contractAddress: string;
      pairAddress?: string;
      name: string;
      symbol: string;
      iconUrl?: string;
      color?: string;
      currentPrice: number;
      priceChange24h?: number;
      liquidityUsd?: number;
      marketCap?: number;
      fdv?: number;
      trustLevel?: 'high' | 'medium' | 'low';
    },
    amount: number,
    pricePerToken: number
  ): Promise<boolean> {
    try {
      // Ensure user exists
      await this.createOrGetUser(address);

      // Create token object for portfolio
      const tokenObject: TokenObject = {
        address: tokenData.contractAddress,
        name: tokenData.name,
        symbol: tokenData.symbol,
        logo: tokenData.iconUrl,
        price: pricePerToken,
        amount: amount,
        value_usd: amount * pricePerToken
      };

      // Get current portfolio
      const currentPortfolio = await this.getUserPortfolio(address);
      
      // Check if token already exists in portfolio
      const existingTokenIndex = currentPortfolio.findIndex(
        (token: TokenObject) => token.address === tokenData.contractAddress
      );

      let updatedPortfolio;
      if (existingTokenIndex >= 0) {
        // Update existing token
        const existingToken = currentPortfolio[existingTokenIndex];
        const newAmount = (existingToken.amount || 0) + amount;
        const newValue = newAmount * pricePerToken;
        
        updatedPortfolio = [...currentPortfolio];
        updatedPortfolio[existingTokenIndex] = {
          ...existingToken,
          amount: newAmount,
          value_usd: newValue,
          price: pricePerToken // Update to latest price
        };
      } else {
        // Add new token
        updatedPortfolio = [...currentPortfolio, tokenObject];
      }

      // Update portfolio
      const { error: portfolioError } = await supabase
        .from('portfolio')
        .upsert([
          {
            user_address: address,
            tokens: updatedPortfolio,
            updated_at: new Date().toISOString()
          }
        ], { 
          onConflict: 'user_address' 
        });

      if (portfolioError) {
        console.error('Error updating portfolio:', portfolioError);
        return false;
      }

      // Log the activity
      const activityToken = {
        address: tokenData.contractAddress,
        name: tokenData.name,
        symbol: tokenData.symbol,
        logo: tokenData.iconUrl,
        price: pricePerToken
      };

      const { error: activityError } = await supabase
        .from('activities')
        .insert([
          {
            user_address: address,
            token: activityToken,
            action: 'BUY',
            amount: amount * pricePerToken // Amount in ETH spent
          }
        ]);

      if (activityError) {
        console.error('Error logging activity:', activityError);
        // Don't fail the transaction for activity logging errors
      }

      return true;
    } catch (error) {
      console.error('Error in addTokenPurchase:', error);
      return false;
    }
  }

  /**
   * WATCHLIST MANAGEMENT
   */

  // Get user's watchlist
  async getUserWatchlist(address: string): Promise<TokenObject[]> {
    try {
      // Ensure user exists
      await this.createOrGetUser(address);
      
      // Get watchlist
      const { data: watchlist, error } = await supabase
        .from('watchlist')
        .select('tokens')
        .eq('user_address', address)
        .single();

      if (error && error.code === 'PGRST116') {
        // Watchlist doesn't exist, return empty array
        return [];
      }

      if (error) {
        console.error('Error fetching watchlist:', error);
        return [];
      }

      return watchlist?.tokens || [];
    } catch (error) {
      console.error('Error in getUserWatchlist:', error);
      return [];
    }
  }

  // Add token to watchlist
  async addToWatchlist(address: string, tokenData: {
    contractAddress: string;
    name: string;
    symbol: string;
    iconUrl?: string;
    currentPrice: number;
  }): Promise<boolean> {
    try {
      // Ensure user exists
      await this.createOrGetUser(address);

      // Create token object for watchlist
      const tokenObject: TokenObject = {
        address: tokenData.contractAddress,
        name: tokenData.name,
        symbol: tokenData.symbol,
        logo: tokenData.iconUrl,
        price: tokenData.currentPrice
      };

      // Get current watchlist
      const currentWatchlist = await this.getUserWatchlist(address);
      
      // Check if token already exists
      const exists = currentWatchlist.some(
        (token: TokenObject) => token.address === tokenData.contractAddress
      );

      if (exists) {
        return true; // Already in watchlist
      }

      // Add new token
      const updatedWatchlist = [...currentWatchlist, tokenObject];

      // Update watchlist
      const { error } = await supabase
        .from('watchlist')
        .upsert([
          {
            user_address: address,
            tokens: updatedWatchlist,
            updated_at: new Date().toISOString()
          }
        ], { 
          onConflict: 'user_address' 
        });

      if (error) {
        console.error('Error updating watchlist:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in addToWatchlist:', error);
      return false;
    }
  }

  // Remove token from watchlist
  async removeFromWatchlist(address: string, contractAddress: string): Promise<boolean> {
    try {
      // Get current watchlist
      const currentWatchlist = await this.getUserWatchlist(address);
      
      // Remove token
      const updatedWatchlist = currentWatchlist.filter(
        (token: TokenObject) => token.address !== contractAddress
      );

      // Update watchlist
      const { error } = await supabase
        .from('watchlist')
        .update({
          tokens: updatedWatchlist,
          updated_at: new Date().toISOString()
        })
        .eq('user_address', address);

      if (error) {
        console.error('Error updating watchlist:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in removeFromWatchlist:', error);
      return false;
    }
  }

  /**
   * ACTIVITY MANAGEMENT
   */

  // Get user's activity history
  async getUserActivities(address: string, limit: number = 50): Promise<any[]> {
    try {
      // Get user activities
      const { data: activities, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_address', address)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching activities:', error);
        return [];
      }

      return activities || [];
    } catch (error) {
      console.error('Error in getUserActivities:', error);
      return [];
    }
  }

  /**
   * UTILITY METHODS
   */

  // Calculate total portfolio value
  async getTotalPortfolioValue(address: string): Promise<number> {
    try {
      const portfolio = await this.getUserPortfolio(address);
      return portfolio.reduce((total: number, token: TokenObject) => {
        return total + (token.value_usd || 0);
      }, 0);
    } catch (error) {
      console.error('Error calculating portfolio value:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();