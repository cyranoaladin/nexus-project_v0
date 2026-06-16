jest.mock("@/lib/crm/contact-leads", () => ({
  captureContactLead: jest.fn().mockResolvedValue({ id: "debug", profile: null, interest: null, urgency: null, source: null }),
  ContactLeadValidationError: class ContactLeadValidationError extends Error { code = "invalid_payload"; },
}));

import { _resetStoreForTests } from "@/lib/rate-limit";
import { POST } from "@/app/api/contact/route";

function makeRequest(body: Record<string, unknown>, ip = "198.51.100.20") {
  return new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("debug contact rate", () => {
  it("progresses through requests", async () => {
    _resetStoreForTests();
    const payload = { name: "Alex", email: "alex@example.com" };
    const started = Date.now();
    for (let i = 0; i < 62; i++) {
      const before = Date.now();
      const res = await POST(makeRequest(payload));
      console.log("iter", i, "status", res.status, "ms", Date.now() - before, "total", Date.now() - started);
      if (res.status === 429) break;
    }
  }, 15000);
});
