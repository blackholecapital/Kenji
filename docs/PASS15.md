# Kenji Pass 15 — final polish before hardening

## Scope

Pass 15 is a presentation/workflow polish layer only.

### Overview
- constrain the four operating panels to a compact two-column rack instead of stretching across the canvas
- move Lead Sources beside Hot Leads
- place Due Callbacks + Recent Calls beneath them
- add lead-temperature treatment:
  - score > 80: fire marker
  - score >= 90: double fire + red premium emphasis

### Callback Queue
- preload/cache stage mapping to prevent stage tint/tag flicker
- keep stage + queue status locked together at the top-right of each callback ticket
- replace text-heavy callback actions with the same phone / text / email / calendar action deck used by Lead Pipeline
- preserve Done as a distinct completion control

### Calls
- replace the wide table with compact call-activity tickets
- show lead identity, score, status, direction, disposition, duration, timestamp and summary in each ticket
- add phone / text / email / callback actions
- selecting a call opens a right-side detail tile containing:
  - contact details
  - stage/source
  - call summary and disposition
  - Conversation tab using the call record's stored transcript
  - Call Details tab with IDs/timestamps/provider metadata
- synthetic demo calls use explicitly labeled demo transcripts when no real transcript exists

## Data boundary

No schema change is required. `calls.transcript` is already persisted and returned by `/api/calls`. Contact details are joined in the browser from the existing `/api/leads` response.

## Architecture boundary

No new provider, queue, secret, Durable Object, D1 migration, execution worker, or cross-repository dependency.

## Deploy

```bash
npm run check
npm run deploy:pass15
```

## Acceptance

1. Overview operating panels are compact and ordered Hot Leads / Lead Sources, then Due Callbacks / Recent Calls.
2. Scores above 80 show fire; scores 90+ show double fire and red emphasis.
3. Callback stage color/tag no longer flashes off during rerenders.
4. Callback tickets show stage + status near the top and the premium action icon deck at the bottom.
5. Calls render as compact tickets with a selectable right-side detail panel.
6. Conversation shows stored live transcript when present.
7. Demo-only transcript content is visibly labeled as demo.
8. No runtime/integration behavior changes.
