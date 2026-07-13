import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import { getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';

type TeacherRole = {
  subjects: string[];
  maxHoursPerDay: number;
};

describe('Pré-rentrée 2026 staffing and room contract', () => {
  const teacherRoles = campaignManifest.teacherRoles as Record<string, TeacherRole>;
  const sessions = getPreRentreeSchedule();

  it('declares exactly the three non-personal teacher roles', () => {
    expect(Object.keys(teacherRoles)).toEqual([
      'MATHS_NSI_SNT_TEACHER',
      'FRENCH_TEACHER',
      'PHYSICS_CHEMISTRY_TEACHER',
    ]);
    expect(teacherRoles.MATHS_NSI_SNT_TEACHER?.subjects).toEqual(['MATHEMATIQUES', 'NSI']);
    expect(teacherRoles.FRENCH_TEACHER?.subjects).toEqual(['FRANCAIS']);
    expect(teacherRoles.PHYSICS_CHEMISTRY_TEACHER?.subjects).toEqual(['PHYSIQUE_CHIMIE']);
  });

  it('assigns every module and session to exactly one role with 30/15/15 sessions', () => {
    const moduleSlots = campaignManifest.schedule.flatMap((week) => week.slots);
    expect(moduleSlots).toHaveLength(12);

    const counts = Object.fromEntries(Object.keys(teacherRoles).map((role) => [role, 0]));
    const moduleCounts = Object.fromEntries(Object.keys(teacherRoles).map((role) => [role, 0]));
    for (const slot of moduleSlots) {
      const matchingRoles = Object.entries(teacherRoles).filter(([, role]) =>
        role.subjects.includes(slot.subject),
      );
      expect(matchingRoles).toHaveLength(1);
      const roleName = matchingRoles[0]?.[0];
      if (!roleName) throw new Error(`No role for ${slot.subject}`);
      moduleCounts[roleName] += 1;
      counts[roleName] += 5;
    }

    expect(moduleCounts).toEqual({
      MATHS_NSI_SNT_TEACHER: 6,
      FRENCH_TEACHER: 3,
      PHYSICS_CHEMISTRY_TEACHER: 3,
    });
    expect(counts).toEqual({
      MATHS_NSI_SNT_TEACHER: 30,
      FRENCH_TEACHER: 15,
      PHYSICS_CHEMISTRY_TEACHER: 15,
    });
    expect(sessions).toHaveLength(60);
  });

  it('locks role loads to 60/30/30 hours without collisions', () => {
    const hoursByRole: Record<string, number> = {};
    for (const [roleName, role] of Object.entries(teacherRoles)) {
      const roleSessions = sessions.filter((session) => role.subjects.includes(session.subject));
      hoursByRole[roleName] = roleSessions.length * 2;

      const occupied = roleSessions.map((session) => `${session.date}-${session.block}`);
      expect(new Set(occupied).size).toBe(occupied.length);
      const sessionsByDay = roleSessions.reduce<Record<string, typeof roleSessions>>((byDay, session) => {
        byDay[session.date] = [...(byDay[session.date] ?? []), session];
        return byDay;
      }, {});
      for (const dailySessions of Object.values(sessionsByDay)) {
        expect((dailySessions?.length ?? 0) * 2).toBeLessThanOrEqual(role.maxHoursPerDay);
      }
    }

    expect(hoursByRole).toEqual({
      MATHS_NSI_SNT_TEACHER: 60,
      FRENCH_TEACHER: 30,
      PHYSICS_CHEMISTRY_TEACHER: 30,
    });
  });

  it('uses exactly two logical rooms with no collision', () => {
    expect(campaignManifest.roomRoles).toEqual({
      'salle-1': ['MATHEMATIQUES', 'NSI'],
      'salle-2': ['FRANCAIS', 'PHYSIQUE_CHIMIE'],
    });
    expect(new Set(sessions.map((session) => session.room))).toEqual(new Set(['salle-1', 'salle-2']));
    const occupied = sessions.map((session) => `${session.date}-${session.block}-${session.room}`);
    expect(new Set(occupied).size).toBe(occupied.length);
  });
});
