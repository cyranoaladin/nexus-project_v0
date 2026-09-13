import { handlers } from "@/auth"; // Alias to root auth.ts
import { withSessionVerificationOutcome } from '@/lib/auth/session-verification-outcome';

export const GET = withSessionVerificationOutcome(handlers.GET);
export const POST = withSessionVerificationOutcome(handlers.POST);
