/**
 * En-tetes d'une requete mutante emise depuis l'application elle-meme.
 *
 * Les routes canoniques passent leurs `PUT`/`POST` par `checkCsrf`, qui exige
 * une origine connue. Un navigateur ajoute `Origin` de lui-meme sur toute
 * requete mutante same-origin ; `APIRequestContext` ne le fait pas. Sans cet
 * en-tete, une requete forgee par un test est refusee en 403 AVANT d'atteindre
 * la regle metier qu'elle veut eprouver : le test mesurerait la porte CSRF au
 * lieu de la porte visee, et une regression sur cette derniere passerait
 * inaperçue derriere un rouge trompeur.
 *
 * Fournir l'origine reelle ne contourne aucune protection : elle reproduit ce
 * que fait le navigateur, et la porte CSRF reste eprouvee pour elle-meme par
 * les scenarios d'origine etrangere et d'origine absente.
 */
export function sameOriginHeaders(baseURL?: string): Record<string, string> {
  const url = baseURL ?? process.env.BASE_URL ?? 'http://localhost:3002';
  return { Origin: new URL(url).origin };
}
