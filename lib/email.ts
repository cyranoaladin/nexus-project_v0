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

// ─── Password Reset Email ────────────────────────────────────────────────────

/**
 * Send a password reset email with a signed token link.
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  resetUrl: string
) {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'Nexus Réussite <contact@nexusreussite.academy>',
    to: email,
    subject: '🔐 Réinitialisation de votre mot de passe — Nexus Réussite',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563EB, #7C3AED); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Réinitialisation du mot de passe</h1>
        </div>

        <div style="padding: 30px; background: #f9f9f9;">
          <h2>Bonjour ${firstName},</h2>

          <p>Vous avez demandé la réinitialisation de votre mot de passe sur Nexus Réussite.</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563EB;">
            <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background: #2563EB; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              Réinitialiser mon mot de passe
            </a>
          </div>

          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              ⏰ Ce lien expire dans <strong>1 heure</strong>.<br>
              🔒 Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
            </p>
          </div>

          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
            Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
            <a href="${resetUrl}" style="color: #2563EB; word-break: break-all;">${resetUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

          <p>Une question ? Contactez-nous :</p>
          <ul>
            <li>📞 +216 99 19 28 29</li>
            <li>📧 contact@nexusreussite.academy</li>
          </ul>

          <p>Cordialement,<br><strong>L'équipe Nexus Réussite</strong></p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log('[Password Reset] Email envoyé à:', email.replace(/(?<=.{2}).*(?=@)/, '***'));
  } catch (error) {
    console.error('[Password Reset] Erreur envoi email:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log('[Password Reset] Email non envoyé en mode développement');
      return;
    }
    throw error;
  }
}

// ─── Stage Février 2026 Email Templates ──────────────────────────────────────

/**
 * Template A: Email post-inscription au stage
 * Envoyé immédiatement après l'inscription avec le lien vers le diagnostic
 */
export async function sendStageDiagnosticInvitation(
  email: string,
  parentName: string,
  studentName: string | null,
  academyTitle: string,
  diagnosticUrl: string
) {
  const displayName = studentName || parentName;
  const mailOptions = {
    from: process.env.SMTP_FROM || 'Nexus Réussite <contact@nexusreussite.academy>',
    to: email,
    subject: '🎯 Stage Février 2026 — Passe ton test de positionnement',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800;">Stage Février 2026</h1>
          <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 16px;">Maths & NSI — ${academyTitle}</p>
        </div>

        <!-- Body -->
        <div style="padding: 40px 30px; background: white;">
          <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 16px 0;">Bienvenue ${displayName} ! 👋</h2>
          
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
            Ton inscription au <strong>Stage Février 2026</strong> est confirmée. Bravo pour cette première étape !
          </p>

          <div style="background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 18px; display: flex; align-items: center;">
              🎯 Prochaine étape : Ton test de positionnement
            </h3>
            <p style="color: #1e40af; margin: 0 0 16px 0; line-height: 1.6; font-size: 14px;">
              Pour que nous puissions t'accompagner au mieux, nous avons besoin de connaître ton niveau actuel.
              Ce test de <strong>50 questions</strong> (30 Maths + 20 NSI) nous permettra de te placer dans le groupe le plus adapté.
            </p>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px; font-size: 14px;">
              <li style="margin-bottom: 8px;">⏱️ Durée : ~25 minutes</li>
              <li style="margin-bottom: 8px;">📝 Pas de stress : ce n'est pas une note</li>
              <li style="margin-bottom: 8px;">💡 Sois honnête : utilise le bouton "Je ne sais pas" si besoin</li>
            </ul>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${diagnosticUrl}"
               style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
              Passer le test maintenant →
            </a>
          </div>

          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="color: #64748b; margin: 0; font-size: 13px; line-height: 1.5;">
              <strong style="color: #475569;">💡 Conseil :</strong> Installe-toi dans un endroit calme, prends ton temps, et réponds avec sincérité.
              Le bouton "Je n'ai pas encore vu cette notion" est là pour toi — l'utiliser est un signe de maturité, pas de faiblesse.
            </p>
          </div>

          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
            Une fois le test terminé, tu recevras immédiatement ton <strong>bilan personnalisé</strong> avec ton profil de compétences.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">

          <p style="color: #64748b; font-size: 13px; margin: 0;">
            Des questions ? Contacte-nous :<br>
            📞 +216 99 19 28 29<br>
            📧 contact@nexusreussite.academy
          </p>

          <p style="color: #475569; font-size: 14px; margin: 24px 0 0 0;">
            À très vite,<br>
            <strong>L'équipe Nexus Réussite</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="padding: 20px 30px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Stage Février 2026 — ${academyTitle}<br>
            Nexus Réussite © ${new Date().getFullYear()}
          </p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log('[Stage] Email diagnostic invitation envoyé à:', email);
  } catch (error) {
    console.error('[Stage] Erreur envoi email diagnostic:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log('[Stage] Email non envoyé en mode développement');
      return;
    }
    throw error;
  }
}

