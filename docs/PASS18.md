# Pass 18 — client workspace polish

Pass 18 is a presentation/workflow refinement on top of the Pass 16 hardening and Pass 17 branding work.

## What changed

- shared heat rule across Lead Pipeline, Calls and Callbacks:
  - score 80–89: one flame
  - score 90+: two flames
- Calls uses stage-tinted premium cards and a denser desktop ticket grid
- selected-call workspace is narrowed and extended with:
  - Conversation
  - History
  - Call Details
  - SMS
  - Email
  - Calendar
  - Notes
- Callback cards gain lead score + flame treatment while preserving stage tint and compact action icons
- top bar is reduced to search, one Demo/Owner state, Login/Owner control and Refresh
- top-right EILA Live remains available from the EILA/Live surfaces rather than consuming permanent header space
- sidebar branding uses the repo-owned `assets/kenji-logo.webp` wordmark with `AI CALL CENTER` beneath it
- EILA support portraits use the repo-owned `assets/EILA-small-chat.jpg` with a less aggressive crop

## Safety boundary

This pass does not bypass the existing consent, auth or action-confirmation layers. SMS/email tabs route into Nurture rather than sending directly, and calendar actions continue through the existing callback action path.

No D1 migration, provider routing, queue topology, secret, Durable Object or shared-repository change is included.

## Deploy

After merge:

```bash
npm run check
npm run deploy:pass18
```
