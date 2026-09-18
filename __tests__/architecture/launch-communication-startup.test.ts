/**
 * Les courriels transactionnels du lancement — activation, réinitialisation
 * de mot de passe, rapport parent — sont tous drainés par UN worker. Ce garde
 * tient les trois conditions sans lesquelles ce worker peut manquer à
 * l'appel sans que personne ne le voie :
 *
 *   1. son démarrage a la même frontière de processus que ses voisins ;
 *   2. la production déclare les variables dont il dépend ;
 *   3. un mode capable d'ouvrir Core v2 prouve au démarrage le TTL de
 *      réinitialisation, que la route publique ne peut pas signaler.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('LAUNCH_COMMUNICATION_STARTUP', () => {
  test('the e-mail outbox scheduler fails the process instead of silently skipping the schedulers after it', () => {
    const src = read('instrumentation.ts');
    const call = src.indexOf('startEmailOutboxScheduler()');
    expect(call).toBeGreaterThan(-1);
    // Le try doit ouvrir AVANT l'appel et le catch sortir du processus.
    const before = src.slice(0, call);
    expect(before.trimEnd().endsWith('try {')).toBe(true);
    const after = src.slice(call);
    expect(after.slice(0, after.indexOf('}'))).not.toMatch(/startBilanWorkerScheduler/);
    expect(after).toMatch(/EMAIL_OUTBOX_PREFLIGHT_FAILED[\s\S]{0,200}process\.exit\(1\)/);
  });

  test('production declares the two variables the drain depends on, with no default', () => {
    const compose = read('docker-compose.prod.yml');
    expect(compose).toMatch(/EMAIL_OUTBOX_WORKER_ENABLED: \$\{EMAIL_OUTBOX_WORKER_ENABLED:\?/);
    expect(compose).toMatch(/EMAIL_OUTBOX_ENCRYPTION_KEY: \$\{EMAIL_OUTBOX_ENCRYPTION_KEY:\?/);
  });

  test('a Core-v2-capable startup proves the password-reset TTL before serving', () => {
    const startup = read('lib/auth/auth-rollout-startup.ts');
    expect(startup).toMatch(/getPasswordResetTtlMs/);
    // Sous la condition de mode : un déploiement V1_ONLY n'a pas à la porter.
    const guarded = startup.slice(startup.indexOf('coreV2AuthEnabled(mode)'));
    expect(guarded.slice(0, guarded.indexOf('return mode'))).toMatch(/getPasswordResetTtlMs\(\)/);
    // Et l'exemple d'environnement ne la laisse plus commentée.
    expect(read('.env.example')).toMatch(/^CORE_V2_PASSWORD_RESET_TTL_MINUTES=/m);
  });
});
