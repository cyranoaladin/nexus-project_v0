import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ available: false, message: 'Virement bancaire professionnel — bientôt disponible', rib: null });
}
