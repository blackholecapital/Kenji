# Pass 4 — Inbound Receptionist + Live Demo Hardening

Pass 4 closes the largest demo gap after the outbound/HighLevel/Isla passes: a real inbound AI receptionist on the same Kenji operating data plane.

## Added

### Inbound AI receptionist

`POST /twilio/inbound` is the Twilio Voice webhook. Unknown callers become a new `Inbound Call` lead tile automatically; known callers are matched back to their existing lead record. The call is stored in the existing `calls` table with `direction=inbound`.

The live path is:

```text
Twilio inbound call
  -> kenji-voice-worker /twilio/inbound
  -> bidirectional Media Stream /twilio/inbound-media
  -> Deepgram nova-3 STT
  -> EILA runtime
  -> 8 kHz mu-law audio back to Twilio
  -> Kenji D1 transcript + lead/call state
```

Inbound DNC requests disable future outbound calling without blocking the caller from receiving help on the current inbound call.

### Safe Twilio routing control

The voice worker can list voice-capable numbers on the shared demo Twilio account. The Command Center shows each number's current Voice URL before any change.

Routing is deliberately human-controlled:

- deployment never changes a Twilio number
- the logged-in owner chooses a specific number
- the UI displays the current Voice URL
- the owner must confirm the exact route change
- only the Voice URL is changed; SMS routing is left untouched
- the previous Voice URL and new Kenji URL are recorded in `phone_routes`

### Live Demo surface

A new **Live Demo** page shows live readiness for:

- Twilio
- Deepgram
- EILA runtime
- Isla Live video
- Kenji D1
- HighLevel connection state

It also provides the inbound webhook, available Twilio numbers, route state, the active demo line, and a five-minute rehearsal sequence.

## Deploy

```bash
cd ~/Kenji
git fetch origin
git checkout build/pass4-inbound-demo-hardening
git pull origin build/pass4-inbound-demo-hardening
npm run check
CLOUDFLARE_PLATFORM_DIR="$HOME/cloudflare-platform" npm run deploy:pass4
```

No new secrets are required. Pass 4 uses the Twilio, Deepgram and EILA credentials already bound from `default_secrets_store`.

After deployment, open the Command Center and choose **Live Demo**. Review a Twilio number's current Voice URL before choosing **Route to Kenji**.

## Acceptance rehearsal

1. Live Demo shows Twilio, Deepgram, EILA runtime and D1 ready.
2. Select a disposable/demo Twilio number and explicitly route it to Kenji.
3. Call the number from a phone.
4. The AI receptionist answers.
5. The caller appears as a lead tile if not already known.
6. The inbound call and transcript appear in Calls.
7. Ask Isla about the caller or pipeline state.
8. Open Isla Live and continue the executive/operator demo.

## Pass 5 candidates

- campaign batching and concurrency controls for large callback lists
- retry policy and quiet-hour/contact-window controls
- live event streaming instead of polling
- HighLevel OAuth app install for agency-scale subaccounts
- dedicated Kenji number pool and per-subaccount caller-ID policy
- role-based operator logins and audit exports
