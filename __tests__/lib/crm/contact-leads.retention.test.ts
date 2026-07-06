import {
  CONTACT_LEAD_ERASURE_SLA_DAYS,
  CONTACT_LEAD_RETENTION_DAYS,
  buildContactLeadRetentionDecision,
} from '@/lib/crm/contact-leads';

describe('ContactLead retention policy', () => {
  it('documents a bounded retention and erasure SLA for public lead_only data', () => {
    expect(CONTACT_LEAD_RETENTION_DAYS).toBeGreaterThanOrEqual(30);
    expect(CONTACT_LEAD_RETENTION_DAYS).toBeLessThanOrEqual(395);
    expect(CONTACT_LEAD_ERASURE_SLA_DAYS).toBeLessThanOrEqual(30);

    expect(buildContactLeadRetentionDecision()).toEqual({
      dataCategory: 'public_lead_minor_related',
      legalBasis: 'parent_consent_and_precontractual_request',
      retentionDays: CONTACT_LEAD_RETENTION_DAYS,
      erasureSlaDays: CONTACT_LEAD_ERASURE_SLA_DAYS,
      deletionProcedure: expect.stringContaining('ContactLead'),
      productionAction: 'schedule_retention_job_before_go_live_large',
    });
  });
});
