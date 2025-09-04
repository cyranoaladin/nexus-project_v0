import { Font } from "@react-pdf/renderer";

let interRegistered = false;

export function ensureInterRegistered() {
  if (interRegistered) return;
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const base = path.join(process.cwd(), "public", "fonts");
    const regularPath = path.join(base, "Inter-Subset-E2E.ttf");
    const boldPath = path.join(base, "Inter-Subset-E2E-Bold.ttf");

    if (fs.existsSync(regularPath)) {
      const buf = fs.readFileSync(regularPath);
      const b64 = (typeof Buffer !== 'undefined' ? Buffer.from(buf).toString('base64') : (buf as Uint8Array).toString());
      Font.register({ family: "Inter", src: `data:font/ttf;base64,${b64}` });
    }
    if (fs.existsSync(boldPath)) {
      const bufB = fs.readFileSync(boldPath);
      const b64b = (typeof Buffer !== 'undefined' ? Buffer.from(bufB).toString('base64') : (bufB as Uint8Array).toString());
      Font.register({ family: "InterBold", src: `data:font/ttf;base64,${b64b}` });
    }
    interRegistered = true;
  } catch (e) {
    // Ne pas bloquer la génération; fallback Helvetica
    // eslint-disable-next-line no-console
    console.warn("[PDF][Fonts] Inter registration failed, fallback Helvetica.", e);
  }
}

export function getNexusLogoSrc(): string | undefined {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const p = path.join(process.cwd(), "public", "images", "logo_nexus.png");
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      const b64 = (typeof Buffer !== 'undefined' ? Buffer.from(buf).toString('base64') : (buf as Uint8Array).toString());
      return `data:image/png;base64,${b64}`;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[PDF][Logo] Unable to load logo_nexus.png", e);
  }
  return undefined;
}
