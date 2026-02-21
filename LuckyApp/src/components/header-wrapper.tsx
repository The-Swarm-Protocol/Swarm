'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

const Header = dynamic(
  () => import('./header').then(mod => ({ default: mod.Header })),
  {
    ssr: false,
    loading: () => (
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur h-16 flex items-center px-6">
        <Image src="/lobsterlogo.png" alt="LuckySt logo" width={36} height={36} className="rounded-full mr-2" />
        <span className="text-xl font-bold text-amber-500">LuckySt</span>
      </header>
    ),
  }
);

export function HeaderWrapper() {
  return <Header />;
}