/**
 * Template B: Email post-diagnostic
 * Envoyé après la soumission du diagnostic avec le lien vers le bilan
 */
export async function sendStageBilanReady(
  email: string,
  parentName: string,
  studentName: string | null,
  academyTitle: string,
  bilanUrl: string,
  globalScore: number,
  confidenceIndex: number
) {
  const displayName = studentName || parentName;
  const scoreLabel = globalScore >= 70 ? 'Excellent' : globalScore >= 50 ? 'Solide' : globalScore >= 30 ? 'En progression' : 'À renforcer';
  const scoreColor = globalScore >= 70 ? '#22c55e' : globalScore >= 50 ? '#3b82f6' : globalScore >= 30 ? '#f59e0b' : '#ef4444';
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'Nexus Réussite <contact@nexusreussite.academy>',
    to: email,
    subject: '✨ Ton bilan de compétences est prêt !',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800;">✨ Bilan Prêt !</h1>
          <p style="color: #d1fae5; margin: 8px 0 0 0; font-size: 16px;">Ton profil de compétences est disponible</p>
        </div>

        <!-- Body -->
        <div style="padding: 40px 30px; background: white;">
          <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 16px 0;">Bravo ${displayName} ! 🎉</h2>
          
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
            Tu as terminé le test de positionnement. Notre moteur pédagogique a analysé tes réponses et ton <strong>bilan personnalisé</strong> est maintenant disponible.
          </p>

          <!-- Score Card -->
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dbeafe 100%); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center; border: 2px solid ${scoreColor};">
            <div style="display: inline-block; background: white; padding: 20px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Score Global</p>
              <p style="color: ${scoreColor}; margin: 0; font-size: 48px; font-weight: 900; line-height: 1;">${Math.round(globalScore)}</p>
              <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 14px;">/100</p>
              <p style="color: ${scoreColor}; margin: 12px 0 0 0; font-size: 16px; font-weight: 700;">${scoreLabel}</p>
            </div>
            <p style="color: #475569; margin: 16px 0 0 0; font-size: 14px;">
              Indice de confiance : <strong>${Math.round(confidenceIndex)}%</strong>
            </p>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin: 0 0 12px 0; font-size: 16px;">📊 Ce que tu vas découvrir dans ton bilan :</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
              <li>Ton <strong>radar de compétences</strong> (Maths & NSI)</li>
              <li>Tes <strong>points forts</strong> et axes de progression</li>
              <li>Une analyse détaillée par domaine</li>
              <li>Des recommandations personnalisées pour le stage</li>
            </ul>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${bilanUrl}"
               style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
              Voir mon bilan complet →
            </a>
          </div>

          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="color: #64748b; margin: 0; font-size: 13px; line-height: 1.5;">
              <strong style="color: #475569;">💡 Astuce :</strong> Tu peux imprimer ou télécharger ton bilan en PDF directement depuis la page.
              Garde-le précieusement pour suivre ta progression pendant le stage !
            </p>
          </div>

          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
            Notre équipe va maintenant te placer dans le <strong>groupe le plus adapté</strong> à ton profil.
            Un coach te contactera bientôt pour préparer ta venue au stage.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">

          <p style="color: #64748b; font-size: 13px; margin: 0;">
            Des questions sur ton bilan ? Contacte-nous :<br>
            📞 +216 99 19 28 29<br>
            📧 contact@nexusreussite.academy
          </p>

          <p style="color: #475569; font-size: 14px; margin: 24px 0 0 0;">
            À très bientôt au stage,<br>
            <strong>L'équipe Nexus Réussite</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="padding: 20px 30px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Stage Février 2026 — ${academyTitle}<br>
            Nexus Réussite © ${new Date().getFullYear()}
          </p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log('[Stage] Email bilan ready envoyé à:', email);
  } catch (error) {
    console.error('[Stage] Erreur envoi email bilan:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log('[Stage] Email non envoyé en mode développement');
      return;
    }
    throw error;
  }
}
