# Pass 6 — Multichannel Nurture

Pass 6 completes the separated communications architecture around the existing Kenji voice/video stack.

## Dedicated workers

- `kenji-sms-worker` — Twilio SMS send queue, delivery callbacks, inbound SMS ledger, STOP handling and explicit SMS webhook routing.
- `kenji-email-worker` — Resend outbound email queue.
- `kenji-nurture-worker` — one-minute sequence dispatcher that enforces channel consent before it creates SMS/email jobs.
- Existing `kenji-voice-worker` remains the call engine.
- Existing `blackhole-video-worker` remains the standing Isla avatar/video engine.

## Queues

- `kenji-sms-jobs`
- `kenji-sms-jobs-dlq`
- `kenji-email-jobs`
- `kenji-email-jobs-dlq`

The nurture worker is a producer. SMS and email workers consume independently, so one provider can slow or fail without blocking the other communications lane.

## Consent model

Voice contactability, SMS opt-in and email opt-in are intentionally separate.

`lead_channel_consent` stores SMS/email state, opt-in/opt-out timestamps, source and an operator note. A generic lead `contactable=true` value never grants SMS or email permission.

Inbound Twilio STOP / STOPALL / UNSUBSCRIBE / CANCEL / END / QUIT disables SMS opt-in only. It does not silently mutate email permission.

Global lead DNC / non-contactable and Won/Lost stages are conservative hard stops for nurture dispatch.

## Nurture surface

The new **Nurture** page provides:

1. SMS + email worker readiness.
2. Twilio SMS-capable number inventory.
3. Explicit selection of the outbound SMS sender.
4. Explicit confirmation before changing a Twilio number's SMS webhook. Voice routing is untouched.
5. Resend `From` and optional reply-to configuration.
6. Consent desk for SMS/email permission per lead.
7. Audience preview with total, SMS-eligible and email-eligible counts.
8. Draft sequence builder for SMS/email steps.
9. Explicit launch, pause, resume and manual tick controls.
10. Per-sequence message/failure metrics.

## Sender configuration

Deployment does not choose an SMS number or email From identity automatically.

In **Nurture**:

- choose a Twilio number and click **Use as sender**, then save;
- route SMS replies only when you explicitly want that number's SMS webhook to point at Kenji;
- set a Resend-verified From identity before launching email steps.

## Deploy

```bash
cd ~/Kenji
git fetch origin
git checkout build/pass6-multichannel-nurture || git checkout -b build/pass6-multichannel-nurture origin/build/pass6-multichannel-nurture
git pull origin build/pass6-multichannel-nurture
npm run check
CLOUDFLARE_PLATFORM_DIR="$HOME/cloudflare-platform" npm run deploy:pass6
```

Pass 6 uses only existing centralized credentials:

- `XYZ_DEMO_TWILIO_ACCOUNT_SID`
- `XYZ_DEMO_TWILIO_AUTH_TOKEN`
- `XYZ_DEMO_RESEND_API_KEY`
- `XYZ_DEMO_EILA_RUNTIME_TOKEN`

No secret values are committed.
