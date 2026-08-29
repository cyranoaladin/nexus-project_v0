# Ticket GitHub Support — Purge du Cache Interne d'Objets Git (PR / Dangling Blobs)

## Date
2026-08-29T20:10:00Z

## Référence Déclarative
- Dépôt : `cyranoaladin/nexus-project_v0`
- Statut des refs autoritatives : `AUTHORITATIVE_GIT_REFS_FORBIDDEN_BLOB_COUNT = 0` (prouvé par vérification complète de toutes les branches `refs/heads/*`, tags `refs/tags/*`, notes et stash).
- Problème : Les 4 objets blobs ci-dessous restent servis publiquement par l'API GitHub Git Blobs (`https://api.github.com/repos/cyranoaladin/nexus-project_v0/git/blobs/{sha}`) car ils sont retenus par des références internes non publiques du cache GitHub (`refs/pull/*` ou pool d'objets non purgés).

---

## Texte du Ticket à Transmettre au Support GitHub

**Subject:** Request for repository garbage collection and PR object cache purge (`cyranoaladin/nexus-project_v0`)

**Message Body:**

Hello GitHub Support Team,

We have completed a strict data privacy remediation on our public repository `cyranoaladin/nexus-project_v0` to remove sensitive/unauthorized files from our Git history using `git-filter-repo`.

We have verified that no active or authoritative git reference points to these files:
- All branches (`refs/heads/*`) are clean.
- All tags (`refs/tags/*`) are clean.
- `AUTHORITATIVE_GIT_REFS_FORBIDDEN_BLOB_COUNT = 0`.

However, the raw Git Blobs API endpoint (`GET /repos/cyranoaladin/nexus-project_v0/git/blobs/:sha`) continues to serve the following 4 blob SHAs:
1. `52d6a9c132ba475bfe0aa4aae7a4297543403499` (17,427,206 bytes)
2. `fc4e532c8a9aa4d9d7a28eccbe4eb2bdbc1db4e1` (932,942 bytes)
3. `6965f6b9e57815f2a2aaae33d19eb4313881f61c` (274,048 bytes)
4. `f170b80d6dfd1e577b7e4ee3a60cc247503f0488` (392,712 bytes)

These objects are exclusively retained in GitHub's internal pull request cache (`refs/pull/*`) and dangling object pool.

Could you please trigger a full garbage collection and cache purge (`git gc --prune=now`) on the server-side mirror of `cyranoaladin/nexus-project_v0` to disconnect and purge these unreachable dangling blobs?

Thank you very much for your assistance.

Best regards,  
Alaeddine Ben Rhouma  
Owner of `cyranoaladin/nexus-project_v0`
