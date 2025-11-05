import type { Prisma } from '@prisma/client';
import nodemailer from 'nodemailer';

// Configuration du transporteur SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

interface EmailPersonContext {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}

interface SessionTemplateContext {
  id: string;
  subject: string;
  scheduledAt: Date;
  duration: number;
  creditCost: number;
}

const formatPersonName = (person?: EmailPersonContext | null) => {
  if (!person) {
    return null;
  }

  if (person.name) {
    return person.name;
  }

  const firstName = person.firstName ?? '';
  const lastName = person.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName.length > 0 ? fullName : null;
};

const buildSessionContext = (session: {
  id: string;
  subject: string;
  scheduledDate: Date;
  startTime: string;
  duration: number;
  creditsUsed: number;
}): SessionTemplateContext => {
  const isoDate = session.scheduledDate.toISOString().split('T')[0];
  const normalizedStart = session.startTime.length === 5 ? `${session.startTime}:00` : session.startTime;

  return {
    id: session.id,
    subject: session.subject,
    scheduledAt: new Date(`${isoDate}T${normalizedStart}`),
    duration: session.duration,
    creditCost: session.creditsUsed,
  };
};

// Templates d'email
const EMAIL_TEMPLATES = {
  WELCOME: {
    subject: '🎓 Bienvenue chez Nexus Réussite !',
    html: (user: EmailPersonContext) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
          <h1>Bienvenue ${user.firstName ?? ''} !</h1>
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
               style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
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
    html: (session: SessionTemplateContext, student: EmailPersonContext, coach?: EmailPersonContext) => {
      const coachDisplayName = formatPersonName(coach) ?? 'Coach assigné automatiquement';

      return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #28a745; color: white; padding: 20px; text-align: center;">
          <h1>✅ Session confirmée !</h1>
        </div>
        <div style="padding: 30px;">
          <p>Bonjour ${student.firstName ?? ''},</p>

          <p>Votre session a été confirmée avec succès !</p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📋 Détails de votre session :</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>📚 Matière :</strong> ${session.subject}</li>
              <li><strong>📅 Date :</strong> ${new Date(session.scheduledAt).toLocaleDateString('fr-FR')}</li>
              <li><strong>🕐 Heure :</strong> ${new Date(session.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</li>
              <li><strong>⏱️ Durée :</strong> ${session.duration} minutes</li>
              <li><strong>👨‍🏫 Coach :</strong> ${coachDisplayName}</li>
              <li><strong>💳 Coût :</strong> ${session.creditCost} crédits</li>
            </ul>
          </div>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>🎥 Rejoindre la session :</h3>
            <p>Le lien de visioconférence sera disponible 15 minutes avant le début de la session dans votre espace personnel.</p>
            <p>
              <a href="${process.env.NEXTAUTH_URL}/dashboard/eleve/mes-sessions"
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
    `;
    }
  },

  SESSION_REMINDER: {
    subject: '⏰ Rappel : Votre session commence dans 1 heure',
    html: (session: SessionTemplateContext, student: EmailPersonContext, videoLink: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ff9800; color: white; padding: 20px; text-align: center;">
          <h1>⏰ Votre session commence bientôt !</h1>
        </div>
        <div style="padding: 30px;">
          <p>Bonjour ${student.firstName ?? ''},</p>

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
export async function sendWelcomeEmail(user: EmailPersonContext) {
  try {
    const template = EMAIL_TEMPLATES.WELCOME;

    await transporter.sendMail({
      from: `"Nexus Réussite" <${process.env.SMTP_FROM}>`,
      to: user.email,
      subject: template.subject,
      html: template.html(user)
    });

    console.log(`Email de bienvenue envoyé à ${user.email}`);
  } catch (error) {
    console.error('Erreur envoi email bienvenue:', error);
    throw error;
  }
}

export async function sendSessionConfirmationEmail(
  session: SessionTemplateContext,
  student: EmailPersonContext,
  coach?: EmailPersonContext
) {
  try {
    const template = EMAIL_TEMPLATES.SESSION_CONFIRMATION;

    await transporter.sendMail({
      from: `"Nexus Réussite" <${process.env.SMTP_FROM}>`,
      to: student.email,
      subject: template.subject,
      html: template.html(session, student, coach)
    });

    // Envoyer aussi au coach si assigné
    if (coach?.email) {
      const coachDisplayName = formatPersonName(coach) ?? 'Coach';
      await transporter.sendMail({
        from: `"Nexus Réussite" <${process.env.SMTP_FROM}>`,
        to: coach.email,
        subject: `Nouvelle session assignée - ${session.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #17a2b8; color: white; padding: 20px; text-align: center;">
              <h1>📚 Nouvelle session assignée</h1>
            </div>
            <div style="padding: 30px;">
              <p>Bonjour ${coachDisplayName},</p>
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
        `
      });
    }

    console.log(`Email de confirmation envoyé pour session ${session.id}`);
  } catch (error) {
    console.error('Erreur envoi email confirmation:', error);
    throw error;
  }
}

export async function sendSessionReminderEmail(
  session: SessionTemplateContext,
  student: EmailPersonContext,
  videoLink: string
) {
  try {
    const template = EMAIL_TEMPLATES.SESSION_REMINDER;

    await transporter.sendMail({
      from: `"Nexus Réussite" <${process.env.SMTP_FROM}>`,
      to: student.email,
      subject: template.subject,
      html: template.html(session, student, videoLink)
    });

    console.log(`Rappel de session envoyé pour ${session.id}`);
  } catch (error) {
    console.error('Erreur envoi rappel session:', error);
    throw error;
  }
}

// Fonction de test de configuration email
export async function testEmailConfiguration() {
  try {
    await transporter.verify();
    return { success: true, message: 'Configuration email valide' };
  } catch (error) {
    console.error('Erreur configuration email:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Job automatique de rappels (à utiliser avec cron)
export async function sendScheduledReminders() {
  try {
    const { prisma } = await import('@/lib/prisma');

    // Sessions qui commencent dans 1 heure
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const fiveMinutesFromOneHour = new Date(oneHourFromNow.getTime() - 5 * 60 * 1000);

    type SessionReminderCandidate = Prisma.SessionBookingGetPayload<{
      include: {
        student: {
          select: {
            email: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    }>;

    const upcomingSessions = await prisma.sessionBooking.findMany({
      where: {
        scheduledDate: {
          gte: fiveMinutesFromOneHour,
          lte: oneHourFromNow
        },
        status: 'SCHEDULED',
        // reminderSent field needs to be added to the Prisma schema first
        // reminderSent: false
      },
      include: {
        student: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    }) as SessionReminderCandidate[];

    for (const session of upcomingSessions) {
      if (!session.student?.email) {
        continue;
      }

      const sessionContext = buildSessionContext(session);
      const studentContext: EmailPersonContext = {
        email: session.student.email,
        firstName: session.student.firstName,
        lastName: session.student.lastName,
      };

      const videoLink = `${process.env.NEXTAUTH_URL}/session/video?id=${session.id}`;

      await sendSessionReminderEmail(
        sessionContext,
        studentContext,
        videoLink
      );

      // Marquer le rappel comme envoyé
      // Uncomment after adding reminderSent field to Prisma schema
      await prisma.sessionBooking.update({
        where: { id: session.id },
        data: {
          // reminderSent: true
          // Temporarily comment this out until schema is updated
        }
      });
    }

    console.log(`${upcomingSessions.length} rappels de session envoyés`);
  } catch (error) {
    console.error('Erreur envoi rappels automatiques:', error);
  }
}
