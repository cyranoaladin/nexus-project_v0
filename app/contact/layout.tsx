import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

const title = 'Contact | Nexus Réussite';
const description = 'Contactez Nexus Réussite via WhatsApp, téléphone ou formulaire. Le centre pédagogique est à Mutuelleville, le siège administratif au Centre Urbain Nord.';

export const metadata: Metadata = {
  title,
  description,
  ...buildPageMetadata({ title, description, path: '/contact' }),
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
