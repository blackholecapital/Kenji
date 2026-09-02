# Kenji Pass 10 — Owner Setup + Demo Polish

Pass 10 stops adding runtime machinery and turns the deployed control plane into a customer-facing handoff experience.

## New surface: Owner Setup

Owner Setup is the guided path to make the existing **Launch** gate green. Launch remains the source of truth for acceptance.

The page aggregates and reuses existing APIs rather than creating a second configuration plane:

- Pass 9 Launch checklist / acceptance
- Pass 4 Twilio voice-number inventory and routing
- Pass 6 SMS-number inventory, SMS sender and email sender settings
- HighLevel location / calendar mapping
- Pass 8 full-stack rehearsal
- existing Isla Live client

## Owner-facing configuration

A small D1 profile stores only non-secret handoff metadata:

- brand label
- assistant display name
- primary business goal
- timezone
- demo-mode flag
- current setup step

No provider credentials are accepted or stored in the browser.

## Guided setup steps

1. Brand + owner identity
2. Lead source / HighLevel mapping
3. Twilio voice routing
4. SMS sender + inbound SMS routing + email sender
5. Booking calendar when HighLevel is connected
6. Platform acceptance
7. Go-live gate

The HighLevel private token remains a server-side worker secret and is intentionally not editable from Owner Setup.

## External actions

Voice and SMS webhook changes still require explicit owner confirmation. The Setup page calls the same Pass 4 and Pass 6 routing endpoints that already enforce confirmation.

## Guided demo

The Owner Setup page includes a five-minute walkthrough:

1. Overview — business metrics and hot leads
2. Campaigns — preview + governed follow-up
3. Isla — live business reasoning
4. Scale Lab — four governed communication lanes
5. Isla Live — governed video session

Completing the walkthrough may be recorded in `owner_demo_runs`; it does not send provider traffic.

## Deploy

```bash
cd ~/Kenji

git fetch origin \
  refs/heads/build/pass10-owner-setup-demo-polish:refs/remotes/origin/build/pass10-owner-setup-demo-polish

git checkout -B build/pass10-owner-setup-demo-polish \
  origin/build/pass10-owner-setup-demo-polish

npm run check

CLOUDFLARE_PLATFORM_DIR="$HOME/cloudflare-platform" npm run deploy:pass10
```

Expected package version: `0.10.0`.

## Acceptance

After deployment:

1. Open **Owner Setup**.
2. Confirm branding and business objective.
3. Review HighLevel connection state and map the real location/calendar if available.
4. Review a Twilio number's current Voice URL before routing it.
5. Select the SMS sender and route inbound SMS only if desired.
6. Enter a verified Resend sender identity.
7. Run launch acceptance.
8. Follow the five-minute guided demo.

Pass 10 introduces no new provider, secret, queue, Durable Object, or runtime worker.
