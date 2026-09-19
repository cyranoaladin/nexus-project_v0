/**
 * Go-live §AN — billing / entitlement boundary.
 *
 *   Subscription  = commercial contract / payment authority (Core v1 billing).
 *   Entitlement   = technical access authority (Core v1 billing).
 *
 * Core v2 must not invent a THIRD billing truth: its schema declares no
 * billing model and its runtime never reads or writes one — neither through
 * the Core v2 client (there is nothing to reach) nor through the Core v1
 * client (Core v2 runtime is forbidden from importing it at all, see the
 * client-authority guard). A staff screen that needs billing reads it
 * through the canonical Core v1 billing service, outside lib/core-v2.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFilesRecursive } from './helpers/core-v2-client-authority-guard';

const root = process.cwd();
const BILLING_MODELS = ['Subscription', 'Payment', 'Invoice', 'InvoiceItem', 'Entitlement', 'CreditTransaction', 'Credit', 'Quote'];
const BILLING_DELEGATES = /\b(subscription|payment|invoice|invoiceItem|entitlement|creditTransaction|credit|quote)\.(findMany|findUnique|findFirst|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate)\(/;

describe('CORE_V2_NO_THIRD_BILLING_TRUTH (go-live §AN)', () => {
  const schema = readFileSync(join(root, 'core-v2/prisma/schema.prisma'), 'utf8');

  test('the Core v2 schema declares no billing model and no relation to one', () => {
    for (const model of BILLING_MODELS) {
      expect(schema).not.toMatch(new RegExp(`^model ${model} \\{`, 'm'));
      // No field typed with a billing model either (a relation would be a second FK truth).
      expect(schema).not.toMatch(new RegExp(`^\\s+\\w+\\s+${model}(\\[\\]|\\?)?\\s*(@|$)`, 'm'));
    }
  });

  test('no Core v2 runtime file touches a billing delegate (v1 or otherwise)', () => {
    const files = [join(root, 'lib/core-v2'), join(root, 'app/api/v2')].flatMap((dir) => listFilesRecursive(dir));
    const offenders = files
      .filter((file) => BILLING_DELEGATES.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });

  test('the Core v2 dashboards do not fetch Core v1 billing endpoints', () => {
    const files = listFilesRecursive(join(root, 'components/dashboard/core-v2'));
    const offenders = files
      .filter((file) => /\/api\/(parent|admin|assistante)\/(subscriptions|payments|invoices|credits|entitlements)/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });

  test('sanity: the guard would catch a billing model', () => {
    expect(/^model Subscription \{/m.test('model Subscription {\n  id String\n}')).toBe(true);
    expect(BILLING_DELEGATES.test("await prisma.subscription.findMany({ where: {} })")).toBe(true);
  });
});
