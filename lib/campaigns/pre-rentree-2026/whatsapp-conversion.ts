import { z } from 'zod';

import sourceJson from '@/content/pre-rentree-2026/whatsapp-conversion.fr.json';
import { compileCommercialPublicationContract } from './commercial-contract';

const ScriptSchema = z.object({
  id: z.string().min(1),
  purpose: z.string().min(1),
  funnelStage: z.string().min(1),
  template: z.string().min(40),
  requiredGate: z.string().min(1).nullable(),
  crmEvent: z.string().min(1),
  proofIds: z.array(z.string().min(1)),
}).strict();

const SourceSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  campaignId: z.literal('pre-rentree-2026'),
  locale: z.literal('fr-TN'),
  channel: z.literal('WHATSAPP'),
  scripts: z.array(ScriptSchema).length(16),
  objectionMatrix: z.array(z.object({
    objection: z.string().min(1),
    responseScriptId: z.string().min(1),
    proofIds: z.array(z.string().min(1)).min(1),
    offerScope: z.array(z.string().min(1)).min(1),
    cta: z.string().min(1),
    crmEvent: z.string().min(1),
  }).strict()).length(5),
  crm: z.object({
    leadStatuses: z.array(z.string().min(1)).min(10),
    events: z.array(z.object({ id: z.string().min(1), requiresConsent: z.boolean() }).strict()).min(10),
  }).strict(),
  privacy: z.object({
    requiredLeadFields: z.array(z.string().min(1)).length(5),
    optionalLeadFields: z.array(z.string().min(1)),
    forbiddenFields: z.array(z.string().min(1)).min(4),
    retentionRule: z.string().min(1),
    stopRule: z.string().min(1),
  }).strict(),
}).strict();

const source = SourceSchema.parse(sourceJson);

export type WhatsAppConversionContext = {
  offerId: string;
  entryLevel: string;
  subjects: string;
  schoolStatus: string;
  satisfiedGates?: string[];
};

const FRENCH_SMALL_NUMBERS: Record<number, string> = {
  1: 'une', 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq',
  6: 'six', 7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix',
  15: 'quinze', 20: 'vingt',
};

export function buildWhatsAppConversionMessage(
  scriptId: string,
  context: WhatsAppConversionContext,
): string {
  const script = source.scripts.find((item) => item.id === scriptId);
  if (!script) throw new Error(`Unknown WhatsApp conversion script: ${scriptId}`);
  if (script.requiredGate && !context.satisfiedGates?.includes(script.requiredGate)) {
    throw new Error(`${script.requiredGate} is required before using ${scriptId}.`);
  }

  const contract = compileCommercialPublicationContract();
  const offer = contract.offers.find((item) => item.offerId === context.offerId);
  if (!offer?.publiclyEligible) throw new Error(`Unknown or non-public commercial offer: ${context.offerId}`);

  const values: Record<string, string> = {
    entryLevel: context.entryLevel,
    subjects: context.subjects,
    schoolStatus: context.schoolStatus,
    hours: String(offer.hours),
    sessions: FRENCH_SMALL_NUMBERS[offer.sessions] ?? String(offer.sessions),
    groupMax: String(offer.groupMax),
    price: String(offer.price),
    deposit: String(offer.deposit),
  };
  return script.template.replace(/\{([A-Za-z]+)\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Missing WhatsApp template value: ${key}`);
    return value;
  });
}

export function getWhatsAppObjectionMatrix() {
  return source.objectionMatrix;
}
