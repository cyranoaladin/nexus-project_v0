import { createFamilyHandler } from '@/lib/families/create-family';

export const POST = createFamilyHandler(undefined, { mode: 'WHATSAPP', route: 'POST:/api/assistante/families' });
