# Kenji Pass 11 — Premium branded UI + EILA help center

## Purpose
Pass 11 is a frontend usability and brand-polish pass. It does **not** add a new runtime, provider, queue, secret, or data model.

The visual direction follows the current KenjiAI positioning at `kenjiai.com`: revenue-generating automation, 24/7 operation, lead follow-up, AI voice, CRM, SMS/email, and business automation.

## What changes

- white / light premium theme
- Kenji blue + aqua accent system
- cleaner left navigation and top bar
- Kenji AI brand lockup and revenue-automation positioning
- global lead/company search in the top bar
- stage shortcuts above Lead Pipeline
- rebuilt lead-card visual hierarchy
- round priority score badge
- cleaner stage/source/last-contact rows
- premium bottom action deck on every lead card:
  - phone
  - SMS
  - email
  - callback/calendar
- 24-hour EILA support pill in the bottom-right
- detailed operating FAQ for every major surface
- support tabs for Dashboard, Automation, Integrations, and EILA Live

## Support-center scope
The help center explains:

- Overview
- Lead Pipeline
- Calls
- Callbacks
- Campaigns
- Integrations / CSV / API intake
- HighLevel / Kenji CRM mapping
- Agency Ops
- Nurture / consent
- Scale Lab / circuit breakers
- Launch acceptance
- Owner Setup
- EILA Overwatch
- EILA Live
- demo/read-only mode
- five-minute buyer walkthrough
- owner go-live sequence

## Security / demo boundary
The public demo remains read-only. Pass 11 does not relax authentication. Live actions continue to require the owner login through the existing demo-access gate.

## Deployment boundary
This pass is deployed entirely from the Kenji repository.

```bash
npm run check
npm run deploy:pass11
```

Do **not** call or depend on another repository during deployment. Kenji uses its local `scripts/deploy-with-secrets-store.mjs` helper.

## Files

- `apps/overwatch-worker/src/pass11.js`
- `apps/overwatch-worker/public/pass11-premium.css`
- `apps/overwatch-worker/public/pass11-premium.js`
- `apps/overwatch-worker/public/pass11-support.js`
- `scripts/deploy-pass11.mjs`
