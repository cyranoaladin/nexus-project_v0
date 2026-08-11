import type { Prisma } from '@prisma/client';
import { serializeError } from '@/lib/utils/serialize-error';
import { queueCommittedEmail } from '@/lib/email/queue';
import { verifySmtp } from '@/lib/email/mailer';
import { hasUserEmail, normalizeUserEmail } from '@/lib/contact/user-email';

type EmailUser = {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
};

type EmailStudent = {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
};

type EmailCoach = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

type EmailSession = {
  id: string;
  subject: string;
  scheduledAt: Date | string;
  duration: number;
  creditCost?: number;
};

async function queueServiceMail(input: Readonly<{
  to: string;
  subject: string;
  html: string;
  dedupeKey: string;
}>) {
  const to = normalizeUserEmail(input.to);
  return queueCommittedEmail({
    aggregateType: 'SESSION_EMAIL',
    aggregateKey: to,
    dedupeKey: input.dedupeKey,
    to,
    subject: input.subject,
    html: input.html,
  });
}

// Templates d'email
const EMAIL_TEMPLATES = {
  WELCOME: {
    subject: '🎓 Bienvenue chez Nexus Réussite !',
    html: (user: EmailUser) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #2EE9F6 100%); color: white; padding: 30px; text-align: center;">
          <h1>Bienvenue ${user.firstName} !</h1>
          <p>Votre parcours vers la réussite commence maintenant</p>
        </div>
        <div style="padding: 30px;">
          <h2>🚀 Vos premiers pas chez Nexus Réussite</h2>
          <p>Nous sommes ravis de vous accueillir dans notre communauté d'apprentissage !</p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📚 Ce qui vous attend :</h3>
            <ul>
              <li>Accès à votre espace personnel</li>
              <li>Réservation de sessions avec nos coaches</li>
              <li>Suivi personnalisé de vos progrès</li>
              <li>Ressources pédagogiques exclusives</li>
            </ul>
          </div>

          <p>
            <a href="${process.env.NEXTAUTH_URL}/dashboard"
               style="background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accéder à mon espace
            </a>
          </p>

          <p>Besoin d'aide ? Notre équipe est là pour vous accompagner !</p>
        </div>
      </div>
    `
  },

  SESSION_CONFIRMATION: {
    subject: '✅ Confirmation de votre session',
    html: (session: EmailSession, student: EmailStudent, coach: EmailCoach | null) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #28a745; color: white; padding: 20px; text-align: center;">
          <h1>✅ Session confirmée !</h1>
        </div>
        <div style="padding: 30px;">
          <p>Bonjour ${student.firstName},</p>

          <p>Votre session a été confirmée avec succès !</p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📋 Détails de votre session :</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>📚 Matière :</strong> ${session.subject}</li>
              <li><strong>📅 Date :</strong> ${new Date(session.scheduledAt).toLocaleDateString('fr-FR')}</li>
              <li><strong>🕐 Heure :</strong> ${new Date(session.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</li>
              <li><strong>⏱️ Durée :</strong> ${session.duration} minutes</li>
              <li><strong>👨‍🏫 Coach :</strong> ${coach ? coach.name : 'Coach assigné automatiquement'}</li>
              <li><strong>💳 Coût :</strong> ${session.creditCost} crédits</li>
            </ul>
          </div>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>🎥 Rejoindre la session :</h3>
            <p>Le lien de visioconférence sera disponible 15 minutes avant le début de la session dans votre espace personnel.</p>
            <p>
              <a href="${process.env.NEXTAUTH_URL}/dashboard/eleve/sessions"
                 style="background: #2196f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Voir mes sessions
              </a>
            </p>
          </div>

          <p style="color: #666; font-size: 14px;">
            💡 <strong>Rappel :</strong> Assurez-vous d'avoir une connexion internet stable et un environnement calme pour votre session.
          </p>
        </div>
      </div>
    `
  },

  SESSION_REMINDER: {
    subject: '⏰ Rappel : Votre session commence dans 1 heure',
    html: (session: EmailSession, student: EmailStudent, videoLink: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ff9800; color: white; padding: 20px; text-align: center;">
          <h1>⏰ Votre session commence bientôt !</h1>
        </div>
        <div style="padding: 30px;">
          <p>Bonjour ${student.firstName},</p>

          <p>Votre session commence dans <strong>1 heure</strong> !</p>

          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3>📋 Rappel de votre session :</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>📚 Matière :</strong> ${session.subject}</li>
              <li><strong>🕐 Heure :</strong> ${new Date(session.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</li>
              <li><strong>⏱️ Durée :</strong> ${session.duration} minutes</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${videoLink}"
               style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 18px;">
              🎥 Rejoindre la session
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            ✅ <strong>Préparez-vous :</strong> Matériel de prise de notes, connexion stable, environnement calme
          </p>
        </div>
      </div>
    `
  }
};

// Fonctions d'envoi d'emails
export async function sendWelcomeEmail(user: EmailUser) {
  try {
    const template = EMAIL_TEMPLATES.WELCOME;

    await queueServiceMail({
      to: user.email,
      subject: template.subject,
      html: template.html(user),
      dedupeKey: `welcome:${normalizeUserEmail(user.email)}`,
    });

  } catch (error) {
    console.error('Erreur envoi email bienvenue:', serializeError(error));
    throw error;
  }
}

export async function sendSessionConfirmationEmail(session: EmailSession, student: EmailStudent, coach?: EmailCoach) {
  try {
    const template = EMAIL_TEMPLATES.SESSION_CONFIRMATION;

    await queueServiceMail({
      to: student.email,
      subject: template.subject,
      html: template.html(session, student, coach ?? null),
      dedupeKey: `session-confirmation:${session.id}:student`,
    });

    // Envoyer aussi au coach si assigné
    if (coach?.email) {
      await queueServiceMail({
        to: coach.email,
        subject: `Nouvelle session assignée - ${session.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #17a2b8; color: white; padding: 20px; text-align: center;">
              <h1>📚 Nouvelle session assignée</h1>
            </div>
            <div style="padding: 30px;">
              <p>Bonjour ${coach.name},</p>
              <p>Une nouvelle session vous a été assignée :</p>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                <ul style="list-style: none; padding: 0;">
                  <li><strong>👨‍🎓 Élève :</strong> ${student.firstName} ${student.lastName}</li>
                  <li><strong>📚 Matière :</strong> ${session.subject}</li>
                  <li><strong>📅 Date :</strong> ${new Date(session.scheduledAt).toLocaleDateString('fr-FR')}</li>
                  <li><strong>🕐 Heure :</strong> ${new Date(session.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</li>
                  <li><strong>⏱️ Durée :</strong> ${session.duration} minutes</li>
                </ul>
              </div>
            </div>
          </div>
        `,
        dedupeKey: `session-confirmation:${session.id}:coach`,
      });
    }

  } catch (error) {
    console.error('Erreur envoi email confirmation:', serializeError(error));
    throw error;
  }
}

export async function sendSessionReminderEmail(session: EmailSession, student: EmailStudent, videoLink: string) {
  try {
    const template = EMAIL_TEMPLATES.SESSION_REMINDER;

    await queueServiceMail({
      to: student.email,
      subject: template.subject,
      html: template.html(session, student, videoLink),
      dedupeKey: `session-reminder:${session.id}:${new Date(session.scheduledAt).toISOString()}`,
    });

  } catch (error) {
    console.error('Erreur envoi rappel session:', serializeError(error));
    throw error;
  }
}

// Fonction de test de configuration email
export async function testEmailConfiguration() {
  const result = await verifySmtp();
  return result.ok
    ? { success: true, message: 'Configuration email valide' }
    : { success: false, error: result.error ?? 'SMTP_VERIFY_FAILED' };
}

export async function sendSessionReportNotification(
  session: { subject: string; scheduledDate: Date; id: string },
  student: { firstName?: string | null; lastName?: string | null },
  coach: { firstName?: string | null; lastName?: string | null },
  report: { summary: string; performanceRating: number; topicsCovered: string; recommendations: string },
  parentEmail: string
) {
  try {
    const subject = `📝 Nouveau compte-rendu de session - ${student.firstName} ${student.lastName} - ${session.subject}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #2EE9F6 100%); color: white; padding: 30px; text-align: center;">
          <h1>📝 Nouveau compte-rendu de session</h1>
        </div>
        <div style="padding: 30px;">
          <p>Bonjour,</p>
          
          <p>Le coach <strong>${coach.firstName} ${coach.lastName}</strong> a soumis le compte-rendu de la session de <strong>${session.subject}</strong> avec votre enfant <strong>${student.firstName} ${student.lastName}</strong>.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📋 Détails de la session :</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>📅 Date :</strong> ${session.scheduledDate.toLocaleDateString('fr-FR')}</li>
              <li><strong>📚 Matière :</strong> ${session.subject}</li>
              <li><strong>👨‍🏫 Coach :</strong> ${coach.firstName} ${coach.lastName}</li>
            </ul>
          </div>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>⭐ Évaluation de la performance :</h3>
            <div style="font-size: 24px; margin: 10px 0;">
              ${'⭐'.repeat(report.performanceRating)}${'☆'.repeat(5 - report.performanceRating)}
            </div>
          </div>

          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📝 Résumé de la session :</h3>
            <p>${report.summary}</p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📖 Sujets abordés :</h3>
            <p>${report.topicsCovered}</p>
          </div>

          <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>💡 Recommandations :</h3>
            <p>${report.recommendations}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/dashboard/parent"
               style="background: #2563EB; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px;">
              Consulter le compte-rendu complet
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            Ce compte-rendu est également disponible dans votre espace parent.
          </p>
        </div>
      </div>
    `;

    await queueServiceMail({
      to: parentEmail,
      subject,
      html,
      dedupeKey: `session-report:${session.id}:${report.performanceRating}:${report.summary}`,
    });

  } catch (error) {
    console.error('Error sending session report notification:', serializeError(error));
  }
}

// Job automatique de rappels (à utiliser avec cron)
export async function sendScheduledReminders() {
  try {
    const { prisma } = await import('@/lib/prisma');

    // Sessions qui commencent dans 1 heure
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const fiveMinutesFromOneHour = new Date(oneHourFromNow.getTime() - 5 * 60 * 1000);

    // Define a type that includes relations
    type SessionWithRelations = Prisma.SessionBookingGetPayload<{
      include: {
        student: true;
        coach: true;
      };
    }>;

    const upcomingSessions: SessionWithRelations[] = await prisma.sessionBooking.findMany({
      where: {
        scheduledDate: {
          gte: fiveMinutesFromOneHour,
          lte: oneHourFromNow
        },
        status: 'SCHEDULED',
        reminderSent: false
      },
      include: {
        student: true,
        coach: true
      }
    });

    for (const session of upcomingSessions) {
      const videoLink = `${process.env.NEXTAUTH_URL}/session/video?id=${session.id}`;

      const [hours, minutes] = session.startTime.split(':').map((value) => Number(value));
      const scheduledAt = new Date(session.scheduledDate);
      scheduledAt.setHours(hours || 0, minutes || 0, 0, 0);

      const emailSession: EmailSession = {
        id: session.id,
        subject: session.subject,
        scheduledAt,
        duration: session.duration,
        creditCost: session.creditsUsed
      };

      if (!hasUserEmail(session.student.email)) continue;
      await sendSessionReminderEmail(emailSession, { ...session.student, email: session.student.email }, videoLink);

      // Marquer le rappel comme envoyé
      // Uncomment after adding reminderSent field to Prisma schema
      await prisma.sessionBooking.update({
        where: { id: session.id },
        data: {
          reminderSent: true
        }
      });
    }

  } catch (error) {
    console.error('Erreur envoi rappels automatiques:', serializeError(error));
  }
}
