import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

export function mdToSafeHtml(md: string) {
  const raw = marked.parse(md) as string;
  const clean = DOMPurify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] } as any);
  return clean;
}
