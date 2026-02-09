import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Contact | Nexus Réussite - Parlez à un expert',
  description: 'Contactez Nexus Réussite : WhatsApp, téléphone ou visite dans notre centre au Centre Urbain Nord, Tunis. Réponse garantie sous 2h.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
