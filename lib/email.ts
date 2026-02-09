import nodemailer from 'nodemailer';

// Configuration SMTP avec fallback pour développement
const createTransporter = () => {
  // En développement, utiliser un service de test si pas de SMTP configuré
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false,
      ignoreTLS: true
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
};

// Template d'email de bienvenue parent
export async function sendWelcomeParentEmail(
  parentEmail: string,
  parentName: string,
  studentName: string,
  tempPassword?: string
) {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'Nexus Réussite <contact@nexusreussite.academy>',
    to: parentEmail,
    subject: '🎉 Bienvenue chez Nexus Réussite !',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563EB, #2EE9F6); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Bienvenue chez Nexus Réussite !</h1>
        </div>

        <div style="padding: 30px; background: #f9f9f9;">
          <h2>Bonjour ${parentName},</h2>

          <p>Nous sommes ravis de vous accueillir dans la famille Nexus Réussite !</p>

          <p>Votre demande de bilan stratégique gratuit pour <strong>${studentName}</strong> a été enregistrée avec succès.</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📋 Prochaines étapes :</h3>
            <ol>
              <li><strong>Sous 24h :</strong> Notre équipe analyse le profil de ${studentName}</li>
              <li><strong>Appel découverte :</strong> Un échange de 30 minutes pour comprendre vos besoins</li>
              <li><strong>Plan d'action :</strong> Nous vous proposons un accompagnement personnalisé</li>
            </ol>
          </div>

          ${tempPassword ? `
          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>🔐 Vos identifiants de connexion :</h3>
            <p><strong>Email :</strong> ${parentEmail}</p>
            <p><strong>Mot de passe temporaire :</strong> ${tempPassword}</p>
            <p><em>Vous pourrez modifier ce mot de passe lors de votre première connexion.</em></p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}"
               style="background: #2563EB; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Accéder à mon Espace
            </a>
          </div>

          <p>Une question ? Contactez-nous :</p>
          <ul>
            <li>📞 +216 99 19 28 29</li>
            <li>📧 contact@nexusreussite.academy</li>
          </ul>

          <p>À très bientôt,<br><strong>L'équipe Nexus Réussite</strong></p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log('Email de bienvenue envoyé à:', parentEmail);
  } catch (error) {
    console.error('Erreur envoi email:', error);
    // En développement, ne pas faire échouer l'application si l'email ne part pas
    if (process.env.NODE_ENV === 'development') {
      console.log('Email non envoyé en mode développement');
      return;
    }
    throw error;
  }
}

// Email de rappel d'expiration des crédits
export async function sendCreditExpirationReminder(
  parentEmail: string,
  parentName: string,
  studentName: string,
  expiringCredits: number,
  expirationDate: Date
) {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'Nexus Réussite <contact@nexusreussite.academy>',
    to: parentEmail,
    subject: '⏰ Rappel : Vos crédits expirent bientôt',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #F59E0B; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">⏰ Rappel Important</h1>
        </div>

        <div style="padding: 30px;">
          <h2>Bonjour ${parentName},</h2>

          <p>Nous vous informons que <strong>${expiringCredits} crédits</strong> de ${studentName} vont expirer le <strong>${expirationDate.toLocaleDateString('fr-FR')}</strong>.</p>

          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F97316;">
            <h3>💡 Comment utiliser vos crédits ?</h3>
            <ul>
              <li>Réservez un cours particulier en ligne (1 crédit)</li>
              <li>Réservez un cours en présentiel (1,25 crédit)</li>
              <li>Participez à un atelier de groupe (1,5 crédit)</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/dashboard"
               style="background: #2563EB; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Réserver une Session
            </a>
          </div>

          <p>Besoin d'aide ? Notre équipe est là pour vous accompagner !</p>

          <p>Cordialement,<br><strong>L'équipe Nexus Réussite</strong></p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log('Email de rappel crédits envoyé à:', parentEmail);
  } catch (error) {
    console.error('Erreur envoi email rappel:', error);
    // En développement, ne pas faire échouer l'application si l'email ne part pas
    if (process.env.NODE_ENV === 'development') {
      console.log('Email de rappel non envoyé en mode développement');
      return;
    }
    throw error;
  }
}
