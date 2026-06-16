# Contact Lead CRM Design

## Goal

Convert the public marketing contact forms into a real prospect capture flow: store every valid lead in the database and notify the Nexus team by email.

## Architecture

The public forms continue to POST to `/api/contact`. The route validates and normalizes the payload, persists it as a `ContactLead`, then sends one internal notification through the existing centralized mailer.

Lead capture must be durable first: if the email notification fails after the database insert, the API still returns success and logs the notification failure.

## Data Model

Add `ContactLead` with parent contact information, marketing context, a simple CRM status, optional notes, and timestamps.

Statuses:
- `NEW`
- `CONTACTED`
- `QUALIFIED`
- `ENROLLED`
- `LOST`

## Email

Use `lib/email/mailer.ts` and `lib/email/templates.ts`. The recipient is resolved from `CRM_LEAD_NOTIFICATION_EMAIL`, then `INTERNAL_NOTIFICATION_EMAIL`, then reply-to env vars, then `contact@nexusreussite.academy`.

## Error Handling

Invalid payloads return `400`.

Database failures return `500` because the lead was not captured.

Email failures do not fail the request once the lead has been created.

## Testing

Route tests cover validation, database persistence, notification dispatch, and tolerance when notification fails.
