import { LEGAL } from '@/lib/legal';
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

const title = 'Contact — centre pédagogique à Tunis | Nexus Réussite';
const description = `Contactez Nexus Réussite à Tunis par WhatsApp, téléphone ou formulaire. Centre pédagogique : ${LEGAL.addresses.pedagogique.full}. Siège administratif : Centre Urbain Nord.`;

export const metadata: Metadata = {
  title,
  description,
  ...buildPageMetadata({ title, description, path: '/contact' }),
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
