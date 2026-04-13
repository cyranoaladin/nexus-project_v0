import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  PenTool,
  Siren,
} from "lucide-react";

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
