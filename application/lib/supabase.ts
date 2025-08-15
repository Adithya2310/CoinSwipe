import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client for all operations (no RLS rules applied)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for backend operations (optional for development)
// Only create if service key is available (for development)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Database Types
export interface User {
  id: string;
  wallet_address: string;
  default_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Token {
  id: string;
  contract_address: string;
  pair_address?: string;
  name: string;
  symbol: string;
  icon_url?: string;
  color: string;
  current_price?: number;
  price_change_24h?: number;
  liquidity_usd?: number;
  market_cap?: number;
  fdv?: number;
  trust_level: 'high' | 'medium' | 'low';
  chain: string;
  created_at: string;
  updated_at: string;
}

export interface PortfolioHolding {
  id: string;
  user_id: string;
  token_id: string;
  amount: number;
  average_purchase_price: number;
  total_invested: number;
  created_at: string;
  updated_at: string;
  // Relations
  token?: Token;
}

export interface Activity {
  id: string;
  user_id: string;
  token_id: string;
  activity_type: 'buy' | 'sell';
  amount: number;
  price_per_token: number;
  total_value: number;
  transaction_hash?: string;
  created_at: string;
  // Relations
  token?: Token;
}

// Extended types for UI components
export interface PortfolioItemUI {
  tokenId: string;
  token: {
    id: string;
    name: string;
    symbol: string;
    price: number;
    priceChange24h: number;
    trustLevel: 'high' | 'medium' | 'low';
    icon: string;
    color: string;
    contractAddress: string;
    pairAddress?: string;
  };
  amount: number;
  value: number;
  purchasePrice: number;
  change: number;
  totalInvested: number;
}
