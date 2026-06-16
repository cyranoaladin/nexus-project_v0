import { _resetStoreForTests, checkRateLimitAsync, getRateLimitRuntimeMode } from "@/lib/rate-limit";

describe("debug rate mode", () => {
  it("prints mode", async () => {
    console.log("env", { NODE_ENV: process.env.NODE_ENV, JEST_WORKER_ID: process.env.JEST_WORKER_ID, REDIS_URL: process.env.REDIS_URL, UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? "set" : undefined, mode: getRateLimitRuntimeMode() });
    _resetStoreForTests();
    const req = new Request("http://localhost/api/test", { headers: { "x-forwarded-for": "198.51.100.20" } });
    const result = await checkRateLimitAsync(req, { preset: "api", keySuffix: "contact" });
    console.log("result", result);
  }, 10000);
});
