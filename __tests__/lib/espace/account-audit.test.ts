/**
 * Audit des comptes élèves de l'espace (`provision.ts audit-accounts`) : lecture seule.
 *
 * Objectif terrain (10/10) : savoir, SANS toucher aux comptes, quels élèves peuvent se connecter
 * avec le code que leur famille détient, lesquels ont déjà choisi leur propre code, et lesquels
 * sont réellement cassés (code émis périmé jamais remplacé, compte sans code, compte désactivé).
 * Aucun secret n'apparaît dans la sortie : les codes émis ne servent qu'à une comparaison bcrypt.
 */
import {
  auditAccounts,
  classifyAccount,
  parseIssuedCredentialsFile,
  type AccountVerdict,
} from '@/lib/espace/provisioning';
import { formatPin, hashPin } from '@/lib/espace/pin';

describe('classifyAccount — la vérité ne vient que de l’état du compte', () => {
  const base = { active: true, hasPin: true, pinMustChange: false, issuedCodeValid: null as boolean | null };
  it.each<[Partial<typeof base>, AccountVerdict]>([
    [{ active: false }, 'DESACTIVE'],
    [{ active: false, hasPin: false }, 'DESACTIVE'],
    [{ hasPin: false }, 'SANS_CODE'],
    [{ hasPin: false, issuedCodeValid: true }, 'SANS_CODE'],
    [{ issuedCodeValid: true, pinMustChange: true }, 'JAMAIS_CONNECTE'],
    [{ issuedCodeValid: true, pinMustChange: false }, 'CODE_EMIS_ACTIF'],
    [{ issuedCodeValid: false, pinMustChange: false }, 'CODE_CHANGE_PAR_ELEVE'],
    [{ issuedCodeValid: false, pinMustChange: true }, 'CODE_EMIS_PERIME'],
    [{ issuedCodeValid: null, pinMustChange: true }, 'CODE_NON_FOURNI'],
    [{ issuedCodeValid: null, pinMustChange: false }, 'CODE_NON_FOURNI'],
  ])('%o → %s', (over, verdict) => {
    expect(classifyAccount({ ...base, ...over })).toBe(verdict);
  });
});

describe('parseIssuedCredentialsFile — formats réels des fichiers 0600', () => {
  it('format texte « nom;identifiant;code » (commentaires et lignes vides ignorés)', () => {
    const txt = '# nom;identifiant;code personnel — à transmettre puis détruire\nAda EXEMPLE;ada.e;ABCD-2345\n\nBob EXEMPLE;bob.e;WXYZ-7777\n';
    const m = parseIssuedCredentialsFile(txt, 'codes.txt');
    expect([...m.keys()].sort()).toEqual(['ada.e', 'bob.e']);
    expect(m.get('ada.e')).toBe('ABCD-2345');
  });

  it('format JSON [{username, secret}]', () => {
    const m = parseIssuedCredentialsFile(JSON.stringify([{ username: 'cleo.e', secret: 'MNPQ2345' }]), 'credentials.json');
    expect(m.get('cleo.e')).toBe('MNPQ2345');
  });

  it('un doublon d’identifiant entre fichiers est un conflit, pas un écrasement silencieux', () => {
    const m = parseIssuedCredentialsFile('A;ada.e;ABCD-2345\n', 'f1.txt');
    expect(() => parseIssuedCredentialsFile('A;ada.e;WXYZ-7777\n', 'f2.txt', m)).toThrow(/ada\.e/);
    // Le même code re-listé n'est pas un conflit.
    expect(() => parseIssuedCredentialsFile('A;ada.e;ABCD-2345\n', 'f3.txt', m)).not.toThrow();
  });

  it('refuse une ligne illisible plutôt que de la deviner', () => {
    expect(() => parseIssuedCredentialsFile('juste-un-mot\n', 'f.txt')).toThrow(/f\.txt/);
  });
});

