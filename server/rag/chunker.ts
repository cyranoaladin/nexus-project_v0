// Fallback simple basé sur les caractères si gpt-tokenizer n'est pas disponible

export type Chunk = { text: string; tokens: number; meta: Record<string, any>; };

function cleanText(s: string): string {
  return s.replace(/\f|\r/g, " ").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function semanticChunk(text: string, opts?: { targetTokens?: number; overlap?: number; }): Chunk[] {
  const target = opts?.targetTokens ?? 900;
  const overlap = opts?.overlap ?? 120;
  const cleaned = cleanText(text || "");
  // Approche approximative: découpe par longueur de caractères en supposant ~4 chars/token
  const approxToken = (s: string) => Math.ceil(s.length / 4);
  const charWindow = target * 4;
  const chunks: Chunk[] = [];
  let from = 0;
  while (from < cleaned.length) {
    const to = Math.min(cleaned.length, from + charWindow);
    const slice = cleaned.slice(from, to);
    chunks.push({ text: slice, tokens: approxToken(slice), meta: { from, to: to - 1 } });
    const step = Math.max(1, charWindow - overlap * 4);
    from += step;
  }
  return chunks.length ? chunks : [{ text: cleaned, tokens: approxToken(cleaned), meta: { from: 0, to: cleaned.length - 1 } }];
}
