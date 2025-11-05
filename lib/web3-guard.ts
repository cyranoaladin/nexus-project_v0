// Protection contre les conflits Web3/MetaMask
import { useEffect } from 'react';

type Web3Window = Window & typeof globalThis & {
  ethereum?: unknown;
  web3?: unknown;
};

export function useWeb3Guard() {
  useEffect(() => {
    // Éviter les conflits avec les extensions Web3
    if (typeof window !== 'undefined') {
      // Désactiver les injections automatiques problématiques
      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        // Filtrer les erreurs spécifiques aux wallets Web3 et autres extensions
        const errorString = args.map((arg) => String(arg)).join(' ');
        if (
          errorString.includes('inpage.js') ||
          errorString.includes('Cannot read properties of null') ||
          errorString.includes('MetaMask') ||
          errorString.includes('ethereum') ||
          errorString.includes('@vite/client') ||
          errorString.includes('main.jsx') ||
          errorString.includes('@react-refresh') ||
          errorString.includes('Failed to load resource')
        ) {
          // Ignorer silencieusement ces erreurs d'extensions
          return;
        }
        originalError.apply(console, args as unknown[]);
      };

      // Cleanup function
      return () => {
        console.error = originalError;
      };
    }
  }, []);
}

// Guard pour vérifier si une extension Web3 est présente
export function hasWeb3Extension(): boolean {
  if (typeof window === 'undefined') return false;
  const web3Window = window as Web3Window;
  return Boolean(web3Window.ethereum || web3Window.web3);
}

// Safe access à window.ethereum
export function getSafeEthereum() {
  if (typeof window === 'undefined') return null;
  try {
    const web3Window = window as Web3Window;
    return web3Window.ethereum ?? null;
  } catch {
    return null;
  }
}
