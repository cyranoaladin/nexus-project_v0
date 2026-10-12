import { ok } from '@/lib/core-v2/http/respond';
describe('garde de frontiere HTTP', () => {
  test('une reponse propre passe', () => {
    expect(() => ok({ submissions: [{ id: 's1', version: 1 }] }, 'c1')).not.toThrow();
  });
  test("une reponse portant un chemin prive est REFUSEE a la sortie", () => {
    expect(() => ok({ submissions: [{ id: 's1', storageKey: 'a/b.pdf' }] }, 'c1'))
      .toThrow(/PRIVATE_STORAGE_PATH_EXPOSED/);
  });
  test('la detection traverse les structures imbriquees', () => {
    expect(() => ok({ a: { b: [{ c: { storageKey: null } }] } }, 'c1'))
      .toThrow(/PRIVATE_STORAGE_PATH_EXPOSED/);
  });
});
