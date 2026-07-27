import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import modulesSource from '@/content/pre-rentree-2026/modules.json';
import { getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';

type TeacherRole = {
  subjects: string[];
  maxHoursPerDay: number;
  assigned: boolean;
};

describe('Pré-rentrée 2026 staffing and room contract', () => {
  const teacherRoles = campaignManifest.teacherRoles as Record<string, TeacherRole>;
  const sessions = getPreRentreeSchedule();

  it('declares only non-personal, unassigned teacher roles for REVIEW', () => {
    // Modèle fenêtres + week-end (v2) : 4 rôles abstraits A/C/D/E (un seul enseignant
    // Maths/NSI, un Français, un Physique-Chimie, un SVT), plus de granularité par niveau.
    expect(Object.keys(teacherRoles)).toHaveLength(4);
    expect(Object.keys(teacherRoles).every((role) => /^[A-Z_]+(?:_A|_B)?$/.test(role))).toBe(true);
    expect(Object.values(teacherRoles).every((role) => role.assigned === false)).toBe(true);
    expect(campaignManifest.operationalGates.teacherAssignmentsValidated).toBe(false);
  });

  it('maps every module and session to one provisional role', () => {
    const moduleSlots = campaignManifest.schedule.flatMap((week) => week.slots);
    // 14 modules -> 14 distinct (level, subject) pairs, but 3 of them (Première
    // SVT, Terminale NSI, Terminale SVT) carry 2 cohort slots each instead of 1
    // (SCHEDULE-S5 alternative cohorts) -> 14 + 3 extra = 17 total slots, never
    // counted as extra modules.
    const slotsByModulePair = new Map<string, number>();
    for (const slot of moduleSlots) {
      const key = `${slot.level}/${slot.subject}`;
      slotsByModulePair.set(key, (slotsByModulePair.get(key) ?? 0) + 1);
    }
    expect(slotsByModulePair.size).toBe(modulesSource.modules.length);
    const pairsWithTwoCohorts = [...slotsByModulePair.values()].filter((count) => count === 2);
    expect(pairsWithTwoCohorts).toHaveLength(3);
    expect(moduleSlots).toHaveLength(modulesSource.modules.length + pairsWithTwoCohorts.length);

    const counts = Object.fromEntries(Object.keys(teacherRoles).map((role) => [role, 0]));
    const moduleCounts = Object.fromEntries(Object.keys(teacherRoles).map((role) => [role, 0]));
    for (const slot of moduleSlots) {
      const roleName = slot.teacherRole;
      const role = teacherRoles[roleName];
      expect(role?.subjects).toContain(slot.subject);
      if (!role) throw new Error(`No role for ${slot.subject}`);
      moduleCounts[roleName] += 1;
      counts[roleName] += 5;
    }

    expect(Object.values(moduleCounts).reduce((sum, count) => sum + count, 0)).toBe(moduleSlots.length);
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(moduleSlots.length * 5);
    expect(sessions).toHaveLength(moduleSlots.length * 5);
  });

  it('keeps every provisional role below six teaching hours per day', () => {
    const hoursByRole: Record<string, number> = {};
    for (const [roleName, role] of Object.entries(teacherRoles)) {
      const roleSlots = campaignManifest.schedule.flatMap((week) => week.slots)
        .filter((slot) => slot.teacherRole === roleName);
      hoursByRole[roleName] = roleSlots.length * 5 * 2;
      for (const week of campaignManifest.schedule) {
        const dailySlots = week.slots.filter((slot) => slot.teacherRole === roleName);
        expect(dailySlots.length * 2).toBeLessThanOrEqual(role.maxHoursPerDay);
        expect(new Set(dailySlots.map((slot) => slot.block)).size).toBe(dailySlots.length);
      }
    }
    expect(Object.values(hoursByRole).reduce((sum, hours) => sum + hours, 0)).toBe(sessions.length * 2);
  });

  it('uses two logical rooms plus the exceptional salle-3 (bloc C only), with no collision', () => {
    // salle-3 (SCHEDULE-S5 owner decision) is scoped to SVT only, bloc C only —
    // not a third permanent room, see SCHEDULE-S5-DECISION.md.
    expect(campaignManifest.roomRoles).toEqual({
      'salle-1': ['MATHEMATIQUES', 'NSI', 'MATHS_EXPERTES'],
      'salle-2': ['FRANCAIS', 'PHYSIQUE_CHIMIE', 'SVT'],
      'salle-3': ['SVT'],
    });
    expect(new Set(sessions.map((session) => session.room))).toEqual(new Set(['salle-1', 'salle-2', 'salle-3']));
    expect(sessions.every((session) => session.room !== 'salle-3' || session.block === 'C')).toBe(true);
    const occupied = sessions.map((session) => `${session.date}-${session.block}-${session.room}`);
    expect(new Set(occupied).size).toBe(occupied.length);
  });
});
