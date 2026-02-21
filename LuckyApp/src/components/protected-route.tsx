'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected, status } = useAccount();
  const router = useRouter();
  const isLoading = status === 'connecting' || status === 'reconnecting';

  useEffect(() => {
    if (!isLoading && !isConnected) {
      router.push('/');
    }
  }, [isLoading, isConnected, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isConnected) {
    return null;
  }

  return <>{children}</>;
}
