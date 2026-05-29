import { NextResponse } from "next/server";
import { guardRateLimitAsync } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const blocked = await guardRateLimitAsync(request, { preset: "api", keySuffix: "contact" });
    if (blocked) return blocked;

    const payload = await request.json();
    const name = String(payload?.name ?? "").trim();
    const email = String(payload?.email ?? "").trim();

    if (!name || !email) {
      return NextResponse.json(
        { ok: false, error: "missing_required" },
        { status: 400 }
      );
    }

    if (process.env.CONTACT_DEBUG === "1") {
      console.log("[contact]", {
        profile: payload?.profile,
        interest: payload?.interest,
        urgency: payload?.urgency,
        source: payload?.source,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[contact] error", error);
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
