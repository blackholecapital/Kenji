# Kenji Pass 14 — Surface normalization

Pass 14 makes the remaining owner-facing screens use the same compact premium presentation language established by the Lead Pipeline and Callbacks work.

## Scope

Presentation and usability only. No provider, queue, secret, D1 schema, Durable Object, or execution-worker behavior changes.

### Normalized surfaces

- Campaigns
- Integrations / HighLevel bridge
- Agency Ops
- EILA Overwatch
- Live Demo
- Nurture
- Scale Lab + full-stack rehearsal
- Launch
- Owner Setup

## Design system changes

- consistent panel radius, border and shadow
- consistent 40px input/select controls
- compact 36px primary/secondary buttons
- smaller eyebrow, helper and field-label typography
- shared inner-card background and border treatment
- tighter KPI tiles
- smaller grid gaps and vertical rhythm
- reduced oversized textareas and empty whitespace
- responsive one-column fallback at smaller widths

## Usability additions

Pass 14 adds visible field labels to older naked-input surfaces, especially Campaigns, Nurture and the HighLevel bridge, so numeric values are understandable without knowing the backend schema.

## Deployment

```bash
npm run check
npm run deploy:pass14
```

Deployment is Kenji-owned and uses `Kenji/scripts/deploy-with-secrets-store.mjs`. No other Git repository participates.
