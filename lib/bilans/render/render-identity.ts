import type { FactSheet } from '../facts/fact-sheet';
import type { BilanPackSubject } from '../catalog/subjects';

export const RENDER_IDENTITY_VERSION = 'render-identity.v1' as const;

export type RenderIdentity = Readonly<{
  displayName: string;
  level: FactSheet['student']['level'];
  subject: BilanPackSubject;
  date: string;
  stageLabel: string;
}>;

export function assertRenderIdentity(identity: RenderIdentity): RenderIdentity {
  for (const [field, value] of Object.entries(identity)) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`RENDER_IDENTITY_INVALID:${field}`);
    }
  }
  return Object.freeze({ ...identity });
}
