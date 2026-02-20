"use client";

import "@/lib/cleanup-sw";
import { useWeb3Guard } from "@/lib/web3-guard";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "sonner";

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
            <Toaster richColors position="top-right" />
          </Web3GuardProvider>
        </LanguageProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
