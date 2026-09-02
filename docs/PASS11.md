# Kenji Pass 11 — Premium UI + EILA Support

## Purpose

Pass 11 is a presentation and usability pass. It does not add another provider, communication runtime, queue, or cross-repository dependency.

The goal is to make the existing Kenji system feel like a customer-ready KenjiAI product instead of an engineering dashboard.

## Changes

- Light premium visual system aligned to KenjiAI's public positioning.
- Kenji AI brand header with the public tagline: **AI That Closes Deals While You Sleep**.
- Navigation grouped into Core, Growth, AI & Operations, and System sections.
- Cleaner white cards, softer borders/shadows, blue/teal accents, and green success states.
- Lead Pipeline stage tabs for faster filtering.
- Premium lead cards with circular lead score, simplified metadata rows, and bottom action icons.
- Lead action bar includes phone, text, email, callback/calendar, and stage controls.
- Text/email action icons route the owner to Nurture rather than pretending an unconfirmed send occurred.
- Compact overview lead actions use icon buttons.
- Persistent bottom-right **24-hour support** pill.
- Detailed EILA support drawer with searchable FAQ coverage for:
  - Getting started
  - Dashboard
  - Lead Pipeline
  - Calls and Callbacks
  - Campaigns
  - Integrations / HighLevel
  - Agency Ops
  - EILA Overwatch / EILA Live
  - Nurture
  - Scale Lab
  - Launch
  - Owner Setup
  - Troubleshooting
- Demo View remains read-only. Live actions still require owner login.
- All visible Isla naming is normalized to **EILA**.

## Safety / behavior

Pass 11 does not bypass authentication. The Demo View can be browsed, but live communication and mutation controls remain protected by the existing demo-access layer.

The new SMS/email icons do not claim to send messages. They route the owner into the existing Nurture workflow, which keeps consent and provider-confirmation boundaries intact.

## Deployment boundary

Kenji remains sovereign. Pass 11 uses only `Kenji/scripts/deploy-with-secrets-store.mjs` and existing Cloudflare account resources. No other repository participates in deployment.

## Deploy

```bash
cd ~/Kenji

git fetch origin \
  refs/heads/build/pass11-premium-ui-faq:refs/remotes/origin/build/pass11-premium-ui-faq

git checkout -B build/pass11-premium-ui-faq \
  origin/build/pass11-premium-ui-faq

npm run check
npm run deploy:pass11
```

After deploy, hard refresh the Command Center.
