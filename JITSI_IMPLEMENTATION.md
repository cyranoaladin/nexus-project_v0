# Implémentation Visioconférence (Jitsi) — Nexus Réussite

**Dernière mise à jour :** 21 janvier 2026

## 1) État réel du code
- UI : `components/ui/video-conference.tsx` utilise **JitsiMeetExternalAPI** avec le domaine **`meet.jit.si`** en dur.
- API : `app/api/sessions/video/route.ts` génère un `roomName` unique et expose une `jitsiUrl` basée sur `NEXT_PUBLIC_JITSI_SERVER_URL` (fallback `https://meet.jit.si`).
- Page : `/session/video` affiche une interface de visio, mais certaines données sont actuellement simulées côté client.

## 2) Flux côté API
- `POST /api/sessions/video` avec `{ sessionId, action: "JOIN"|"LEAVE" }`
- Sur `JOIN` : statut `IN_PROGRESS` + génération room
- Sur `LEAVE` : statut `COMPLETED`

## 3) Configuration
Variable utile :
```
NEXT_PUBLIC_JITSI_SERVER_URL="https://meet.jit.si"
```

## 4) Points d’attention
- Le composant client **ignore** la variable d’env et utilise `meet.jit.si` en dur.
- Si vous souhaitez une instance privée, alignez le composant UI avec `NEXT_PUBLIC_JITSI_SERVER_URL`.

