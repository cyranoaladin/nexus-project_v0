import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const name = String(payload?.name ?? "").trim();
    const email = String(payload?.email ?? "").trim();

    if (!name || !email) {
      return NextResponse.json(
        { ok: false, error: "missing_required" },
        { status: 400 }
      );
    }

    // Placeholder: wire to email/CRM provider.
    console.log("[contact]", {
      profile: payload?.profile,
      interest: payload?.interest,
      urgency: payload?.urgency,
      name,
      email,
      phone: payload?.phone,
      message: payload?.message,
      source: payload?.source,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[contact] error", error);
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
