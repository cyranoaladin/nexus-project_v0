export const isE2E = (): boolean => process.env.E2E === '1' && process.env.NODE_ENV !== 'production';

