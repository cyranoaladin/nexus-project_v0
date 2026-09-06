import { readFileSync } from 'fs';
import path from 'path';
const schema = () => readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
describe('Additive parent telephone identity', () => {
  it('keeps contact phone nonunique and adds a versioned opt-in identity and hashed challenge', () => {
    const content = schema();
    expect(content).toMatch(/parentPhoneState\s+ParentPhoneState\s+@default\(NONE\)/);
    expect(content).toMatch(/parentPhoneVersion\s+Int\s+@default\(0\)/);
    expect(content).toMatch(/phoneVerifiedAt\s+DateTime\?/);
    expect(content).toMatch(/model ParentPhoneChallenge/);
    expect(content).toMatch(/tokenHash\s+String\s+@unique/);
    expect(content).not.toMatch(/phoneNormalized\s+String\?\s+@unique/);
  });
});
