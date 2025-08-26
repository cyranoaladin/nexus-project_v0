'use client';

// import "@/lib/cleanup-sw";
// import { useWeb3Guard } from "@/lib/web3-guard";
import { SessionProvider } from 'next-auth/react';

/* function Web3GuardProvider({ children }: { children: React.ReactNode; }) {
  useWeb3Guard();
  return <>{children}</>;
} */

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* <Web3GuardProvider> */}
      {children}
      {/* </Web3GuardProvider> */}
    </SessionProvider>
  );
}
