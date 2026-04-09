import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BookOpen,
  Calculator,
  Camera,
  CalendarRange,
  Code2,
  Flame,
  GraduationCap,
  MessageCircle,
  Mic,
  MonitorSmartphone,
  PenTool,
  Sigma,
  Siren,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

export function getPackIcon(packId: string): LucideIcon {
  switch (packId) {
    case "premiere-combo":
      return Target;
    case "premiere-francais":
      return BookOpen;
    case "premiere-maths":
      return Sigma;
    case "terminale-maths":
      return Calculator;
    case "terminale-nsi-fullstack":
      return Code2;
    case "terminale-nsi-ecrit":
      return MonitorSmartphone;
    case "grand-oral":
      return Mic;
    default:
      return BadgeCheck;
  }
}

export function getPackBadgeIcon(packId: string): LucideIcon | null {
  switch (packId) {
    case "premiere-combo":
      return Flame;
    case "terminale-nsi-fullstack":
      return Zap;
    default:
      return null;
  }
}

export function getTimelineIcon(kind: "nsi" | "eaf" | "oral"): LucideIcon {
  switch (kind) {
    case "nsi":
      return Siren;
    case "eaf":
      return PenTool;
    case "oral":
      return GraduationCap;
  }
}

export function getGrandOralDayIcon(day: number): LucideIcon {
  switch (day) {
    case 1:
      return Target;
    case 2:
      return BookOpen;
    case 3:
      return Camera;
    case 4:
      return MessageCircle;
    case 5:
      return Trophy;
    default:
      return CalendarRange;
  }
}
