export function selectModel(): string {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') {
    if (!process.env.OPENAI_MODEL) {
      throw new Error('OPENAI_MODEL required in production');
    }
    return String(process.env.OPENAI_MODEL);
  }
  const model = process.env.OPENAI_MODEL || 'gpt-latest';
  if (!process.env.OPENAI_MODEL) {
    console.log('[ARIA][ModelSelect] Using default dev model: gpt-latest');
  }
  return model;
}

export function getFallbackModel(): string | null {
  return process.env.OPENAI_FALLBACK_MODEL || null;
}
