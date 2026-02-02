export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

// --- CONFIGURATION TELEGRAM (VOS IDENTIFIANTS) ---
const TELEGRAM_TOKEN = "8559033667:AAE6bsZmpiczAcxCE5UbBVXNux6XFuD1ANU";
const TELEGRAM_CHAT_ID = "1119907425"; // Votre ID personnel (@PierreMuguet)

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Validation de sécurité (Backend)
    if (!body.parent || !body.phone || !body.academyId) {
      return NextResponse.json(
        { success: false, message: "Champs manquants" },
        { status: 400 }
      );
    }

    // 2. Mise en forme du message d'alerte
    const message = `
🚨 *NOUVEAU LEAD CHAUD (Site Web)* 🚨
➖➖➖➖➖➖➖➖➖➖➖
👤 *Parent :* ${body.parent}
📞 *Tél :* [${body.phone}](tel:${body.phone.replace(/\s/g, "")})
🎓 *Classe :* ${body.classe}
🏫 *Intérêt :* ${body.academyTitle}
💰 *Montant :* ${body.price} TND
➖➖➖➖➖➖➖➖➖➖➖
_Ce prospect attend votre appel !_
`;

    // 3. Envoi automatique vers votre Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    if (!telegramResponse.ok) {
      console.error("❌ Erreur Telegram:", await telegramResponse.text());
    } else {
      console.log("✅ Notification Telegram envoyée avec succès.");
    }

    return NextResponse.json({
      success: true,
      message: "Réservation enregistrée",
    });
  } catch (error) {
    console.error("❌ Erreur API:", error);
    return NextResponse.json(
      { success: false, message: "Erreur serveur interne" },
      { status: 500 }
    );
  }
}
