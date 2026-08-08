/**
 * Type declarations for `runtime-data-leak.mjs`.
 *
 * The implementation stays ESM `.mjs` because the release gate
 * (`verify-standalone-artifact.mjs`) imports it directly at runtime, outside
 * any TypeScript build step.
 */

/** Artifact-relative paths of runtime data files found; empty means clean. */
export declare function findRuntimeDataLeaks(artifactRoot: string): string[];

/** Directories that must never contain files inside a build artifact. */
export declare const RUNTIME_DATA_DIRECTORIES: readonly string[];
