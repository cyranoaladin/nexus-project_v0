import {
  ACCOMPAGNEMENTS,
  FAQ_ITEMS,
  FORFAITS,
  LANDING_IMAGES,
  NEXUS_SELECT,
  PREMIERE_FINISH,
  PRICING_FOOTNOTE,
  PRICING_GROUP_NOTE,
  URGENCY,
  WHATSAPP_URL,
  WHATSAPP_URL_FINISH,
  WHATSAPP_URL_FORFAITS,
  WHATSAPP_URL_SELECT,
} from "@/components/sections/homepage/content";

describe("Landing content — business invariants", () => {
  describe("pricing", () => {
    it("forfaits have asterisks on all prices", () => {
      for (const plan of FORFAITS.plans) {
        expect(plan.price).toContain("*");
      }
    });

    it("forfaits match expected prices", () => {
      const prices = FORFAITS.plans.map((p) => p.price);
      expect(prices).toEqual(
        expect.arrayContaining([
          expect.stringContaining("180"),
          expect.stringContaining("340"),
          expect.stringContaining("495"),
          expect.stringContaining("640"),
        ])
      );
    });

    it("Première Finish formulas have asterisks", () => {
      for (const formula of PREMIERE_FINISH.formulas) {
        expect(formula.price).toContain("*");
      }
    });

    it("Nexus Select pricing has asterisk", () => {
      expect(NEXUS_SELECT.pricing.price).toContain("*");
    });

    it("Nexus Select pricing is 1 800 TND", () => {
      expect(NEXUS_SELECT.pricing.price).toContain("1 800");
    });

    it("Nexus Select does NOT mention 120 DT", () => {
      const allText = JSON.stringify(NEXUS_SELECT);
      expect(allText).not.toContain("120 DT");
    });

    it("Nexus Select does NOT have groups", () => {
      expect((NEXUS_SELECT as Record<string, unknown>).groups).toBeUndefined();
      expect((NEXUS_SELECT as Record<string, unknown>).groupsNote).toBeUndefined();
    });

    it('footnote mentions "groupe de 4 élèves"', () => {
      expect(PRICING_FOOTNOTE).toContain("groupe de 4 élèves");
    });

    it('footnote mentions "cours individuels, binômes, groupes réduits"', () => {
      expect(PRICING_FOOTNOTE).toContain("cours individuels");
      expect(PRICING_FOOTNOTE).toContain("binômes");
      expect(PRICING_FOOTNOTE).toContain("groupes réduits");
    });

    it('group note mentions "groupe de 4"', () => {
      expect(PRICING_GROUP_NOTE).toContain("groupe de 4");
    });
  });

  describe("Nexus Select", () => {
    it("disclaimer mentions Parcoursup", () => {
      expect(NEXUS_SELECT.disclaimer).toContain("Parcoursup");
    });

    it("disclaimer says Select is NOT Parcoursup help", () => {
      expect(NEXUS_SELECT.disclaimer).toMatch(/ne prépare pas/i);
    });

    it("displays 40 h format", () => {
      expect(NEXUS_SELECT.format[0].value).toBe("40 h");
    });

    it("displays 4 h / jour format", () => {
      expect(NEXUS_SELECT.format[1].value).toBe("4 h / jour");
    });

    it("displays group of 4 students max", () => {
      const allText = JSON.stringify(NEXUS_SELECT);
      expect(allText).toContain("4 élèves max");
    });

    it("mentions CPGE in audience", () => {
      expect(NEXUS_SELECT.audience.join(" ")).toContain("CPGE");
    });

    it("mentions EPFL in audience", () => {
      expect(NEXUS_SELECT.audience.join(" ")).toContain("EPFL");
    });

    it("mentions doubles licences maths-info in audience", () => {
      expect(NEXUS_SELECT.audience.join(" ")).toContain("double licence maths-info");
    });

    it("WhatsApp Select URL contains stage 40 h message", () => {
      expect(WHATSAPP_URL_SELECT).toContain("Select");
    });

    it("does NOT mention groupes de niveau", () => {
      const allText = JSON.stringify(NEXUS_SELECT);
      expect(allText).not.toContain("Groupe 1");
      expect(allText).not.toContain("Groupe 2");
      expect(allText).not.toContain("groupes de niveau");
      expect(allText).not.toContain("4 groupes de mathématiques");
    });
  });

  describe("urgency wording", () => {
    it('uses "échéances" not "épreuves anticipées"', () => {
      const allText = [URGENCY.eyebrow, URGENCY.title, URGENCY.description].join(" ");
      expect(allText).toContain("échéances");
      expect(allText).not.toContain("épreuves anticipées");
    });
  });

  describe("WhatsApp URLs", () => {
    const urls = [WHATSAPP_URL, WHATSAPP_URL_FINISH, WHATSAPP_URL_SELECT, WHATSAPP_URL_FORFAITS];

    it("all 4 URLs are valid and point to wa.me", () => {
      for (const url of urls) {
        const parsed = new URL(url);
        expect(parsed.hostname).toBe("wa.me");
        expect(parsed.pathname).toBe("/21699192829");
      }
    });

    it("no raw spaces in URLs", () => {
      for (const url of urls) {
        expect(url).not.toContain(" ");
      }
    });
  });

  describe("images", () => {
    it("all LANDING_IMAGES have French alt texts", () => {
      const entries = Object.values(LANDING_IMAGES);
      for (const img of entries) {
        expect(img.alt).toBeTruthy();
        // French characters: at least one accented char or common French word
        expect(img.alt).toMatch(/[éèêëàâäùûüîïôöçœæ]|de |du |et |les |des |un |une /i);
      }
    });

    it("all images use WebP format", () => {
      const entries = Object.values(LANDING_IMAGES);
      for (const img of entries) {
        expect(img.src).toMatch(/\.webp$/);
      }
    });
  });

  describe("accompagnements", () => {
    it("has exactly 5 offerings", () => {
      expect(ACCOMPAGNEMENTS).toHaveLength(5);
    });
  });

  describe("FAQ", () => {
    it("has at least 5 items", () => {
      expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(5);
    });

    it("includes pricing clarification question", () => {
      const pricingFaq = FAQ_ITEMS.find((q) => q.question.includes("tarifs") || q.question.includes("individuels"));
      expect(pricingFaq).toBeDefined();
    });
  });
});
