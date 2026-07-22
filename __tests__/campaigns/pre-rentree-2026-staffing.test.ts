import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
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
    expect(Object.keys(teacherRoles)).toHaveLength(11);
    expect(Object.keys(teacherRoles).every((role) => /^[A-Z_]+(?:_A|_B)?$/.test(role))).toBe(true);
    expect(Object.values(teacherRoles).every((role) => role.assigned === false)).toBe(true);
    expect(campaignManifest.operationalGates.teacherAssignmentsValidated).toBe(false);
  });

  it('maps every module and session to one provisional role', () => {
    const moduleSlots = campaignManifest.schedule.flatMap((week) => week.slots);
    expect(moduleSlots).toHaveLength(16);

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

    expect(Object.values(moduleCounts).reduce((sum, count) => sum + count, 0)).toBe(16);
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(80);
    expect(sessions).toHaveLength(80);
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
    expect(Object.values(hoursByRole).reduce((sum, hours) => sum + hours, 0)).toBe(160);
  });

  it('uses exactly two logical rooms with no collision', () => {
    expect(campaignManifest.roomRoles).toEqual({
      'salle-1': ['MATHEMATIQUES', 'NSI', 'SVT'],
      'salle-2': ['FRANCAIS', 'PHILOSOPHIE', 'PHYSIQUE_CHIMIE', 'SVT'],
    });
    expect(new Set(sessions.map((session) => session.room))).toEqual(new Set(['salle-1', 'salle-2']));
    const occupied = sessions.map((session) => `${session.date}-${session.block}-${session.room}`);
    expect(new Set(occupied).size).toBe(occupied.length);
  });
});
