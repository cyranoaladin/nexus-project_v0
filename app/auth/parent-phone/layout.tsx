import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Accéder à mon espace parent | Nexus Réussite', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function ParentPhoneLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
