import type { LucideIcon } from "lucide-react";
import {
  Brain,
  BookOpen,
  Laptop,
  Star,
  Sparkles,
  GraduationCap,
  FlaskConical,
  Mic,
} from "lucide-react";

export const OFFER_ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  BookOpen,
  Laptop,
  Star,
  Sparkles,
  GraduationCap,
  FlaskConical,
  Mic,
};

export function getOfferIcon(name: string): LucideIcon {
  return OFFER_ICON_MAP[name] || Star;
}
