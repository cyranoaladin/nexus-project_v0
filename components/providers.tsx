"use client";

import "@/lib/cleanup-sw";
import { useWeb3Guard } from "@/lib/web3-guard";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";
import { ErrorBoundary } from "@/components/error-boundary";

function Web3GuardProvider({ children }: { children: React.ReactNode; }) {
  useWeb3Guard();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode; }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <LanguageProvider>
          <Web3GuardProvider>
            {children}
          </Web3GuardProvider>
        </LanguageProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
