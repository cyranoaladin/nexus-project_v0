import type { ComponentType, SVGProps } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  BriefcaseBusiness,
  Calculator,
  Camera,
  CalendarRange,
  Check,
  CheckCircle2,
  CircleHelp,
  Code2,
  Compass,
  Construction,
  CreditCard,
  Cpu,
  Dna,
  FileText,
  Flame,
  Globe2,
  GraduationCap,
  Handshake,
  Languages,
  Lightbulb,
  Mail,
  Medal,
  MessageCircle,
  Mic,
  MoonStar,
  Phone,
  Presentation,
  Printer,
  Rocket,
  Snowflake,
  Search,
  ShieldCheck,
  Sigma,
  Sparkles,
  Sprout,
  Syringe,
  Telescope,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";

export type UiIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const UI_ICON_MAP = {
  alert: AlertTriangle,
  award: Award,
  barChart: BarChart3,
  bell: Bell,
  book: BookOpen,
  bot: Bot,
  brain: Brain,
  calculator: Calculator,
  calendar: CalendarRange,
  camera: Camera,
  check: Check,
  checkCircle: CheckCircle2,
  code: Code2,
  compass: Compass,
  construction: Construction,
  creditCard: CreditCard,
  cpu: Cpu,
  dna: Dna,
  fileText: FileText,
  flame: Flame,
  globe: Globe2,
  graduation: GraduationCap,
  handshake: Handshake,
  help: CircleHelp,
  languages: Languages,
  lightbulb: Lightbulb,
  mail: Mail,
  medal: Medal,
  message: MessageCircle,
  mic: Mic,
  moon: MoonStar,
  phone: Phone,
  presentation: Presentation,
  printer: Printer,
  rocket: Rocket,
  science: Telescope,
  search: Search,
  shield: ShieldCheck,
  sigma: Sigma,
  sparkles: Sparkles,
  snowflake: Snowflake,
  sprout: Sprout,
  syringe: Syringe,
  target: Target,
  teaching: BriefcaseBusiness,
  trendingDown: TrendingDown,
  trendingUp: TrendingUp,
  trophy: Trophy,
  users: Users,
  wand: WandSparkles,
  zap: Zap,
} as const;

export type UiIconKey = keyof typeof UI_ICON_MAP;

const LEGACY_GLYPH_MAP: Record<string, UiIconKey> = {
  "👋": "handshake",
  "🔥": "flame",
  "📈": "trendingUp",
  "📉": "trendingDown",
  "💪": "award",
  "🌙": "moon",
  "🚀": "zap",
  "💯": "award",
  "👑": "award",
  "🎯": "target",
  "🏆": "trophy",
  "🤖": "bot",
  "⚡": "zap",
  "🔍": "search",
  "🌐": "globe",
  "🏗️": "construction",
  "🏅": "medal",
  "🎓": "graduation",
  "🔒": "shield",
  "📊": "barChart",
  "📐": "sigma",
  "💻": "code",
  "💳": "creditCard",
  "📖": "book",
  "🔬": "science",
  "⚗️": "science",
  "🌿": "sprout",
  "🌍": "globe",
  "🧠": "brain",
  "🇬🇧": "languages",
  "🇪🇸": "languages",
  "💡": "lightbulb",
  "📞": "phone",
  "📚": "book",
  "🎤": "mic",
  "❓": "help",
  "❌": "alert",
  "✅": "checkCircle",
  "✓": "check",
  "⏱️": "sparkles",
  "🧬": "dna",
  "🧭": "compass",
  "✨": "sparkles",
  "📘": "book",
  "🧩": "cpu",
  "🧪": "science",
  "🎙️": "mic",
  "📏": "sigma",
  "🧮": "calculator",
  "🔴": "target",
  "🌱": "sprout",
  "📋": "award",
  "🩺": "syringe",
  "🎲": "barChart",
  "📄": "fileText",
  "🖨️": "printer",
  "❄️": "snowflake",
  "👁️": "search",
  "⚙️": "cpu",
  "🚨": "alert",
  "⭐": "sparkles",
};

const SUBJECT_ICON_MAP: Record<string, UiIconKey> = {
  MATHEMATIQUES: "sigma",
  MATHS: "sigma",
  NSI: "code",
  FRANCAIS: "book",
  PHYSIQUE_CHIMIE: "science",
  SVT: "dna",
  HISTOIRE_GEO: "globe",
  PHILOSOPHIE: "brain",
  ANGLAIS: "languages",
  ESPAGNOL: "languages",
  SES: "barChart",
};

export function resolveUiIcon(icon?: string | null): LucideIcon {
  if (!icon) {
    return CircleHelp;
  }

  if (icon in UI_ICON_MAP) {
    return UI_ICON_MAP[icon as UiIconKey];
  }

  if (icon in LEGACY_GLYPH_MAP) {
    return UI_ICON_MAP[LEGACY_GLYPH_MAP[icon]];
  }

  if (icon in SUBJECT_ICON_MAP) {
    return UI_ICON_MAP[SUBJECT_ICON_MAP[icon]];
  }

  return CircleHelp;
}

export function resolveSubjectIcon(subject?: string | null): LucideIcon {
  if (!subject) {
    return CircleHelp;
  }

  return resolveUiIcon(SUBJECT_ICON_MAP[subject] ?? subject);
}
