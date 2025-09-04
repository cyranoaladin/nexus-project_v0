import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { computeAriaMode } = await import('@/lib/aria/env-validate');
  const mode = computeAriaMode();
  const { selectModel, getFallbackModel } = await import('@/lib/aria/openai');
  let model = 'unknown';
  let fallback: string | null = null;
  try {
    model = selectModel();
    fallback = getFallbackModel();
  } catch (e: any) {
    model = `error:${e?.message || 'model selection failed'}`;
  }
  return NextResponse.json({ mode, model, fallback });
}
