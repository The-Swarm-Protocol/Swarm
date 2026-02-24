'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useActiveAccount, useAutoConnect } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { useOrg } from '@/contexts/OrgContext';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 'cbd8abcfa13db759ca2f5fa7d8a5a5e5',
});

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const isConnected = !!account;
  const { organizations, loading } = useOrg();
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading: isAutoConnecting } = useAutoConnect({
    client,
    timeout: 15000,
  });

  useEffect(() => {
    // Don't redirect while auto-reconnect is still in progress
    if (isAutoConnecting) return;

    // First check: wallet connection
    if (!isConnected) {
      router.push('/');
      return;
    }

    // Second check: organizations (only after loading is complete)
    if (!loading && isConnected) {
      // If user has no orgs and is not already on onboarding page, redirect
      if (organizations.length === 0 && pathname !== '/onboarding') {
        router.push('/onboarding');
      }
      // If user has orgs and is on onboarding page, redirect to dashboard
      else if (organizations.length > 0 && pathname === '/onboarding') {
        router.push('/dashboard');
      }
    }
  }, [isConnected, organizations.length, loading, router, pathname, isAutoConnecting]);

  // Show nothing while auto-reconnecting, loading, or not connected
  if (isAutoConnecting || !isConnected || loading) {
    return null;
  }

  // If no orgs and not on onboarding page, show nothing (will redirect)
  if (organizations.length === 0 && pathname !== '/onboarding') {
    return null;
  }

  return <>{children}</>;
}
