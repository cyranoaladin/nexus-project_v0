export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

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

    // 2. Validate environment variables
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramToken || !telegramChatId) {
      console.error("Telegram credentials not configured in environment variables");
      // Still return success to user - reservation is "registered" even without notification
      return NextResponse.json({
        success: true,
        message: "Réservation enregistrée",
      });
    }

    // 3. Sanitize user input for Telegram Markdown
    const sanitize = (str: string) => str.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

    // 4. Mise en forme du message d'alerte
    const message = `
🚨 *NOUVEAU LEAD CHAUD (Site Web)* 🚨
➖➖➖➖➖➖➖➖➖➖➖
👤 *Parent :* ${sanitize(String(body.parent))}
📞 *Tél :* ${sanitize(String(body.phone))}
🎓 *Classe :* ${sanitize(String(body.classe || 'Non précisé'))}
🏫 *Intérêt :* ${sanitize(String(body.academyTitle || 'Non précisé'))}
💰 *Montant :* ${sanitize(String(body.price || 'N/A'))} TND
➖➖➖➖➖➖➖➖➖➖➖
_Ce prospect attend votre appel !_
`;

    // 5. Envoi automatique vers Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    if (!telegramResponse.ok) {
      console.error("Erreur Telegram:", await telegramResponse.text());
    }

    return NextResponse.json({
      success: true,
      message: "Réservation enregistrée",
    });
  } catch (error) {
    console.error("Erreur API reservation:", error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { success: false, message: "Erreur serveur interne" },
      { status: 500 }
    );
  }
}
