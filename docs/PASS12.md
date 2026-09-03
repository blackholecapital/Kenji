# Kenji Pass 12 — Stage mapping + demo cleanup + brand polish

Pass 12 is a presentation and demo-usability pass layered on top of Pass 11. It does not add a provider, queue, Durable Object, runtime, or secret.

## Lead Pipeline

Every stage now owns a distinct visual tone:

- New — blue
- Attempted — slate
- Contacted — cyan
- Qualified — green
- Nurture — amber
- Booked — violet
- Won — emerald
- Lost — red

The stage chips, card band, avatar treatment, score ring, and stage selector use the same mapping.

## Demo data deletion

Synthetic `demo_*` records now show a trash control in the Lead Pipeline.

Deletion is deliberately browser-scoped. It writes the hidden demo IDs to a short cookie and filters only the synthetic public demo APIs. It never deletes or mutates a real D1 lead. `Reset demo data` restores all placeholders for that browser.

## EILA support

The 24-hour support drawer now uses a fixed half-screen-height shell with a scrolling FAQ body so opening accordion answers no longer resizes the entire support card. The canonical EILA avatar is presented as a head-and-shoulders crop for the support surfaces.

## Kenji branding

The top action area includes a KenjiAI site lockup using the live `kenjiai.com` favicon plus the current site positioning: `AI That Closes Deals While You Sleep`.

## Deploy

```bash
cd ~/Kenji
git fetch origin
git checkout build/pass12-stage-brand-polish
git pull origin build/pass12-stage-brand-polish
npm run check
npm run deploy:pass12
```

Deployment is Kenji-only through `Kenji/scripts/deploy-with-secrets-store.mjs`.
