/**
 * Core Types for Premium Bac Academy
 */

export interface Echeancier {
  label: string;
  amount: number;
  dueDate: string;
}

export interface Offer {
  id: string;
  type: 'intensive' | 'annual' | 'pass';
  title: string;
  eyebrow: string;
  description: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  groupSize: number;
  echeanciers: Echeancier[];
  acompte?: number;
  acompteDeductible?: boolean;
  features: string[];
  duration: string;
  startDate?: string;
  endDate?: string;
  intensity?: string;
  badge?: string;
  badge_color?: 'gold' | 'green' | 'blue';
  placesAvailable?: number;
  placesLimit?: number;
  campaign?: string;
  cta: string;
  ctaAction?: string;
}

export interface PassOption {
  id: string;
  title: string;
  description: string;
  value: string;
  discount: number;
  price: number;
  sessions: number;
  validity: string;
}

export interface ComparisonPoint {
  feature: string;
  nexus: string | boolean;
  traditional: string | boolean;
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image: string;
  specialties: string[];
}

export interface FAQItem {
  question: string;
  answer: string;
  category?: string;
}

export interface PricingData {
  offers: Offer[];
  passes: PassOption[];
  comparison: ComparisonPoint[];
  team: TeamMember[];
  faq: FAQItem[];
}
