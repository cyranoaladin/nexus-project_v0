import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import type { Metadata } from 'next';
import BilanClient from './BilanClient';

interface PageProps {
  params: Promise<{ reservationId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reservationId } = await params;
  return {
    title: `Bilan Diagnostic — Stage Février 2026`,
    description: `Bilan de positionnement pour la réservation ${reservationId.slice(0, 8)}`,
  };
}

export default async function BilanPage({ params }: PageProps) {
  const { reservationId } = await params;

  const reservation = await prisma.stageReservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    notFound();
  }

  if (!reservation.scoringResult) {
    redirect(`/stages/fevrier-2026/diagnostic?email=${encodeURIComponent(reservation.email)}&rid=${reservation.id}`);
  }

  const scoringResult = reservation.scoringResult as Record<string, unknown>;

  return (
    <BilanClient
      reservation={{
        id: reservation.id,
        parentName: reservation.parentName,
        studentName: reservation.studentName,
        email: reservation.email,
        academyTitle: reservation.academyTitle,
        status: reservation.status,
        createdAt: reservation.createdAt.toISOString(),
      }}
      scoringResult={scoringResult}
    />
  );
}
