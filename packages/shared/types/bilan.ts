export type DomainScore = {
  domain: string;
  points: number;
  max: number;
  masteryPct: number;
  note?: string;
};

export type QcmSummary = {
  total: number;
  max: number;
  scoreGlobalPct: number;
  weakDomainsCount: number;
  domains: DomainScore[];
};

export type Volet2Summary = {
  indices: {
    AUTONOMIE: number;
    ORGANISATION: number;
    MOTIVATION: number;
    STRESS: number;
    SUSPECT_DYS: number;
  };
  portraitText: string;
  badges: string[];
  radarPath?: string;
};

export type StudentMeta = {
  name: string;
  level: string;
  subjects: string;
  status: string;
};

export type Variant = 'parent' | 'eleve' | 'admin';
