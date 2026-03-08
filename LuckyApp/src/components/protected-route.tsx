/** Protected Route — HOC that redirects to landing page if no wallet is connected.
 *  Uses contextual AuthState UI instead of generic spinners. */
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';
import { useOrg } from '@/contexts/OrgContext';
import { AuthState, ReconnectionBanner, type AuthPhase } from './auth-state';

// Grace period (ms) after first app load before allowing redirects.
// Must be long enough for AutoConnect to start (connectionStatus → 'connecting').
const AUTH_GRACE_MS = 4_000;

// Delay before redirecting to onboarding when no orgs found.
// Must be long enough for OrgContext's disconnect grace (6s) to settle.
const ONBOARDING_REDIRECT_DELAY = 2_000;

// Delay before redirecting to landing page when wallet is disconnected.
// Gives AutoConnect and transient reconnections time to settle.
const DISCONNECT_REDIRECT_MS = 2_500;

// Module-level flags — survive across ProtectedRoute re-mounts (sidebar navigation).
// Once the app has settled auth, new ProtectedRoute instances skip the grace period.
let appAuthSettled = false;
let appHadOrgs = false;

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();
  const isConnected = !!account;
  const { organizations, loading, error: orgError, refreshOrgs } = useOrg();
  const router = useRouter();
  const pathname = usePathname();

  // Track whether wallet was ever connected in this mount (prevents redirect on transient drops)
  const everConnected = useRef(false);
  if (isConnected) everConnected.current = true;

  // Track whether we've ever seen orgs (module-level so it survives re-mounts)
  if (organizations.length > 0) appHadOrgs = true;

  // --- Grace period: don't redirect until AUTH_GRACE_MS after first load ---
  const mountTime = useRef(Date.now());
  const [graceOver, setGraceOver] = useState(appAuthSettled);

  useEffect(() => {
    if (appAuthSettled) return; // Already settled from a previous mount
    const remaining = AUTH_GRACE_MS - (Date.now() - mountTime.current);
    if (remaining <= 0) {
      appAuthSettled = true;
      setGraceOver(true);
      return;
    }
    const timer = setTimeout(() => {
      appAuthSettled = true;
      setGraceOver(true);
    }, remaining);
    return () => clearTimeout(timer);
  }, []);

  // If wallet connects during grace period, end it early
  useEffect(() => {
    if (isConnected && !graceOver) {
      appAuthSettled = true;
      setGraceOver(true);
    }
  }, [isConnected, graceOver]);

  // Wallet is still being reconnected — don't redirect
  const isReconnecting = connectionStatus === 'connecting' || connectionStatus === 'unknown';

  useEffect(() => {
    // Don't redirect during the grace period or while AutoConnect is reconnecting
    if (!graceOver || isReconnecting) return;

    // Wallet is not connected
    if (!isConnected) {
      // Always use a delay — wallet may transiently disconnect and reconnect.
      // If wallet was ever connected in this mount, it's likely a transient drop.
      const delay = (appHadOrgs || everConnected.current)
        ? ONBOARDING_REDIRECT_DELAY
        : DISCONNECT_REDIRECT_MS;

      const timer = setTimeout(() => {
        router.push('/');
      }, delay);
      return () => clearTimeout(timer);
    }

    // Organization checks (only after loading is complete)
    if (!loading && isConnected) {
      if (organizations.length === 0 && pathname !== '/onboarding') {
        // Longer delay for org check — OrgContext may still be in its disconnect grace
        const timer = setTimeout(() => router.push('/onboarding'), ONBOARDING_REDIRECT_DELAY);
        return () => clearTimeout(timer);
      } else if (organizations.length > 0 && pathname === '/onboarding') {
        const timer = setTimeout(() => router.push('/dashboard'), 750);
        return () => clearTimeout(timer);
      }
    }
  }, [isConnected, organizations.length, loading, router, pathname, graceOver, isReconnecting]);

  // --- Derive auth phase for contextual UI ---
  const authPhase = useMemo((): AuthPhase | null => {
    if (!graceOver) return 'initializing';
    if (isReconnecting) return everConnected.current ? 'reconnecting' : 'initializing';
    if (!isConnected) return 'disconnected';
    if (loading) return 'loading-org';
    if (orgError && organizations.length === 0) return 'error';
    if (organizations.length === 0 && pathname !== '/onboarding') return 'no-orgs';
    return null;
  }, [graceOver, isReconnecting, isConnected, loading, orgError, organizations.length, pathname]);

  // --- Render ---

  // Brief reconnection during active session — show children + banner, don't block UI
  const showReconnectionBanner = graceOver && !isConnected && everConnected.current && isReconnecting;

  if (authPhase && !showReconnectionBanner) {
    return (
      <AuthState
        phase={authPhase}
        error={orgError}
        onRetry={orgError ? refreshOrgs : undefined}
      />
    );
  }

  return (
    <>
      {showReconnectionBanner && <ReconnectionBanner visible />}
      {children}
    </>
  );
}
