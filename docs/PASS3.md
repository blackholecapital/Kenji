# Pass 3 — Agency Ops + Actionable Isla

Pass 3 turns the deployed Kenji demo from a monitoring surface into a controlled operating layer.

## Added

### AI call outcome extraction
Completed calls are classified after Twilio closes the call. The voice worker stores disposition, confidence, concise summary, next action, requested callback time and requested appointment time.

Provider failures such as `busy` and `no-answer` are recorded deterministically without asking the LLM.

A clear callback request creates a queued callback automatically. A clear appointment request creates a **pending appointment intent**, never a silent external booking.

### Agency Ops
A new **Agency Ops** view aggregates every configured HighLevel location: linked leads, call volume, due callbacks, booked/won count, pending appointment intents, DNC count, writeback failures, last pull and HighLevel calendar mapping.

### HighLevel calendar booking
Each location can save `calendarId` and optional `assignedUserId`. Pending appointment intents can be confirmed into HighLevel through `POST /calendars/events/appointments` using the linked contact, location and configured calendar. HighLevel notification and slot validation remain active. A successful booking moves the Kenji lead to `Booked` and clears queued callbacks.

The connected HighLevel token needs the appropriate calendar event write scope. The token remains only on `kenji-highlevel-worker`.

### Isla action tools
Inside Isla Overwatch, the owner can type instructions such as:

- `Call the hottest untouched lead`
- `Move Sarah to Qualified`
- `Schedule a callback with Alex tomorrow at 2 PM`
- `Book Jordan for Friday at 11 AM`
- `Pull the Tampa subaccount now`

Isla resolves the instruction against live lead/location IDs and creates a **pending action preview**. Nothing executes from the planning turn. The owner sees the exact target and payload and must choose **Confirm & execute**. Previews expire after 15 minutes. Executed, failed and expired actions remain in the action ledger.

## Deploy

```bash
cd ~/Kenji
git fetch origin
git checkout build/pass3-agency-ops-actions
git pull origin build/pass3-agency-ops-actions
npm run check
CLOUDFLARE_PLATFORM_DIR="$HOME/cloudflare-platform" npm run deploy:pass3
```

No new centralized secret values are required.

If a real HighLevel location has not been connected yet, Agency Ops and the action-control surfaces still deploy. HighLevel appointment confirmation remains staged until `HIGHLEVEL_PRIVATE_TOKEN`, location linkage and calendar ID are present.
