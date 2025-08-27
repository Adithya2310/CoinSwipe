// Mock data for CoinSwipe application

export interface Token {
  id: string;
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  trustLevel: 'high' | 'medium' | 'low';
  icon: string;
  color: string;
  category: string;
}

export interface PortfolioItem {
  tokenId: string;
  token: Token;
  amount: number;
  value: number;
  purchasePrice: number;
  change: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconClass: string;
  tokens: Token[];
}

// Mock tokens data
export const mockTokens: Token[] = [
  // Meme Coins
  {
    id: "safemoon",
    name: "SafeMoon Inu",
    symbol: "SMINU",
    price: 0.000000,
    priceChange24h: 156.78,
    liquidity: 45000,
    marketCap: 2400000,
    fdv: 2450000,
    trustLevel: "high",
    icon: "🐕",
    color: "#f59e0b",
    category: "meme"
  },
  {
    id: "pepecoin",
    name: "PepeCoin Classic",
    symbol: "PEPEC",
    price: 0.000001,
    priceChange24h: -34.12,
    liquidity: 32000,
    marketCap: 1800000,
    fdv: 1850000,
    trustLevel: "medium",
    icon: "🐸",
    color: "#10b981",
    category: "meme"
  },
  {
    id: "moondog",
    name: "Moon Dog",
    symbol: "MDOG",
    price: 0.000045,
    priceChange24h: 89.23,
    liquidity: 67000,
    marketCap: 3200000,
    fdv: 3300000,
    trustLevel: "high",
    icon: "🌙",
    color: "#6366f1",
    category: "meme"
  },
  {
    id: "shibamax",
    name: "Shiba Max",
    symbol: "SMAX",
    price: 0.000012,
    priceChange24h: -12.45,
    liquidity: 28000,
    marketCap: 950000,
    fdv: 980000,
    trustLevel: "medium",
    icon: "🔥",
    color: "#ef4444",
    category: "meme"
  },

  // Risky Degens
  {
    id: "degen1",
    name: "Rocket Moon",
    symbol: "RMOON",
    price: 0.000234,
    priceChange24h: 245.67,
    liquidity: 15000,
    marketCap: 567000,
    fdv: 890000,
    trustLevel: "low",
    icon: "🚀",
    color: "#dc2626",
    category: "risky"
  },
  {
    id: "degen2",
    name: "Diamond Hands",
    symbol: "DHAND",
    price: 0.000089,
    priceChange24h: -67.89,
    liquidity: 8900,
    marketCap: 234000,
    fdv: 456000,
    trustLevel: "low",
    icon: "💎",
    color: "#7c2d12",
    category: "risky"
  },
  {
    id: "degen3",
    name: "Ape Strong",
    symbol: "APES",
    price: 0.000567,
    priceChange24h: 178.34,
    liquidity: 12300,
    marketCap: 789000,
    fdv: 1200000,
    trustLevel: "low",
    icon: "🦍",
    color: "#991b1b",
    category: "risky"
  },

  // Newly Launched
  {
    id: "new1",
    name: "Fresh Coin",
    symbol: "FRESH",
    price: 0.001234,
    priceChange24h: 67.89,
    liquidity: 89000,
    marketCap: 1560000,
    fdv: 1780000,
    trustLevel: "medium",
    icon: "🌱",
    color: "#059669",
    category: "new"
  },
  {
    id: "new2",
    name: "Launch Pad",
    symbol: "LPAD",
    price: 0.000789,
    priceChange24h: 123.45,
    liquidity: 156000,
    marketCap: 2340000,
    fdv: 2890000,
    trustLevel: "high",
    icon: "🚀",
    color: "#0d9488",
    category: "new"
  },
  {
    id: "new3",
    name: "Genesis Token",
    symbol: "GEN",
    price: 0.002345,
    priceChange24h: 45.67,
    liquidity: 234000,
    marketCap: 3450000,
    fdv: 4560000,
    trustLevel: "high",
    icon: "⭐",
    color: "#10b981",
    category: "new"
  },

  // Blue Chips
  {
    id: "blue1",
    name: "ICP Classic",
    symbol: "ICPC",
    price: 12.3456,
    priceChange24h: 5.67,
    liquidity: 2340000,
    marketCap: 45600000,
    fdv: 56780000,
    trustLevel: "high",
    icon: "🔷",
    color: "#2563eb",
    category: "blue"
  },
  {
    id: "blue2",
    name: "Stable Growth",
    symbol: "SGROW",
    price: 8.9012,
    priceChange24h: 3.45,
    liquidity: 1890000,
    marketCap: 34500000,
    fdv: 45600000,
    trustLevel: "high",
    icon: "📈",
    color: "#1d4ed8",
    category: "blue"
  },
  {
    id: "blue3",
    name: "Trusted Coin",
    symbol: "TRUST",
    price: 23.4567,
    priceChange24h: 7.89,
    liquidity: 3450000,
    marketCap: 67800000,
    fdv: 78900000,
    trustLevel: "high",
    icon: "🛡️",
    color: "#3b82f6",
    category: "blue"
  },

  // AI Analyzed
  {
    id: "ai1",
    name: "AI Predictor",
    symbol: "AIPRED",
    price: 0.4567,
    priceChange24h: 23.45,
    liquidity: 567000,
    marketCap: 8900000,
    fdv: 12300000,
    trustLevel: "high",
    icon: "🤖",
    color: "#7c3aed",
    category: "ai"
  },
  {
    id: "ai2",
    name: "Neural Net",
    symbol: "NEURAL",
    price: 1.2345,
    priceChange24h: 12.67,
    liquidity: 890000,
    marketCap: 12300000,
    fdv: 15600000,
    trustLevel: "medium",
    icon: "🧠",
    color: "#8b5cf6",
    category: "ai"
  },
  {
    id: "ai3",
    name: "Smart Algorithm",
    symbol: "SMART",
    price: 0.7890,
    priceChange24h: 34.56,
    liquidity: 1230000,
    marketCap: 15600000,
    fdv: 18900000,
    trustLevel: "high",
    icon: "⚡",
    color: "#a855f7",
    category: "ai"
  }
];

