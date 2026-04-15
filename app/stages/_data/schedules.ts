import { ALL_OFFERS, type Offer } from "./offers";

export interface ScheduleRow {
  date: string;
  time: string;
  subject: string;
  type: string;
  level: string;
  offer: string;
  offerId: string;
}

export function buildScheduleTableData(): ScheduleRow[] {
  const data: ScheduleRow[] = [];
  ALL_OFFERS.forEach((offer) => {
    offer.planning?.forEach((plan) => {
      const dateMatch = plan.match(/^([^·—]+)[·—]/);
      const date = dateMatch ? dateMatch[1].trim() : "";
      const timeMatch = plan.match(/(\d{2}h\d{2}[^·—]*)/);
      const time = timeMatch ? timeMatch[1].trim() : "";
      data.push({
        date,
        time,
        subject: offer.subjectKey || offer.category,
        type: offer.category,
        level: offer.level,
        offer: offer.title,
        offerId: offer.id,
      });
    });
  });
  return data.sort((a, b) => a.date.localeCompare(b.date));
}
