import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { somniaShannon } from './chains';

export const config = getDefaultConfig({
  appName: 'LiquiGuard Somnia',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534dcf9d947e6e7ca12c1b',
  chains: [somniaShannon],
  transports: {
    [somniaShannon.id]: http(
      process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network'
    ),
  },
  ssr: true,
});
