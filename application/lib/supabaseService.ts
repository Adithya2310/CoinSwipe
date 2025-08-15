import { supabase, supabaseAdmin, User, Token, PortfolioHolding, Activity, PortfolioItemUI } from './supabase';

/**
 * Supabase Service for CoinSwipe Portfolio Management
 * 
 * This service handles all database operations for:
 * - User management (wallet addresses, settings)
 * - Token information management
 * - Portfolio holdings tracking
 * - Transaction activity logging
 * 
 * Uses anon client for all operations (no RLS rules applied)
 */
export class SupabaseService {
  private currentWalletAddress: string | null = null;

  // Set the current wallet address for filtering
  setWalletAddress(walletAddress: string) {
    this.currentWalletAddress = walletAddress;
  }
  
  /**
   * USER MANAGEMENT
   */
  
  // Create or get user by wallet address
  async createOrGetUser(walletAddress: string, defaultAmount: number = 1.0): Promise<User | null> {
    try {
      this.setWalletAddress(walletAddress);
      
      // First, try to get existing user
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
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
              wallet_address: walletAddress,
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

  // Update user's default amount
  async updateUserDefaultAmount(walletAddress: string, defaultAmount: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ default_amount: defaultAmount })
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Error updating user default amount:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateUserDefaultAmount:', error);
      return false;
    }
  }

  /**
   * TOKEN MANAGEMENT
   */

  // Create or update token information
  async upsertToken(tokenData: {
    contractAddress: string;
    pairAddress?: string;
    name: string;
    symbol: string;
    iconUrl?: string;
    color?: string;
    currentPrice?: number;
    priceChange24h?: number;
    liquidityUsd?: number;
    marketCap?: number;
    fdv?: number;
    trustLevel?: 'high' | 'medium' | 'low';
  }): Promise<Token | null> {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .upsert([
          {
            contract_address: tokenData.contractAddress,
            pair_address: tokenData.pairAddress,
            name: tokenData.name,
            symbol: tokenData.symbol,
            icon_url: tokenData.iconUrl,
            color: tokenData.color || '#6366f1',
            current_price: tokenData.currentPrice,
            price_change_24h: tokenData.priceChange24h,
            liquidity_usd: tokenData.liquidityUsd,
            market_cap: tokenData.marketCap,
            fdv: tokenData.fdv,
            trust_level: tokenData.trustLevel || 'medium'
          }
        ], { 
          onConflict: 'contract_address',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting token:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in upsertToken:', error);
      return null;
    }
  }

  // Get token by contract address
  async getTokenByContractAddress(contractAddress: string): Promise<Token | null> {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('contract_address', contractAddress)
        .single();

      if (error) {
        console.error('Error fetching token:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getTokenByContractAddress:', error);
      return null;
    }
  }

  // Update token price information
  async updateTokenPrice(contractAddress: string, price: number, priceChange24h?: number): Promise<boolean> {
    try {
      const updateData: any = { 
        current_price: price,
        updated_at: new Date().toISOString()
      };
      
      if (priceChange24h !== undefined) {
        updateData.price_change_24h = priceChange24h;
      }

      const { error } = await supabase
        .from('tokens')
        .update(updateData)
        .eq('contract_address', contractAddress);

      if (error) {
        console.error('Error updating token price:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateTokenPrice:', error);
      return false;
    }
  }

  /**
   * PORTFOLIO MANAGEMENT
   */

  // Get user's portfolio
  async getUserPortfolio(walletAddress: string): Promise<PortfolioItemUI[]> {
    try {
      this.setWalletAddress(walletAddress);
      
      // First get the user
      const user = await this.createOrGetUser(walletAddress);
      if (!user) {
        return [];
      }

      // Get portfolio holdings
      const { data: holdings, error } = await supabase
        .from('portfolio_holdings')
        .select(`
          *,
          token:tokens(*)
        `)
        .eq('user_id', user.id)
        .gt('amount', 0); // Only get holdings with positive amounts

      if (error) {
        console.error('Error fetching portfolio:', error);
        return [];
      }

      // Transform to UI format
      return holdings.map((holding: PortfolioHolding & { token: Token }) => {
        const currentValue = holding.amount * (holding.token.current_price || 0);
        const changePercent = holding.total_invested > 0 
          ? ((currentValue - holding.total_invested) / holding.total_invested) * 100 
          : 0;

        return {
          tokenId: holding.token.id,
          token: {
            id: holding.token.id,
            name: holding.token.name,
            symbol: holding.token.symbol,
            price: holding.token.current_price || 0,
            priceChange24h: holding.token.price_change_24h || 0,
            trustLevel: holding.token.trust_level,
            icon: holding.token.icon_url || '🪙',
            color: holding.token.color,
            contractAddress: holding.token.contract_address,
            pairAddress: holding.token.pair_address
          },
          amount: holding.amount,
          value: currentValue,
          purchasePrice: holding.average_purchase_price,
          change: changePercent,
          totalInvested: holding.total_invested
        };
      });
    } catch (error) {
      console.error('Error in getUserPortfolio:', error);
      return [];
    }
  }

  // Add a token purchase to portfolio
  async addTokenPurchase(
    walletAddress: string,
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
    pricePerToken: number,
    transactionHash?: string
  ): Promise<boolean> {
    try {
      // Get or create user
      const user = await this.createOrGetUser(walletAddress);
      if (!user) {
        throw new Error('Failed to create or get user');
      }

      // Upsert token
      const token = await this.upsertToken(tokenData);
      if (!token) {
        throw new Error('Failed to upsert token');
      }

      const totalValue = amount * pricePerToken;

      // Check for existing holding
      const { data: existingHolding, error: fetchError } = await supabase
        .from('portfolio_holdings')
        .select('*')
        .eq('user_id', user.id)
        .eq('token_id', token.id)
        .single();

      let holdingResult;

      if (existingHolding) {
        // Update existing holding
        const newTotalAmount = existingHolding.amount + amount;
        const newTotalInvested = existingHolding.total_invested + totalValue;
        const newAveragePrice = newTotalInvested / newTotalAmount;

        const { error: updateError } = await supabase
          .from('portfolio_holdings')
          .update({
            amount: newTotalAmount,
            average_purchase_price: newAveragePrice,
            total_invested: newTotalInvested
          })
          .eq('id', existingHolding.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new holding
        const { error: insertError } = await supabase
          .from('portfolio_holdings')
          .insert([
            {
              user_id: user.id,
              token_id: token.id,
              amount: amount,
              average_purchase_price: pricePerToken,
              total_invested: totalValue
            }
          ]);

        if (insertError) {
          throw insertError;
        }
      }

      // Log the activity
      const { error: activityError } = await supabase
        .from('activities')
        .insert([
          {
            user_id: user.id,
            token_id: token.id,
            activity_type: 'buy',
            amount: amount,
            price_per_token: pricePerToken,
            total_value: totalValue,
            transaction_hash: transactionHash
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
   * ACTIVITY MANAGEMENT
   */

  // Get user's activity history
  async getUserActivities(walletAddress: string, limit: number = 50): Promise<Activity[]> {
    try {
      this.setWalletAddress(walletAddress);
      
      const user = await this.createOrGetUser(walletAddress);
      if (!user) {
        return [];
      }

      // Get user activities
      const { data: activities, error } = await supabase
        .from('activities')
        .select(`
          *,
          token:tokens(*)
        `)
        .eq('user_id', user.id)
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
  async getTotalPortfolioValue(walletAddress: string): Promise<number> {
    try {
      const portfolio = await this.getUserPortfolio(walletAddress);
      return portfolio.reduce((total, item) => total + item.value, 0);
    } catch (error) {
      console.error('Error calculating portfolio value:', error);
      return 0;
    }
  }

  // Get portfolio stats
  async getPortfolioStats(walletAddress: string): Promise<{
    totalValue: number;
    totalInvested: number;
    totalReturn: number;
    totalReturnPercent: number;
    tokenCount: number;
  }> {
    try {
      const portfolio = await this.getUserPortfolio(walletAddress);
      
      const totalValue = portfolio.reduce((sum, item) => sum + item.value, 0);
      const totalInvested = portfolio.reduce((sum, item) => sum + item.totalInvested, 0);
      const totalReturn = totalValue - totalInvested;
      const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

      return {
        totalValue,
        totalInvested,
        totalReturn,
        totalReturnPercent,
        tokenCount: portfolio.length
      };
    } catch (error) {
      console.error('Error calculating portfolio stats:', error);
      return {
        totalValue: 0,
        totalInvested: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        tokenCount: 0
      };
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();
