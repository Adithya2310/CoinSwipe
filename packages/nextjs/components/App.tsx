import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3AuthConnect } from "@web3auth/modal/react";
import { useAccount } from "wagmi";
import { parseEther, parseUnits } from "viem";
import { useScaffoldWriteContract, useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useWriteContract } from "wagmi";

// Import CoinSwipe components
import Navigation from "./ui/Navigation";
import AccountBalance from "./ui/AccountBalance";
import DepositModal from "./ui/DepositModal";
import LandingPage from "./pages/LandingPage";
import TrendingSwipePage from "./pages/TrendingSwipePage";
import PortfolioPage from "./pages/PortfolioPage";


// Import Supabase integration
import { supabaseService, TokenObject } from "../lib/supabaseService";
import { PortfolioItemUI, supabase } from "../lib/supabase";

// Data types for backward compatibility
interface Token {
  id: string;
  name: string;
  symbol: string;
  price: number;
  pairAddress?: string;
}

// Use PortfolioItemUI for compatibility with existing components
type PortfolioItem = PortfolioItemUI;

const defaultBuyAmount = 0.01;

function App() {
  const { isConnected } = useWeb3AuthConnect();
  const { address } = useAccount();
  
  // Smart contract integration
  const { writeContractAsync: writeCoinSwipeAsync, isMining } = useScaffoldWriteContract({
    contractName: "CoinSwipe",
  });
  
  // ERC20 token approval hook
  const { writeContractAsync: writeERC20Async } = useWriteContract();
  
  // Get CoinSwipe contract info for approvals
  const { data: coinSwipeContract } = useDeployedContractInfo({
    contractName: "CoinSwipe",
  });
  
  // App state
  const [currentPage, setCurrentPage] = useState('landing');
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [buyAmount, setBuyAmount] = useState(defaultBuyAmount);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [hasDefaultAmount, setHasDefaultAmount] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);

  // Convert TokenObject to PortfolioItemUI for compatibility
  const convertToPortfolioItemUI = (tokens: TokenObject[]): PortfolioItemUI[] => {
    return tokens.map((token, index) => ({
      tokenId: token.address,
      token: {
        id: token.address,
        name: token.name,
        symbol: token.symbol,
        price: token.price,
        priceChange24h: 0, // Not available in new schema
        trustLevel: 'medium' as const,
        icon: token.logo || '🪙',
        color: '#2563EB',
        contractAddress: token.address,
        pairAddress: undefined
      },
      amount: token.amount || 0,
      value: token.value_usd || 0,
      purchasePrice: token.price,
      change: 0, // Calculate if needed
      totalInvested: token.value_usd || 0
    }));
  };

  // Load user portfolio from Supabase
  const loadUserPortfolio = useCallback(async () => {
    if (!address) return;
    
    setIsLoadingPortfolio(true);
    try {
      const portfolioData = await supabaseService.getUserPortfolio(address);
      const convertedPortfolio = convertToPortfolioItemUI(portfolioData);
      setPortfolio(convertedPortfolio);
      
      const totalValue = portfolioData.reduce((sum, item) => sum + (item.value_usd || 0), 0);
      setTotalPortfolioValue(totalValue);
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [address]);

  // Load user settings (default amount)
  const loadUserSettings = useCallback(async () => {
    if (!address) return;
    
    setIsLoadingUserData(true);
    try {
      // Check if user exists without creating
      const existingUser = await supabaseService.getUserByWalletAddress(address);
      if (existingUser && existingUser.default_amount && existingUser.default_amount !== 0) {
        // User exists and has explicitly set a default amount
        setBuyAmount(existingUser.default_amount);
        setHasDefaultAmount(true);
      } else {
        // User doesn't exist OR exists but hasn't set a default amount
        setHasDefaultAmount(false);
        setBuyAmount(defaultBuyAmount);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      setHasDefaultAmount(false);
    } finally {
      setIsLoadingUserData(false);
    }
  }, [address]);

  // Update current page based on connection status
  useEffect(() => {
    if (isConnected) {
      // Always go to trending when connected - this is our main landing page
      if (currentPage === 'landing') {
        setCurrentPage('trending');
      }
    } else if (!isConnected) {
      // Show landing page when not connected
      setCurrentPage('landing');
      setHasDefaultAmount(false);
    }
  }, [isConnected, currentPage]);

  // Load portfolio data when user connects
  useEffect(() => {
    if (isConnected && address) {
      loadUserPortfolio();
      loadUserSettings();
    } else {
      // Reset portfolio when disconnected
      setPortfolio([]);
      setTotalPortfolioValue(0);
      setBuyAmount(defaultBuyAmount);
    }
  }, [isConnected, address, loadUserPortfolio, loadUserSettings]);

  const handleNavigation = (page: string) => {
    setCurrentPage(page);
  };

  const handleTokenPurchase = async (token: any, amount: number) => {
    if (!address) {
      console.error('No wallet address available');
      return;
    }

    if (isMining) {
      console.log('Transaction already in progress...');
      return;
    }

    try {
      // Extract token data for Supabase
      const tokenData = {
        contractAddress: token.baseToken?.address || token.contractAddress || token.id,
        pairAddress: token.pairAddress,
        name: token.baseToken?.name || token.name,
        symbol: token.baseToken?.symbol || token.symbol,
        iconUrl: token.baseToken?.info?.imageUrl || token.info?.imageUrl,
        color: '#2563EB', // Use new blue theme color
        currentPrice: token.priceUsd ? parseFloat(token.priceUsd) : (token.price || 0),
        priceChange24h: token.priceChange?.h24 || token.priceChange24h,
        liquidityUsd: token.liquidity?.usd,
        marketCap: token.marketCap,
        fdv: token.fdv,
        trustLevel: 'medium' as const
      };

      const pricePerToken = tokenData.currentPrice;
      const tokenAmount = amount / pricePerToken;

      // Smart contract parameters
      const tokenAddress = tokenData.contractAddress;
      if (!tokenAddress) {
        throw new Error('Token contract address not available');
      }

      // Convert ETH amount to wei
      const ethAmountWei = parseEther(amount.toString());
      
      // Calculate minimum tokens (with 2% slippage tolerance)
      const minTokens = Math.floor(tokenAmount * 0.98 * Math.pow(10, 18)); // Assuming 18 decimals
      
      // Get DEX parameter for 1inch unoswap
      // For Base network, we'll use a common DEX pool identifier
      // In production, this should be fetched from 1inch API or configured per token
      const getDexParam = (tokenAddress: string): string => {
        // This is a simplified approach - in production you would:
        // 1. Query 1inch API for available DEX pools for this token
        // 2. Choose the best pool based on liquidity and price
        // 3. Return the appropriate pool identifier
        
        // For Base network, you might use different DEX pool identifiers:
        // - Uniswap V3: specific pool identifier
        // - Aerodrome: specific pool identifier
        // - Other Base DEXs: their respective identifiers
        
        // For now, using a default pool identifier
        // TODO: Implement dynamic DEX selection based on token and liquidity
        return "0x0000000000000000000000000000000000000000000000000000000000000001";
      };
      
      const dexParam = getDexParam(tokenAddress);

      console.log('Initiating token swap:', {
        tokenAddress,
        ethAmount: amount,
        minTokens,
        dexParam
      });

      // Call the smart contract
      // This will automatically use Web3Auth's embedded wallet for signing
      // thanks to the WagmiProvider integration in provider.tsx
      const txResult = await writeCoinSwipeAsync({
        functionName: "swapEthToToken",
        args: [tokenAddress as `0x${string}`, BigInt(minTokens), BigInt(dexParam)],
        value: ethAmountWei,
      });

      console.log('Smart contract transaction successful:', txResult);

      // Add purchase to Supabase after successful blockchain transaction
      const success = await supabaseService.addTokenPurchase(
        address,
        tokenData,
        tokenAmount,
        pricePerToken
      );

      if (success) {
        // Reload portfolio to reflect the purchase
        await loadUserPortfolio();
        console.log('Token purchase recorded successfully');
      } else {
        console.error('Failed to record token purchase in database');
        // Transaction was successful on blockchain, but database update failed
        // This is a non-critical error - the user still owns the tokens
      }

      return txResult;

    } catch (error: any) {
      console.error('Error handling token purchase:', error);
      
      // More specific error handling
      if (error.message?.includes('User rejected')) {
        console.log('User rejected the transaction');
      } else if (error.message?.includes('insufficient funds')) {
        console.log('Insufficient funds for transaction');
      } else {
        console.log('Transaction failed:', error.message);
      }
      
      throw error; // Re-throw to let the calling component handle the error
    }
  };

  const getTotalPortfolioValue = () => {
    return totalPortfolioValue;
  };

  const handleUpdateDefaultAmount = async (amount: number) => {
    setBuyAmount(amount);
    setHasDefaultAmount(true);
    
    // Update default amount in Supabase
    if (address) {
      try {
        await supabaseService.updateUserDefaultAmount(address, amount);
      } catch (error) {
        console.error('Error updating default amount:', error);
      }
    }
  };

  const handleDepositClick = () => {
    setIsDepositModalOpen(true);
  };

  const handleDepositModalClose = () => {
    setIsDepositModalOpen(false);
  };

  const handleTokenSell = async (tokenId: string, percentage: number) => {
    if (!address) {
      console.error('No wallet address available');
      return;
    }

    if (isMining) {
      console.log('Transaction already in progress...');
      return;
    }

    if (!coinSwipeContract) {
      console.error('CoinSwipe contract not deployed');
      return;
    }

    try {
      // Find the token in portfolio
      const tokenToSell = portfolio.find(item => item.tokenId === tokenId);
      if (!tokenToSell) {
        console.error('Token not found in portfolio');
        return;
      }

      const tokenAddress = tokenToSell.token.contractAddress;
      if (!tokenAddress) {
        throw new Error('Token contract address not available');
      }

      // Calculate sell amount (in token units, assuming 18 decimals)
      const sellAmount = (tokenToSell.amount * percentage) / 100;
      const sellAmountWei = parseUnits(sellAmount.toString(), 18);
      
      // Estimate the ETH we should receive (with 2% slippage tolerance)
      const expectedEthValue = sellAmount * tokenToSell.token.price;
      const minEthWei = parseEther((expectedEthValue * 0.98).toString());

      // Get DEX parameter for 1inch unoswap (same logic as buying)
      const getDexParam = (tokenAddr: string): string => {
        // For Base network DEX pools - this should be dynamic in production
        // TODO: Implement dynamic DEX selection based on token and liquidity
        return "0x0000000000000000000000000000000000000000000000000000000000000001";
      };
      
      const dexParam = getDexParam(tokenAddress);

      console.log('Initiating token sell:', {
        tokenAddress,
        sellAmount,
        sellAmountWei: sellAmountWei.toString(),
        minEthWei: minEthWei.toString(),
        dexParam,
        percentage
      });

      // Step 1: Approve CoinSwipe contract to spend user's tokens
      console.log('Step 1: Approving token spend...');
      
      const erc20ABI = [
        {
          name: 'approve',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool' }]
        }
      ];

      const approvalTx = await writeERC20Async({
        address: tokenAddress as `0x${string}`,
        abi: erc20ABI,
        functionName: 'approve',
        args: [coinSwipeContract.address, sellAmountWei],
      });

      console.log('Token approval successful:', approvalTx);

      // Step 2: Call the smart contract to swap tokens to ETH
      console.log('Step 2: Swapping tokens to ETH...');
      
      // This will automatically use Web3Auth's embedded wallet for signing
      const swapTx = await writeCoinSwipeAsync({
        functionName: "swapTokenToEth",
        args: [
          tokenAddress as `0x${string}`,
          sellAmountWei,
          minEthWei,
          BigInt(dexParam)
        ],
      });

      console.log('Token swap to ETH successful:', swapTx);

      // Step 3: Update Supabase after successful blockchain transaction
      const success = await updatePortfolioAfterSell(tokenToSell, sellAmount, expectedEthValue);
      
      if (success) {
        // Reload portfolio to reflect the sale
        await loadUserPortfolio();
        console.log(`Successfully sold ${percentage}% of ${tokenToSell.token.symbol} for ~$${expectedEthValue.toFixed(2)}`);
      } else {
        console.error('Failed to update portfolio in database');
        // Transaction was successful on blockchain, but database update failed
        // This is a non-critical error - the user still received ETH
      }

      return { approvalTx, swapTx };

    } catch (error: any) {
      console.error('Error handling token sale:', error);
      
      // More specific error handling
      if (error.message?.includes('User rejected')) {
        console.log('User rejected the transaction');
      } else if (error.message?.includes('insufficient allowance')) {
        console.log('Insufficient token allowance');
      } else if (error.message?.includes('insufficient balance')) {
        console.log('Insufficient token balance');
      } else {
        console.log('Token sale failed:', error.message);
      }
      
      throw error; // Re-throw to let the calling component handle the error
    }
  };

  // Helper function to update portfolio after successful sell
  const updatePortfolioAfterSell = async (tokenToSell: PortfolioItem, sellAmount: number, sellValue: number): Promise<boolean> => {
    try {
      // Get current portfolio from Supabase
      const currentPortfolio = await supabaseService.getUserPortfolio(address!);
      
      // Find and update the token in portfolio
      const updatedPortfolio = currentPortfolio.map((token: TokenObject) => {
        if (token.address === tokenToSell.token.contractAddress) {
          const newAmount = Math.max(0, (token.amount || 0) - sellAmount);
          return {
            ...token,
            amount: newAmount,
            value_usd: newAmount * token.price
          };
        }
        return token;
      }).filter((token: TokenObject) => (token.amount || 0) > 0); // Remove tokens with 0 amount

      // Update portfolio in Supabase
      const { error: portfolioError } = await supabase
        .from('portfolio')
        .update({
          tokens: updatedPortfolio,
          updated_at: new Date().toISOString()
        })
        .eq('user_address', address);

      if (portfolioError) {
        console.error('Error updating portfolio:', portfolioError);
        return false;
      }

      // Log the sell activity
      const activityToken = {
        address: tokenToSell.token.contractAddress,
        name: tokenToSell.token.name,
        symbol: tokenToSell.token.symbol,
        logo: tokenToSell.token.icon,
        price: tokenToSell.token.price
      };

      const { error: activityError } = await supabase
        .from('activities')
        .insert([
          {
            user_address: address,
            token: activityToken,
            action: 'SELL',
            amount: sellValue // Amount in USD received
          }
        ]);

      if (activityError) {
        console.error('Error logging sell activity:', activityError);
        // This is non-critical, don't fail the whole operation
      }

      return true;
    } catch (error) {
      console.error('Error updating portfolio after sell:', error);
      return false;
    }
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
            buyAmount={buyAmount}
            onUpdateDefaultAmount={handleUpdateDefaultAmount}
            hasDefaultAmount={hasDefaultAmount}
          />
        );
      
      case 'portfolio':
        return (
          <PortfolioPage 
            portfolio={portfolio}
            totalValue={getTotalPortfolioValue()}
            onDepositClick={handleDepositClick}
            onUpdateDefaultAmount={handleUpdateDefaultAmount}
            onTokenSell={handleTokenSell}
            currentDefaultAmount={buyAmount}
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
