# Kenji Pass 16 — Hardening + EILA operating handbook

Pass 16 is the stabilization pass after the premium UI work. It fixes browser feedback loops, bounds stalled requests, hardens owner authentication, adds response protections, and replaces the basic support FAQ with a detailed operating handbook.

## Root cause fixed

Pass 15 introduced a self-triggering `MutationObserver` loop on the Overview hot-lead list. The observer called the hot-lead decorator, which rewrote the fire badge text on every run. That rewrite created another child-list mutation, which called the decorator again. The browser could spend the event loop repeatedly decorating the same node, leaving the page apparently loading and making clicks unreliable.

The callback stage decorator had the same class of risk. Pass 16 makes both decorators idempotent and schedules decoration through one animation-frame gate.

## Browser resilience

- same-origin `/api/*` GET/HEAD requests without an existing signal are bounded to 7 seconds
- same-origin mutation requests without an existing signal are bounded to 15 seconds
- timeout/network errors become visible errors instead of permanent loading states
- call workspace has an explicit error tile and Retry control
- frontend script/API failures flip the small UI health chip to `UI degraded`
- no decoration observer rewrites unchanged values
- event listeners on Pass 15 call tickets/actions are bound once

## Authentication/security

Existing protections remain:

- salted PBKDF2-SHA256 password hashes
- raw session tokens are never stored in D1
- session cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`
- API routes require owner authentication unless explicitly exposed as safe demo reads by the demo layer
- provider secrets stay server-side / Secrets Store

Pass 16 adds:

- D1-backed failed-login ledger
- six failed login attempts within the 15-minute window trigger a 15-minute block for the email/IP fingerprint
- successful login clears that fingerprint's failure record
- expired owner sessions and stale auth-attempt records are cleaned opportunistically on auth traffic
- browser mutation requests with a foreign `Origin` are rejected
- HTML/API responses add `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, and no-store caching where applicable

A restrictive CSP is intentionally not added in this pass because the current LiveKit/video/WebSocket integration must be inventoried first. Do not add a guessed CSP during customer handoff.

## EILA operating handbook

The bottom-right 24-hour support control now contains six searchable sections:

1. Start Here
2. Daily Work
3. Automation
4. Integrations
5. EILA
6. Troubleshooting

The handbook documents the daily operating routine, stage meanings, lead actions, call transcript review, callback ownership, campaign retry behavior, channel consent, governor/circuit behavior, Launch readiness, HighLevel mapping, appointment confirmation, CSV/API ingest, Twilio voice/SMS routing, email sender setup, EILA action boundaries, EILA Live flow, and common failure recovery.

## Deployment

```bash
cd ~/Kenji

git fetch origin
git checkout main
git reset --hard origin/main

npm run check
npm run deploy:pass16
```

Pass 16 applies `0012_auth_hardening.sql` and then redeploys only `kenji-overwatch-worker`. It does not change provider routing, queue topology, or shared repositories.

## Acceptance test

### Browser / navigation

1. Hard-refresh the Command Center.
2. Confirm the page becomes clickable immediately and remains responsive for at least 30 seconds.
3. Move through Overview, Leads, Calls, Callbacks, Campaigns, Integrations, EILA, Nurture, Scale, Launch, and Owner Setup.
4. Confirm no surface causes sustained CPU churn or repeated visual flashing.

### Overview

1. Confirm 80+ leads receive one fire marker and 90+ leads receive double-fire/red emphasis.
2. Leave Overview open through multiple snapshot refreshes.
3. Confirm the fire markers do not continually rewrite/flicker and navigation remains responsive.

### Callbacks

1. Open Callback Queue.
2. Confirm stage tint and stage badge appear once and remain stable.
3. Confirm the premium action deck remains visible.
4. Refresh the queue and confirm the stage styling does not flash between unstyled/styled states.

### Calls

1. Open Calls.
2. Confirm compact call tickets load.
3. Click different tickets and verify the right-side detail pane updates.
4. Open Conversation and Call Details.
5. Confirm synthetic records say `DEMO TRANSCRIPT`; real stored transcripts are not labeled demo.
6. If the API is intentionally unavailable, confirm the error tile and Retry button appear instead of an endless loader.

### Auth

1. Confirm Demo View can still navigate read-only surfaces.
2. Confirm side-effect actions still require Login.
3. Confirm valid owner login succeeds.
4. In a controlled test only, verify repeated bad logins eventually return HTTP 429 / retry-later rather than running unlimited password checks.
5. Do not intentionally lock the customer out immediately before a demo.

### Support

1. Open 24-hour support.
2. Confirm six handbook sections are visible.
3. Search for `callback`, `HighLevel`, `SMS`, `EILA Live`, and `stuck loading`.
4. Confirm the panel remains fixed-height and scrolls internally.

## Post-Pass-16 next step

After this pass, stop feature/UI expansion. Run the real-customer hardening checklist: one controlled inbound call, one outbound call, callback, consented SMS, email, HighLevel writeback/appointment when configured, EILA text, EILA Live, and Launch acceptance. Any remaining work should be driven by a failed acceptance item or customer feedback.
