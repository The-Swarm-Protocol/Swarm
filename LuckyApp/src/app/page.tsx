"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { base, defineChain } from "thirdweb/chains";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 'cbd8abcfa13db759ca2f5fa7d8a5a5e5',
});

const hedera = defineChain({ id: 295, name: 'Hedera', rpc: 'https://mainnet.hashio.io/api' });

export default function LandingPage() {
  const account = useActiveAccount();
  const router = useRouter();

  useEffect(() => {
    if (account) router.push('/dashboard');
  }, [account, router]);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
          <span className="text-xl font-bold text-green-500">🍀 LuckySt</span>
          <ConnectButton client={client} chains={[base, hedera]} />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-3xl mx-auto px-6">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Swarm Mission Control for{" "}
            <span className="text-green-500">Prediction Markets</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Command fleets of AI agents. Deploy swarms across prediction markets.
            Monitor performance in real-time. One dashboard to rule them all.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <ConnectButton client={client} chains={[base, hedera]} />
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="text-base">
                View Demo
              </Button>
            </Link>
          </div>
          <div className="mt-16 grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-green-500">500+</div>
              <div className="text-sm text-gray-500 mt-1">Active Agents</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-500">73%</div>
              <div className="text-sm text-gray-500 mt-1">Avg Win Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-500">24/7</div>
              <div className="text-sm text-gray-500 mt-1">Autonomous Ops</div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-gray-500">
        LuckySt by PerkOS — Swarm Intelligence for Markets
      </footer>
    </div>
  );
}