describe('auditAccounts — lecture seule contre la base', () => {
  async function fakeDb() {
    const mkUser = async (u: {
      username: string; firstName: string; lastName: string; pin: string | null;
      pinMustChange?: boolean; disabledAt?: Date | null; groups?: string[]; published?: number;
    }) => ({
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      pinHash: u.pin === null ? null : await hashPin(u.pin),
      pinMustChange: u.pinMustChange ?? false,
      pinSetAt: u.pin === null ? null : new Date('2026-10-03T05:00:00Z'),
      disabledAt: u.disabledAt ?? null,
      espaceEnrollments: (u.groups ?? ['terminale-principal']).map((slug) => ({ subject: 'MATHEMATIQUES', group: { slug, name: slug } })),
      espaceSessionSeats: Array.from({ length: u.published ?? 0 }, (_, i) => ({ id: `s${i}` })),
    });
    const users = [
      await mkUser({ username: 'jamais.c', firstName: 'Jamais', lastName: 'CONNECTE', pin: 'ABCD2345', pinMustChange: true, published: 1 }),
      await mkUser({ username: 'garde.c', firstName: 'Garde', lastName: 'SONCODE', pin: 'WXYZ7777', pinMustChange: false }),
      // Le code émis (celui du fichier) ne correspond plus : l'élève a posé le sien.
      await mkUser({ username: 'achange.c', firstName: 'Achange', lastName: 'LESIEN', pin: 'NOUVEAU9', pinMustChange: false }),
      await mkUser({ username: 'perime.c', firstName: 'Perime', lastName: 'CASSE', pin: 'AUTRE234', pinMustChange: true }),
      await mkUser({ username: 'sans.code', firstName: 'Sans', lastName: 'CODE', pin: null }),
      await mkUser({ username: 'ferme.c', firstName: 'Ferme', lastName: 'OFF', pin: 'ABCD2345', disabledAt: new Date() }),
      await mkUser({ username: 'val.x', firstName: 'Val', lastName: 'TECH', pin: 'ABCD2345', groups: ['validation-technique'] }),
      await mkUser({ username: 'inconnu.c', firstName: 'Inconnu', lastName: 'SANSFICHIER', pin: 'QQQQ2345', pinMustChange: false }),
    ];
    return {
      user: {
        findMany: jest.fn(async () => users),
      },
    };
  }

  const issued = new Map<string, string>([
    ['jamais.c', formatPin('ABCD2345')],
    ['garde.c', 'wxyz-7777'], // saisie tolérante : casse et tirets sans effet
    ['achange.c', 'ABCD-2345'],
    ['perime.c', 'ABCD-2345'],
    ['ferme.c', 'ABCD-2345'],
    ['fantome.c', 'ABCD-2345'], // dans un fichier mais absent de la base
  ]);

  it('classe chaque compte sans jamais exposer un secret, et signale les identifiants fantômes', async () => {
    const db = await fakeDb();
    const { rows, unknownIssued } = await auditAccounts(db as never, issued);
    const byU = Object.fromEntries(rows.map((r) => [r.username, r]));
    expect(byU['jamais.c']).toMatchObject({ verdict: 'JAMAIS_CONNECTE', issuedCodeValid: true, publishedSessions: 1, validation: false });
    expect(byU['garde.c']).toMatchObject({ verdict: 'CODE_EMIS_ACTIF', issuedCodeValid: true });
    expect(byU['achange.c']).toMatchObject({ verdict: 'CODE_CHANGE_PAR_ELEVE', issuedCodeValid: false });
    expect(byU['perime.c']).toMatchObject({ verdict: 'CODE_EMIS_PERIME' });
    expect(byU['sans.code']).toMatchObject({ verdict: 'SANS_CODE', hasPin: false });
    expect(byU['ferme.c']).toMatchObject({ verdict: 'DESACTIVE' });
    expect(byU['val.x']).toMatchObject({ validation: true });
    expect(byU['inconnu.c']).toMatchObject({ verdict: 'CODE_NON_FOURNI', issuedCodeValid: null });
    expect(unknownIssued).toEqual(['fantome.c']);
    // Aucune fuite : ni code en clair ni empreinte dans les lignes du rapport.
    const dump = JSON.stringify(rows);
    for (const secret of ['ABCD2345', 'WXYZ7777', 'NOUVEAU9', '$2']) expect(dump).not.toContain(secret);
  });

  it('la requête est bien bornée aux élèves possédant un identifiant', async () => {
    const db = await fakeDb();
    await auditAccounts(db as never, new Map());
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ role: 'ELEVE', username: { not: null } }) }));
  });
});
