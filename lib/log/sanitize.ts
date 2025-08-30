// lib/log/sanitize.ts

const patterns: RegExp[] = [
  /sk-[A-Za-z0-9_\-]+/g, // OpenAI keys
  /hf_[A-Za-z0-9_\-]+/g, // HF tokens
  /postgres:\/\/[^\s]+/g, // DB URLs
  /mysql:\/\/[^\s]+/g,
  /mongodb:\/\/[^\s]+/g,
  /redis:\/\/[^\s]+/g,
  /https?:\/\/[A-Za-z0-9_.-]+:[^@\s]+@/g, // basic auth in URLs
];

export function sanitizeLog(input: unknown): string {
  if (input == null) return '';
  let text = typeof input === 'string' ? input : safeStringify(input);
  for (const re of patterns) {
    text = text.replace(re, '[REDACTED]');
  }
  return text;
}

export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    try {
      return String(obj);
    } catch {
      return '[Unserializable]';
    }
  }
}


