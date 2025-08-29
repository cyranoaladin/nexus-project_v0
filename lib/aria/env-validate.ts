export type AriaMode = 'direct' | 'service';

export function computeAriaMode(): AriaMode {
  const useService = process.env.USE_LLM_SERVICE === '1';
  const directDev = process.env.DIRECT_OPENAI_DEV === '1' && (process.env.OPENAI_API_KEY || '').trim().length > 0;
  if (useService) return 'service';
  return directDev ? 'direct' : 'service';
}

export function validateAriaEnv(): void {
  const mode = computeAriaMode();
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') {
    if (!process.env.OPENAI_MODEL) {
      throw new Error('OPENAI_MODEL required in production');
    }
  }
  if (mode === 'direct') {
    if (!(process.env.OPENAI_API_KEY || '').trim()) {
      throw new Error('OPENAI_API_KEY required for DIRECT_OPENAI_DEV=1');
    }
  } else {
    if (!(process.env.LLM_SERVICE_URL || '').trim()) {
      // Par défaut côté code: http://localhost:8003 – mais si USE_LLM_SERVICE=1 on exige explicite
      if (process.env.USE_LLM_SERVICE === '1') {
        throw new Error('LLM_SERVICE_URL required when USE_LLM_SERVICE=1');
      }
    }
  }
}


