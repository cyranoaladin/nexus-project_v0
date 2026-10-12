import { ok } from '@/lib/core-v2/http/respond';
import { assertNoPrivateStoragePath, PrivateStoragePathExposedError } from '@/lib/core-v2/http/private-path-guard';
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

test('au-delà de la profondeur bornée, la garde REFUSE au lieu de laisser passer', () => {
  // Une garde de sortie qui échoue ouverte ne garde rien : un `storageKey`
  // enfoui plus profond que la limite sortait sans être vu.
  let deep: Record<string, unknown> = { storageKey: 'private/path.enc' };
  for (let i = 0; i < 20; i += 1) deep = { nested: deep };
  expect(() => assertNoPrivateStoragePath(deep)).toThrow(PrivateStoragePathExposedError);

  // Et une charge légitime, peu profonde, passe toujours.
  expect(() => assertNoPrivateStoragePath({ a: { b: { c: { d: 1 } } } })).not.toThrow();
});