// Categories data
export const categories: Category[] = [
  {
    id: "meme",
    name: "Meme Coins",
    description: "Popular and trending meme tokens on ICP",
    icon: "⭐",
    iconClass: "meme",
    tokens: mockTokens.filter(t => t.category === "meme")
  },
  {
    id: "risky",
    name: "Risky Degens",
    description: "High risk, high reward tokens",
    icon: "💀",
    iconClass: "risky",
    tokens: mockTokens.filter(t => t.category === "risky")
  },
  {
    id: "new",
    name: "Newly Launched",
    description: "Recently launched tokens on Base Network",
    icon: "🚀",
    iconClass: "new",
    tokens: mockTokens.filter(t => t.category === "new")
  },
  {
    id: "blue",
    name: "Blue Chips",
    description: "Established and trusted ICP tokens",
    icon: "⭐",
    iconClass: "blue",
    tokens: mockTokens.filter(t => t.category === "blue")
  },
  {
    id: "ai",
    name: "AI Analyzed",
    description: "AI-recommended tokens based on ICP data",
    icon: "🧠",
    iconClass: "ai",
    tokens: mockTokens.filter(t => t.category === "ai")
  }
];

// Mock portfolio data
export const mockPortfolio: PortfolioItem[] = [
  {
    tokenId: "safemoon",
    token: mockTokens[0],
    amount: 1000000,
    value: 25.50,
    purchasePrice: 20.00,
    change: 27.5
  },
  {
    tokenId: "blue1",
    token: mockTokens.find(t => t.id === "blue1")!,
    amount: 5.2,
    value: 64.20,
    purchasePrice: 58.00,
    change: 10.7
  },
  {
    tokenId: "ai1",
    token: mockTokens.find(t => t.id === "ai1")!,
    amount: 85.6,
    value: 39.08,
    purchasePrice: 42.00,
    change: -6.95
  }
];

// User balance
export const mockUserBalance = 129.00;

// Default buy amount
export const defaultBuyAmount = 1.00;