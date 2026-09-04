import { getCourseAriaSummary } from '@/lib/aria-preview/capability-status';

describe('ARIA preview — capability status', () => {
  it('marks a course with a compiled skill graph as READY, with a real competency count', () => {
    const summary = getCourseAriaSummary('eds-nsi-terminale');
    expect(summary.skillGraphStatus).toBe('READY');
    expect(summary.skillGraphCompetencyCount).toBeGreaterThan(0);
  });

  it('marks a course with no skill graph as NOT_CONFIGURED', () => {
    const summary = getCourseAriaSummary('eds-svt-terminale');
    expect(summary.skillGraphStatus).toBe('NOT_CONFIGURED');
    expect(summary.skillGraphCompetencyCount).toBeNull();
  });

  it('marks a course with a chat capability declaration as IN_QUALIFICATION, never READY', () => {
    const summary = getCourseAriaSummary('eds-nsi-terminale');
    expect(summary.chatStatus).toBe('IN_QUALIFICATION');
    expect(summary.ragStatus).toBe('IN_QUALIFICATION');
    expect(summary.ragCorpusId).toBe('aria-nsi-terminale');
    expect(summary.chatPolicy).toBe('GROUNDED_REQUIRED');
  });

  it('marks a course with chat=null in the manifest as NOT_CONFIGURED for RAG/chat', () => {
    const summary = getCourseAriaSummary('stmg-maths-premiere');
    expect(summary.chatStatus).toBe('NOT_CONFIGURED');
    expect(summary.ragStatus).toBe('NOT_CONFIGURED');
    expect(summary.ragCorpusId).toBeNull();
  });

  it('marks a course entirely absent from the capability manifest as NOT_CONFIGURED across the board', () => {
    const summary = getCourseAriaSummary('tc-eps-terminale');
    expect(summary.resourcesStatus).toBe('NOT_CONFIGURED');
    expect(summary.ragStatus).toBe('NOT_CONFIGURED');
    expect(summary.chatStatus).toBe('NOT_CONFIGURED');
  });

  it('derives Resources from the active resource registry, not from capability-declaration presence', () => {
    // A capability declaration exists for stmg-maths-premiere, but the
    // resource registry has no active entry for it — it must never read READY.
    expect(getCourseAriaSummary('stmg-maths-premiere').resourcesStatus).toBe('NOT_CONFIGURED');

    // These three courseKeys DO have an active entry in data/aria/resources.v1.json.
    expect(getCourseAriaSummary('eds-maths-terminale').resourcesStatus).toBe('READY');
    expect(getCourseAriaSummary('eds-nsi-premiere').resourcesStatus).toBe('READY');
    expect(getCourseAriaSummary('eds-nsi-terminale').resourcesStatus).toBe('READY');
  });
});
