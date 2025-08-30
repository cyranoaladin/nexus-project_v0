import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const patchBodySchema = z.object({
  status: z.enum(['PENDING', 'GENERATING', 'COMPILING', 'READY', 'FAILED']).optional(),
  pdfUrl: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { bilanId: string } }
) {
  // Protect this route to only be available in E2E/test environments
  if (process.env.E2E_RUN !== '1' && process.env.NODE_ENV !== 'test') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const { bilanId } = params;
  if (!bilanId) {
    return NextResponse.json({ error: 'Bilan ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const dataToUpdate = patchBodySchema.parse(body);

    const updatedBilan = await prisma.bilanPremium.update({
      where: { id: bilanId },
      data: dataToUpdate,
    });

    return NextResponse.json({ bilan: updatedBilan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.issues }, { status: 400 });
    }
    console.error(`[API Bilan Debug] Error updating bilan ${bilanId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


