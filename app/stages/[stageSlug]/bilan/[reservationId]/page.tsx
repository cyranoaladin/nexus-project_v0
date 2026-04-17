export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/prisma';
import BilanClient from '@/app/stages/fevrier-2026/bilan/[reservationId]/BilanClient';

type PageProps = {
  params: Promise<{ stageSlug: string; reservationId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { stageSlug, reservationId } = await params;

  return {
    title: `Bilan diagnostic — ${stageSlug}`,
    description: `Bilan de positionnement pour la réservation ${reservationId.slice(0, 8)}`,
  };
}

export default async function DynamicBilanPage({ params }: PageProps) {
  const { stageSlug, reservationId } = await params;

  const reservation = await prisma.stageReservation.findUnique({
    where: { id: reservationId },
    include: {
      stage: {
        select: {
          slug: true,
          title: true,
        },
      },
    },
  });

  if (!reservation || reservation.stage?.slug !== stageSlug) {
    notFound();
  }

  if (!reservation.scoringResult) {
    redirect(`/stages/${stageSlug}/diagnostic?email=${encodeURIComponent(reservation.email)}&rid=${reservation.id}`);
  }

  const scoringResult = reservation.scoringResult as Record<string, unknown>;

  return (
    <BilanClient
      stageSlug={stageSlug}
      allowLegacyConfirmation={false}
      reservation={{
        id: reservation.id,
        parentName: reservation.parentName,
        studentName: reservation.studentName,
        email: reservation.email,
        academyTitle: reservation.stage?.title ?? reservation.academyTitle,
        status: reservation.status,
        createdAt: reservation.createdAt.toISOString(),
      }}
      scoringResult={scoringResult}
    />
  );
}
