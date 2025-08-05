"use client";

// IMP START - Setup Web3Auth Provider
import { Web3AuthProvider, type Web3AuthContextConfig } from "@web3auth/modal/react";
import { CustomChainConfig, IWeb3AuthState, WEB3AUTH_NETWORK } from "@web3auth/modal";
// IMP END - Setup Web3Auth Provider
// IMP START - Setup Wagmi Provider
import { WagmiProvider } from "@web3auth/modal/react/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { Chain } from 'viem';
import { base, baseSepolia } from "wagmi/chains";
// IMP END - Setup Wagmi Provider

// IMP START - Dashboard Registration
const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "";

if (!clientId) {
  throw new Error("NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set");
}

// IMP END - Dashboard Registration

// IMP START - Setup Wagmi Provider
const queryClient = new QueryClient();
// IMP END - Setup Wagmi Provider
 
export const viemToWeb3AuthChain = (chain: Chain): CustomChainConfig => {
  return {
    chainNamespace: "eip155",
    chainId: `0x${chain.id.toString(16)}`, // hex string
    displayName: chain.name,
    ticker: chain.nativeCurrency.symbol,
    tickerName: chain.nativeCurrency.name,
    decimals: chain.nativeCurrency.decimals,
    rpcTarget: chain.rpcUrls.default.http[0],
    blockExplorerUrl: chain.blockExplorers?.default?.url || "",
    logo: "", // You can optionally add a logo URL here
    isTestnet: chain.testnet ?? false,
  };
};
const baseSepoliaConfig = viemToWeb3AuthChain(baseSepolia);

// IMP START - Config
const web3AuthContextConfig: Web3AuthContextConfig = {
    web3AuthOptions: {
      clientId,
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      chains: [baseSepoliaConfig],
      defaultChainId: baseSepoliaConfig.chainId,
        // IMP START - SSR
      ssr: true,
      // IMP END - SSR
    }
  };
// IMP END - Config

// IMP START - SSR
export default function Provider({ children, web3authInitialState }: 
  { children: React.ReactNode, web3authInitialState: IWeb3AuthState | undefined }) {
// IMP END - SSR
  return (
    // IMP START - Setup Web3Auth Provider
    // IMP START - SSR
    <Web3AuthProvider config={web3AuthContextConfig} initialState={web3authInitialState}>
      {/* // IMP END - SSR */}
      {/* // IMP END - Setup Web3Auth Provider */}
      {/* // IMP START - Setup Wagmi Provider */}
      <QueryClientProvider client={queryClient}>
        <WagmiProvider>
        {children}
        </WagmiProvider>
      </QueryClientProvider>
      {/*// IMP END - Setup Wagmi Provider */}
      {/*// IMP START - Setup Web3Auth Provider */}
    </Web3AuthProvider>
    // IMP END - Setup Web3Auth Provider
  );
}
