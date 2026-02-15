/**
 * GET /api/diagnostics/definitions
 *
 * Returns safe metadata for all registered diagnostic definitions.
 * Does NOT expose prompts, RAG policies, or scoring thresholds (STAFF only).
 *
 * Query params:
 *   ?id=maths-premiere-p2  → returns a single definition's domains
 *   (no params)            → returns list of all definitions
 */

import { NextResponse } from 'next/server';
import { listDefinitions, getDefinitionOrNull } from '@/lib/diagnostics/definitions';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const def = getDefinitionOrNull(id);
      if (!def) {
        return NextResponse.json(
          { error: `Definition not found: "${id}"` },
          { status: 404 }
        );
      }

      // Return safe metadata + domains (no prompts, no scoring thresholds)
      const domains = Object.entries(def.skills).map(([domainId, skills]) => ({
        domainId,
        weight: def.scoringPolicy.domainWeights[domainId] ?? 0,
        skills: skills.map((s) => ({
          skillId: s.skillId,
          label: s.label,
        })),
      }));

      return NextResponse.json({
        key: def.key,
        label: def.label,
        track: def.track,
        level: def.level,
        version: def.version,
        stage: def.stage,
        domains,
        examFormat: def.examFormat ?? null,
        riskFactors: def.riskModel?.factors ?? [],
      });
    }

    // List all definitions (safe metadata only)
    const defs = listDefinitions();
    // Deduplicate by key (legacy aliases point to same def)
    const seen = new Set<string>();
    const unique = defs.filter((d) => {
      if (seen.has(d.key)) return false;
      seen.add(d.key);
      return true;
    });

    return NextResponse.json({ definitions: unique });
  } catch (error) {
    console.error('[API] /diagnostics/definitions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
