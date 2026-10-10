/**
 * Governance test for the in-flight hardening of scripts/ops/backup_restore.py
 * applied during the 2026-10-10 go-live: AND/OR-associativity normalization in
 * canonical_constraint().
 *
 * Why this exists: dump -> restore reparses PostgreSQL CHECK constraints, so
 * BETWEEN/IN expand to grouped sub-ANDs and the live catalog may render
 * ((A AND B) AND C) while the restored copy flattens to A AND B AND C. These are
 * logically identical; the verifier's byte comparison flagged a false mismatch.
 *
 * This test drives the REAL tracked module (no reimplementation): it imports
 * canonical_constraint and the preserved pre-fix pass (_varchar_norm) from the
 * committed file and asserts the behavioural contract. It needs python3 on PATH
 * (present on the CI unit runner); no database, no network.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MODULE = path.resolve(__dirname, '../../scripts/ops/backup_restore.py');
const PYTHON = process.env.PYTHON || 'python3';

const HARNESS = `import importlib.util, json, sys

spec = importlib.util.spec_from_file_location("backup_restore", sys.argv[1])
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
cc = m.canonical_constraint
vn = m._varchar_norm

cases = []
def rec(name, ok, detail=""):
    cases.append({"name": name, "ok": bool(ok), "detail": str(detail)})

def safe(fn, *a):
    try:
        return ("ok", fn(*a))
    except Exception as e:  # must never raise
        return ("raised", repr(e))

# RED / GREEN: associativity-equivalent CHECKs
g = "CHECK (((a > 0) AND (b > 0)) AND (c > 0))"
f = "CHECK ((a > 0) AND (b > 0) AND (c > 0))"
rec("red_pre_fix_varchar_only_differs", vn(g) != vn(f), (vn(g), vn(f)))
rec("green_assoc_equivalent_equal", cc(g) == cc(f), (cc(g), cc(f)))

# BETWEEN/IN expand to grouped sub-ANDs; reparse flattens them
b1 = "CHECK (((x >= 1) AND (x <= 10)) AND (y IS NOT NULL))"
b2 = "CHECK ((x >= 1) AND (x <= 10) AND (y IS NOT NULL))"
rec("green_between_shape_equal", cc(b1) == cc(b2), (cc(b1), cc(b2)))

o1 = "CHECK (((a = 1) OR (a = 2)) OR (a = 3))"
o2 = "CHECK ((a = 1) OR (a = 2) OR (a = 3))"
rec("green_or_chain_equal", cc(o1) == cc(o2), (cc(o1), cc(o2)))

# A genuinely different constraint must stay different
rec("diff_operator_and_vs_or",
    cc("CHECK ((a > 0) AND (b > 0))") != cc("CHECK ((a > 0) OR (b > 0))"), "")
mixed_a = "CHECK (((a) OR (b)) AND (c))"
mixed_b = "CHECK ((a) OR ((b) AND (c)))"
rec("diff_mixed_precedence_preserved", cc(mixed_a) != cc(mixed_b),
    (cc(mixed_a), cc(mixed_b)))
rec("diff_operand",
    cc("CHECK ((a > 0) AND (b > 0))") != cc("CHECK ((a > 0) AND (b > 1))"), "")

# Robustness: idempotent, never raises, passes unknown shapes through
rec("idempotent", cc(cc(g)) == cc(g), (cc(cc(g)), cc(g)))
st, val = safe(cc, "CHECK ((a AND b)")
rec("malformed_no_raise", st == "ok", (st, val))
rec("malformed_passthrough", val == "CHECK ((a AND b)", val)
rec("non_check_passthrough", cc("UNIQUE (a, b)") == "UNIQUE (a, b)", cc("UNIQUE (a, b)"))

# Pre-existing varchar-array normalization still composed and idempotent
vch = "CHECK ((status = ANY (ARRAY['a'::character varying, 'b'::character varying]::text[])))"
st2, _ = safe(cc, vch)
rec("varchar_no_raise", st2 == "ok", st2)
rec("varchar_idempotent", cc(cc(vch)) == cc(vch), "")

print(json.dumps(cases))
`;

function runHarness() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-harness-'));
  const hp = path.join(dir, 'harness.py');
  fs.writeFileSync(hp, HARNESS);
  const r = spawnSync(PYTHON, ['-I', hp, MODULE], { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`canonical_constraint harness failed (status ${r.status}):\n${r.stderr || r.stdout}`);
  }
  const line = r.stdout.trim().split('\n').pop();
  return JSON.parse(line);
}

const cases = runHarness();

describe('backup_restore.py canonical_constraint — AND/OR associativity normalization', () => {
  it('runs every behavioural probe against the tracked module', () => {
    expect(cases.length).toBeGreaterThanOrEqual(13);
  });

  it.each(cases.map((c) => [c.name, c]))('%s', (_name, c) => {
    // On failure the detail (normalized forms) is shown for diagnosis.
    expect({ ok: c.ok, detail: c.detail }).toEqual({ ok: true, detail: c.detail });
  });
});
