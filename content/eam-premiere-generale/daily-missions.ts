import { eamPremiereSprintMissions } from "./sprint-plan";

export const eamPremiereDailyMissions = eamPremiereSprintMissions.map((mission) => ({
  id: `${mission.id}-daily`,
  sessionId: mission.id,
  title: mission.title,
  inSession: mission.exercises.map((exercise) => exercise.title),
  deliverable: mission.deliverable,
  afterSession: mission.homework.tasks,
}));
