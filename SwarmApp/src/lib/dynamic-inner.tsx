/** Dynamic Inner — Internal component loaded by the dynamic wrapper after code splitting.
 *  Includes AutoConnect to handle OAuth redirect callbacks (Google, Apple, etc.)
 *  so the in-app wallet connection completes after the redirect. */
'use client';
import { ThirdwebProvider, AutoConnect } from 'thirdweb/react';
import { thirdwebClient } from '@/lib/thirdweb-client';
import { swarmWallets } from '@/lib/wallets';

export function Web3ProviderInner({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      <AutoConnect client={thirdwebClient} wallets={swarmWallets} timeout={15000} />
      {children}
    </ThirdwebProvider>
  );
}
