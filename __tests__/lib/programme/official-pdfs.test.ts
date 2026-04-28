import {
  OFFICIAL_PDFS,
  getOfficialPdf,
  getRegisteredSlugs,
  listOfficialPdfsForProfile,
  type OfficialPdfMetadata,
} from "@/lib/programme/official-pdfs";

describe("lib/programme/official-pdfs (Lot A stub)", () => {
  describe("OFFICIAL_PDFS shape contract", () => {
    it("is an object (record)", () => {
      expect(typeof OFFICIAL_PDFS).toBe("object");
      expect(OFFICIAL_PDFS).not.toBeNull();
    });

    it("is frozen (immutable export)", () => {
      expect(Object.isFrozen(OFFICIAL_PDFS)).toBe(true);
    });

    it("entries respect the OfficialPdfMetadata shape (when populated)", () => {
      // Lot A: empty stub. Once populated (lot B), every entry must match the contract.
      const allowedCategories = ["PROGRAM", "AUTOMATISMES", "SUJET", "EXEMPLE"];
      const allowedLevels = ["PREMIERE", "TERMINALE"];
      const allowedSources = ["MEN", "NEXUS", "PARTNER"];

      for (const [slug, pdf] of Object.entries(OFFICIAL_PDFS)) {
        const entry: OfficialPdfMetadata = pdf;
        expect(entry.slug).toBe(slug);
        expect(entry.slug).toMatch(/^[a-z0-9][a-z0-9-]*$/);
        expect(entry.filename).toMatch(/\.pdf$/i);
        expect(entry.baseDir).toMatch(/^programmes\//);
        expect(allowedCategories).toContain(entry.category);
        expect(allowedLevels).toContain(entry.level);
        expect(allowedSources).toContain(entry.source);
      }
    });

    it("slugs are unique across the mapping", () => {
      const slugs = Object.values(OFFICIAL_PDFS).map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  });

  describe("getOfficialPdf", () => {
    it("returns undefined for unknown slug", () => {
      expect(getOfficialPdf("does-not-exist")).toBeUndefined();
    });

    it("returns undefined for path-traversal slug attempts", () => {
      expect(getOfficialPdf("../../../etc/passwd")).toBeUndefined();
      expect(getOfficialPdf("..")).toBeUndefined();
    });
  });

  describe("listOfficialPdfsForProfile", () => {
    it("returns an array (even when mapping is empty)", () => {
      const list = listOfficialPdfsForProfile("PREMIERE", "EDS_GENERALE");
      expect(Array.isArray(list)).toBe(true);
    });

    it("returns empty array for empty stub mapping (Lot A baseline)", () => {
      // This assertion will need to be updated in Lot B when entries are added.
      // Until then, it documents the Lot A baseline.
      const eds = listOfficialPdfsForProfile("PREMIERE", "EDS_GENERALE");
      const stmg = listOfficialPdfsForProfile("PREMIERE", "STMG");
      const term = listOfficialPdfsForProfile("TERMINALE", "EDS_GENERALE");
      expect(eds).toEqual([]);
      expect(stmg).toEqual([]);
      expect(term).toEqual([]);
    });
  });

  describe("getRegisteredSlugs", () => {
    it("returns a Set", () => {
      expect(getRegisteredSlugs()).toBeInstanceOf(Set);
    });

    it("size matches OFFICIAL_PDFS keys count", () => {
      expect(getRegisteredSlugs().size).toBe(Object.keys(OFFICIAL_PDFS).length);
    });
  });
});
