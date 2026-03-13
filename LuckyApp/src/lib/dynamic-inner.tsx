/** Dynamic Inner — Internal component loaded by the dynamic wrapper after code splitting. */
'use client';
import { useEffect } from 'react';
import { ThirdwebProvider } from 'thirdweb/react';
import { installFetchInterceptor } from './fetch-interceptor';
import { debug } from './debug';

/** Known non-fatal thirdweb errors — log them instead of crashing */
const SUPPRESSED_PATTERNS = [
  'connect() before enable()',
  'Cannot set a wallet without an account as active',
];

export function Web3ProviderInner({ children }: { children: React.ReactNode }) {
  // Install circuit-breaker fetch interceptor for unreliable thirdweb APIs.
  // Replaces the old fake-200 pattern with retry/backoff + circuit breaker +
  // observable degraded state. See fetch-interceptor.ts for details.
  useEffect(() => {
    installFetchInterceptor();
  }, []);

  // Catch known thirdweb SDK errors that might occur during wallet operations.
  // Suppress them to prevent app crashes (only log in dev mode).
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      const msg = String(e.reason?.message || e.reason || '');
      if (SUPPRESSED_PATTERNS.some((p) => msg.includes(p))) {
        debug.warn('[Swarm] Thirdweb warning (non-fatal):', msg);
        e.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}
