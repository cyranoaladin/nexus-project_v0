import { handlers } from "@/auth"; // Alias to root auth.ts
import { withoutSessionCookieRenewal } from '@/lib/auth/session-cookie-renewal';
import { withSessionVerificationOutcome } from '@/lib/auth/session-verification-outcome';

export const GET = withoutSessionCookieRenewal(withSessionVerificationOutcome(handlers.GET));
export const POST = withSessionVerificationOutcome(handlers.POST);
