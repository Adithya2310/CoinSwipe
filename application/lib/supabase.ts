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

// Database Types (New Schema)
export interface User {
  address: string; // Primary key
  email?: string;
  default_amount: number;
  created_at: string;
}

export interface TokenObject {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  price: number;
  amount?: number; // Only used in portfolio
  value_usd?: number; // Only used in portfolio
}

export interface Portfolio {
  user_address: string; // Primary key, FK to users.address
  tokens: TokenObject[];
  updated_at: string;
}

export interface Watchlist {
  user_address: string; // Primary key, FK to users.address
  tokens: TokenObject[];
  updated_at: string;
}

export interface Activity {
  id: string; // UUID primary key
  user_address: string; // FK to users.address
  token: TokenObject; // JSONB token snapshot
  action: 'BUY' | 'SELL';
  amount: number; // Amount traded (ETH or token qty)
  created_at: string;
}

// Extended types for UI components (backward compatibility)
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