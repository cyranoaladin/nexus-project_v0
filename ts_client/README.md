# @nexus/client

Client TypeScript minimaliste pour l'API Nexus (Dashboard, Sessions, Épreuves, Évaluations, RAG).

## Installation

```bash
npm i @nexus/client
# ou, en local, dans ce dossier :
npm run build && npm pack
```

## Usage

```ts
import { NexusApiClient } from "@nexus/client";

const api = new NexusApiClient({ baseUrl: "/pyapi" });
const s = await api.dashboard.epreuves.get("11111111-1111-1111-1111-111111111111");
console.log(s.items);
```
