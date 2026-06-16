import { NextResponse } from "next/server";
import { guardRateLimitAsync } from "@/lib/rate-limit";
import { captureContactLead, ContactLeadValidationError } from "@/lib/crm/contact-leads";

export async function POST(request: Request) {
  try {
    const blocked = await guardRateLimitAsync(request, { preset: "api", keySuffix: "contact" });
    if (blocked) return blocked;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid_json" },
        { status: 400 }
      );
    }

    const lead = await captureContactLead(payload);

    if (process.env.CONTACT_DEBUG === "1") {
      console.log("[contact]", {
        leadId: lead.id,
        profile: lead.profile,
        interest: lead.interest,
        urgency: lead.urgency,
        source: lead.source,
      });
    }

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (error) {
    if (error instanceof ContactLeadValidationError) {
      return NextResponse.json(
        { ok: false, error: error.code },
        { status: 400 }
      );
    }

    console.error("[contact] error", error);
    return NextResponse.json({ ok: false, error: "lead_capture_failed" }, { status: 500 });
  }
}
