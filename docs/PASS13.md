# Kenji Pass 13 — Dense ticket tiles

Pass 13 is a presentation-density pass on top of the merged Pass 12 UI.

## Goals
- Show more useful records on screen.
- Reduce dead space in lead and callback cards.
- Keep the existing premium Kenji light theme and stage-color system.
- Preserve all existing action wiring and demo safety boundaries.

## Lead Pipeline
- Wide desktop targets four cards across.
- Metadata becomes a compact 2×2 ticket grid.
- Notes clamp to two lines.
- Avatar, score ring, actions, and stage selector are reduced in size.
- Existing Pass 12 stage colors remain authoritative.

## Callback Queue
- Cards use compact fixed-width ticket geometry instead of stretching across the panel.
- Each callback receives the linked lead's stage color and a stage badge.
- Due time, note, status, and actions are compressed for faster scanning.

## Architecture boundary
No new provider, queue, secret, D1 migration, Durable Object, or execution worker is introduced.

Deployment remains Kenji-only:

```bash
npm run deploy:pass13
```
