---
name: nexus-dashboards
description: Use when modifying Nexus dashboards for student, coach, parent, assistant, generated report panels, EAF reports, resources, or role-specific UI behavior.
---

# Nexus Dashboards Skill

## Role separation

Student dashboard:

* learning actions;
* resources;
* bilans;
* ARIA;
* progress.

Coach dashboard:

* cohort;
* student dossier;
* private notes;
* reports;
* pedagogical alerts;
* generated report status.

Parent dashboard:

* readable synthesis;
* progress;
* next actions;
* billing;
* no private coach notes.

## Before editing UI

Inspect:

* page route;
* component;
* API endpoint;
* returned payload type;
* RBAC assumptions;
* loading state;
* error state;
* empty state.

## UI quality

* Preserve Nexus premium style.
* Keep cards readable.
* Use existing UI primitives.
* Avoid adding too many buttons.
* Every status must be understandable:

  * waiting for student;
  * waiting for coach;
  * pending;
  * generating;
  * ready;
  * failed;
  * needs review.

## Generated reports panel

The panel should make the pipeline clear:

* questionnaire missing;
* coach report incomplete;
* coach report validated;
* job created;
* generation in progress;
* PDF ready;
* failure with safe error message.

Do not expose raw internal JSON in the UI.
