'use client';
import { ThirdwebProvider, AutoConnect } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 'cbd8abcfa13db759ca2f5fa7d8a5a5e5',
});

export function Web3ProviderInner({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      <AutoConnect client={client} timeout={15000} />
      {children}
    </ThirdwebProvider>
  );
}
