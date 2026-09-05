# Pass 20 — Final UI Cleanup

Pass 20 is a presentation/development-cleanup pass only. It does not change provider routing, queue topology, D1 schema, secrets, Durable Objects, execution workers, or shared repositories.

## Auth hierarchy

- Kenji logo is enlarged and centered.
- EILA uses the existing repo-owned `assets/EILA-small-chat.jpg` as a square identity badge in the top-left of the login card.
- `BLACK HOLE AI CALL CENTER` remains centered below the Kenji mark.
- The login form remains Name / Email / Passcode / Enter AI Call Center.
- The footer becomes centered `Powered by EILA OS` text rather than a second circular portrait.

## Nurture workspace

Nurture is reorganized into a fixed operating layout:

- top KPI strip remains full width;
- left two-thirds: Channel Control, Consent Desk, Sequence Builder, and Nurture Sequences in a compact 2×2 grid;
- right one-third: sticky long-term Nurture customer rail;
- Nurture customer tickets are significantly smaller and render two-across when space permits;
- the rail scrolls independently on desktop.

The existing consent-aware SMS/email execution path remains unchanged.

## Calls

The selected-client detail panel now inherits the selected lead's stage tone:

- stage-colored rim/top band;
- stage-tinted header, avatar, score, contact metadata, and active tab;
- heat indicators remain directly beside the customer name on both the call ticket and selected-client panel.

## Development cleanup

- retired the hidden Pass 12 top-bar Kenji promo injector and its external favicon dependency;
- stopped Pass 11 from rewriting the current sidebar branding on boot;
- current branding remains owned by the later Kenji/EILA brand layers.

## Deploy

```bash
npm run check
npm run deploy:pass20
```
