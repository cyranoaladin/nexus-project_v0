# Sécurité, confidentialité et protection des mineurs

## Conclusion

**NO-GO.** Les guards centralisés et les PDF privés montrent une base positive, mais les routes de génération/création, la séparation d'audience, la collecte d'identité publique et les entrées LLM/RAG ne satisfont pas le niveau requis pour des mineurs.

## Threat model minimal

| Actif | Acteur / frontière | Menace | Contrôle existant | Contrôle manquant |
|---|---|---|---|---|
| identité/relations familiales | navigateur → API → DB | falsification, lien frauduleux | session, ownership parent | relation multi-responsable/consentement/audit |
| réponses et scores | public/Student → API | impersonation, correction exposée, double submit | Zod, score serveur, rate-limit | auth ou claim sûr, transaction, idempotency |
| rapports par audience | API → Student/Parent/Coach | fuite croisée/interne | ownership + sanitization partielle | projection stricte par audience/version |
| PDF | stockage → route | chemin prévisible/public | hors `public`, download coach protégé | objet chiffré, URL courte/signée, rétention |
| données LLM | app → fournisseur | PII, invention, injection | timeout/JSON/Zod sur Mistral | minimisation, DPA/localité, redaction, grounding |
| corpus RAG | documents → ingestor → prompt | PII globale, prompt injection, mauvais programme | service séparé | ACL collections, provenance, scan, filtres version |
| jobs | API → DB/worker | perte, duplication, régénération destructive | statuts et unicité partielle | lease, retry/DLQ, audit, immutabilité |
| logs | services/fournisseurs | verbatims/PII | logger structuré partiel | politique et tests anti-PII bout en bout |

Frontières : client non fiable ; session/route ; DB ; service RAG ; fournisseurs LLM ; système de fichiers ; Parent/Student/Coach/Admin. Les chunks et réponses libres sont des entrées hostiles, même si l'utilisateur est authentifié.

## Constats

1. **IDOR/élévation** : `/api/bilans/generate` ne filtre pas l'ID par assignation (`route.ts:45-55,135-188`). Le POST `/api/bilans` ne prouve pas l'assignation coach-élève (`route.ts:140-180`).
2. **Identité élève** : `/api/assessments/submit` est public et persiste email/nom/téléphone fournis par le client (`:28-48,118-137`). `buildAssessmentAccessWhere` autorise aussi un rapprochement par email pour l'élève (`ownership.ts:38-45`).
3. **Audience** : le résultat Assessment renvoie les deux contenus Student/Parent (`result/route.ts:40-56,129-146`). La sanitization `ownership.ts:161-172` n'isole pas ces audiences.
4. **Corrections** : le submit ne renvoie pas les bonnes réponses ; le score est calculé serveur (`submit/route.ts:73-108`). Point positif, à maintenir.
5. **Publication** : `Bilan.isPublished` est global et modifiable avec scores/contenus par PUT ; pas de revue/audit/audience atomique.
6. **PDF** : les routes inspectées protègent plusieurs downloads ; `reportStorage.ts:20-63` bloque `public` et path traversal. Mais le fallback local non persistant et l'absence de stockage objet rendent disponibilité/rétention inconnues.
7. **Injection** : verbatims et chunks RAG sont interpolés dans les prompts sans délimitation/filtrage fort. Le schéma valide la forme, pas la provenance.
8. **PII** : contexte Mistral/Ollama inclut nom, école, réponses/commentaires. Aucun registre de minimisation, base légale, rétention ou preuve d'absence de logs fournisseur n'est fourni.
9. **Audit/régénération** : pas de journal immuable liant acteur, version, prompt, modèle, sources, publication/révocation.

## Contrôles préalables requis

Guards ownership sur chaque mutation/coût, dérivation Student depuis session, relation ParentStudent explicite, DTO par audience, report versions immuables, publication/révocation auditée, idempotency/transaction, secrets et PII minimisés, politique de rétention, tests IDOR DB réels, red-team prompt injection et stockage privé durable.
