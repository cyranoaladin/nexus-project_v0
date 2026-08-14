import type { GradeLevel, Subject } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { isStaffRole } from '@/lib/bilans/saisie-papier/access';
import { buildStaffTeacherDossierDocument, StaffTeacherDossierError } from '@/lib/bilans/staff/teacher-dossier-service';

function optional(value: string | null): string | undefined {
  return value === null || value.trim().length === 0 ? undefined : value;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  // Vérifié ici ET dans le service (défense en profondeur, comme la route PDF
  // de revue assistante) : ce document interne ne doit jamais dépendre d'un
  // seul point de contrôle pour rester hors de portée d'un rôle non-staff.
  if (session?.user?.id === undefined || !isStaffRole(session.user.role)) return new NextResponse(null, { status: 404 });

  const format = request.nextUrl.searchParams.get('format');
  if (format !== 'html' && format !== 'pdf') return NextResponse.json({ error: { code: 'DOSSIER_FORMAT_INVALID' } }, { status: 400 });
  const subject = request.nextUrl.searchParams.get('subject');
  const level = request.nextUrl.searchParams.get('level');
  if (subject === null || level === null) return NextResponse.json({ error: { code: 'DOSSIER_GROUP_REQUIRED' } }, { status: 400 });

  try {
    const document = await buildStaffTeacherDossierDocument({
      userId: session.user.id,
      role: session.user.role,
      subject: subject as Subject,
      level: level as GradeLevel,
      format,
      header: {
        teacherName: optional(request.nextUrl.searchParams.get('teacherName')),
        room: optional(request.nextUrl.searchParams.get('room')),
        timeSlot: optional(request.nextUrl.searchParams.get('timeSlot')),
        stageDates: optional(request.nextUrl.searchParams.get('stageDates')),
      },
    });
    const body = typeof document.body === 'string' ? document.body : new Uint8Array(document.body);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': document.contentType,
        'content-disposition': `inline; filename="${document.filename}"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof StaffTeacherDossierError) {
      // Même convention que app/dashboard/coach/bilans/group-plan/route.ts :
      // un renderer PDF en panne est une panne d'infrastructure (409), pas une
      // erreur de requête (400).
      const status = error.code === 'NOT_FOUND' || error.code === 'DOSSIER_NO_ELIGIBLE_STUDENT'
        ? 404
        : error.code === 'TEACHER_DOSSIER_PDF_RENDER_FAILED'
          ? 409
          : 400;
      return NextResponse.json({ error: { code: error.code } }, { status });
    }
    throw error;
  }
}
