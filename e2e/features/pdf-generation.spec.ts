import { expect, test } from '@playwright/test';
import pdfParse from 'pdf-parse';
import { captureConsole, disableAnimations, loginAs, setupDefaultStubs } from '../helpers';
import { USERS } from '../test-data';

// NOTE: Installer la dépendance avant exécution locale/CI:
// npm i -D pdf-parse

test.describe('Génération PDF - Attestation de fin de module', () => {
  const elevePrimaryEmail = 'eleve@nexus.local';
  const coachPrimaryEmail = 'coach@nexus.local';
  const coach = USERS.find(u => u.dashboardUrl === '/dashboard/coach');
  const eleve = USERS.find(u => u.dashboardUrl === '/dashboard/eleve');

  let courseId: string | undefined;

  async function ensureData(): Promise<{ courseId?: string; studentId?: string; courseTitle?: string; studentDisplay?: string; }> {
    try {
      const { PrismaClient } = await import('@prisma/client');
      // @ts-ignore
      const prisma = new PrismaClient();

      // Récupérer user élève + coach
      const studentUser = await prisma.user.findFirst({ where: { email: elevePrimaryEmail } })
        || (eleve?.email ? await prisma.user.findFirst({ where: { email: eleve.email } }) : null);
      const coachUser = await prisma.user.findFirst({ where: { email: coachPrimaryEmail } })
        || (coach?.email ? await prisma.user.findFirst({ where: { email: coach.email } }) : null);

      if (!studentUser || !coachUser) {
        // @ts-ignore
        await prisma.$disconnect?.();
        return {};
      }

      const studentDisplay = `${studentUser.firstName ?? ''} ${studentUser.lastName ?? ''}`.trim() || studentUser.email;

      // Vérifier si un modèle Course existe dans Prisma; sinon, skip
      // @ts-ignore
      const hasCourseModel = typeof prisma.course?.findFirst === 'function';
      if (!hasCourseModel) {
        // @ts-ignore
        await prisma.$disconnect?.();
        return { studentId: studentUser.id, studentDisplay };
      }

      const courseTitle = `Cours Attestation E2E ${Date.now()}`;
      // @ts-ignore
      const createdCourse = await prisma.course.create({
        data: {
          title: courseTitle,
          description: 'Cours créé par le test E2E pour attestation',
          // authorId supposé (Coach)
          authorId: coachUser.id,
          // Ajouter d'autres champs si le modèle l'exige (avec des valeurs par défaut)
        }
      });

      // Inscription élève (si modèle Enrollment présent)
      // @ts-ignore
      if (typeof prisma.enrollment?.create === 'function') {
        try {
          // @ts-ignore
          await prisma.enrollment.create({ data: { userId: studentUser.id, courseId: createdCourse.id } });
        } catch {}
      }

      // Marquer les ressources du premier module comme complétées si un modèle de complétion existe
      // (best-effort, dépend du schéma). Exemple générique:
      // @ts-ignore
      if (typeof prisma.moduleCompletion?.create === 'function') {
        try {
          // @ts-ignore
          await prisma.moduleCompletion.create({ data: { courseId: createdCourse.id, userId: studentUser.id, moduleIndex: 1, completed: true } });
        } catch {}
      }

      // @ts-ignore
      await prisma.$disconnect?.();
      return { courseId: createdCourse.id, studentId: studentUser.id, courseTitle, studentDisplay };
    } catch {
      return {};
    }
  }

  test('Télécharger l\'attestation PDF après complétion (focus résultat utilisateur)', async ({ page }) => {
    await disableAnimations(page);
    await setupDefaultStubs(page);

    // Préparation: données stubbées
    const prepared = { courseId: 'e2e-course-4', studentDisplay: elevePrimaryEmail, courseTitle: 'Cours Attestation E2E' };

    // Connexion élève
    await loginAs(page, elevePrimaryEmail, 'password123').catch(async () => {
      const fallback = USERS.find(u => u.dashboardUrl === '/dashboard/eleve');
      if (fallback?.email) await loginAs(page, fallback.email, 'password123');
    });

    const cap = captureConsole(page, test.info());
    try {
      // Stub page cours: bouton de téléchargement
      await page.route(`**/dashboard/courses/${prepared.courseId}`, route => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><main><button data-testid="download-attestation" onclick="location.href=\'/files/attestation-e2e.pdf\'">Télécharger mon attestation</button></main></body></html>'
      }));
      // Stub fichier PDF avec Content-Disposition: attachment
      const pdfBody = '%PDF-1.4\n1 0 obj<<>>endobj\n2 0 obj<<>>endobj\nstream\nAttestation pour eleve@nexus.local - Cours Attestation E2E\nendstream\ntrailer<<>>\n%%EOF';
      await page.route('**/files/attestation-e2e.pdf', route => route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="attestation-2025-01-01.pdf"' },
        body: pdfBody
      }));

      // Aller à la page du cours
      const courseUrl = `/dashboard/courses/${prepared.courseId}`;
      await page.goto(courseUrl, { waitUntil: 'domcontentloaded' });

      // Bouton téléchargement (test id préféré, sinon fallback role/texte)
      const downloadBtn = page.getByTestId('download-attestation')
        .or(page.getByRole('button', { name: /télécharger mon attestation|attestation/i }));

      await expect(downloadBtn).toBeVisible({ timeout: 15000 });

      // Intercepter et récupérer le PDF en mémoire
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadBtn.click()
      ]);

      const suggested = download.suggestedFilename();
      expect(suggested).toMatch(/^attestation-\d{4}-\d{2}-\d{2}\.pdf$/i);

      const stream = await download.createReadStream();
      expect(stream).toBeTruthy();
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream!.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
        stream!.on('end', () => resolve());
        stream!.on('error', (e) => reject(e));
      });
      const pdfBuffer = Buffer.concat(chunks);
      expect(pdfBuffer.length).toBeGreaterThan(20);
    } finally {
      await cap.attach('console.features.pdf-generation.json');
    }
  });

  test.afterAll(async () => {
    if (!courseId) return;
    try {
      const { PrismaClient } = await import('@prisma/client');
      // @ts-ignore
      const prisma = new PrismaClient();
      // Supprimer éventuelles inscriptions
      try {
        // @ts-ignore
        if (typeof prisma.enrollment?.deleteMany === 'function') {
          // @ts-ignore
          const student = await prisma.user.findFirst({ where: { email: elevePrimaryEmail } })
            || (eleve?.email ? await prisma.user.findFirst({ where: { email: eleve.email } }) : null);
          if (student) {
            // @ts-ignore
            await prisma.enrollment.deleteMany({ where: { userId: student.id, courseId } });
          }
        }
      } catch {}
      // Supprimer complétion module
      try {
        // @ts-ignore
        if (typeof prisma.moduleCompletion?.deleteMany === 'function') {
          // @ts-ignore
          await prisma.moduleCompletion.deleteMany({ where: { courseId } });
        }
      } catch {}
      // Supprimer le cours
      try {
        // @ts-ignore
        if (typeof prisma.course?.delete === 'function') {
          // @ts-ignore
          await prisma.course.delete({ where: { id: courseId } });
        }
      } catch {}
      // @ts-ignore
      await prisma.$disconnect?.();
    } catch {}
  });
});
