const CAMPAIGN_TIME_ZONE = 'Africa/Tunis';

const dayMonthFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: CAMPAIGN_TIME_ZONE,
});

const weekdayDayMonthFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: CAMPAIGN_TIME_ZONE,
});

function campaignDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value}T12:00:00+01:00`);
}

function dateParts(value: string) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: CAMPAIGN_TIME_ZONE,
  }).formatToParts(campaignDate(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function formatCampaignStatus(status: string): string {
  const labels: Readonly<Record<string, string>> = {
    PRE_REGISTRATION_OPEN: 'Pré-inscriptions ouvertes',
    REGISTRATION_OPEN: 'Inscriptions ouvertes',
    FULL: 'Groupes complets',
    CLOSED: 'Inscriptions closes',
    ARCHIVED: 'Campagne terminée',
    DRAFT: 'Campagne en préparation',
  };
  return labels[status] ?? 'Statut indisponible';
}

export function formatFrenchTime(value: string): string {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return value;
  return `${match[1]} h ${match[2]}`;
}

export function formatFrenchDecisionDate(value: string): string {
  const date = campaignDate(value);
  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: CAMPAIGN_TIME_ZONE,
  }).format(date);
  const timeParts = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: CAMPAIGN_TIME_ZONE,
  }).formatToParts(date);
  const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '';
  return `${dateLabel} à ${hour} h ${minute}`;
}

export function formatCampaignVenue(venue: {
  name: string;
  neighborhood: string;
  city: string;
}): string {
  const locationName = venue.name.includes(venue.neighborhood)
    ? venue.name
    : `${venue.name} — ${venue.neighborhood}`;
  return `${locationName}, ${venue.city}`;
}

export function formatWeekRange(start: string, end: string): string {
  const startParts = dateParts(start);
  const endParts = dateParts(end);
  if (startParts.month === endParts.month) {
    return `${startParts.day}–${endParts.day} ${endParts.month}`;
  }
  return `${dayMonthFormatter.format(campaignDate(start))}–${dayMonthFormatter.format(campaignDate(end))}`;
}

export function formatPresenceRange(dates: readonly string[]): string {
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return '';
  const firstParts = dateParts(first);
  const lastParts = dateParts(last);
  const firstWeekday = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    timeZone: CAMPAIGN_TIME_ZONE,
  }).format(campaignDate(first));
  const lastWeekday = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    timeZone: CAMPAIGN_TIME_ZONE,
  }).format(campaignDate(last));
  if (firstParts.month === lastParts.month) {
    return `Du ${firstWeekday} ${firstParts.day} au ${lastWeekday} ${lastParts.day} ${lastParts.month}`;
  }
  return `Du ${weekdayDayMonthFormatter.format(campaignDate(first))} au ${weekdayDayMonthFormatter.format(campaignDate(last))}`;
}

export function formatDetailedDates(dates: readonly string[]): string {
  return [...dates]
    .sort()
    .map((date) => weekdayDayMonthFormatter.format(campaignDate(date)))
    .join(', ');
}
