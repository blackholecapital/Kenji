# Kenji AI Call Center + Isla Overwatch

Dedicated Kenji demo/control plane built on Black Hole's existing voice, video, and EILA runtime stack.

Pass 1 establishes the isolated lead data plane, outbound call pipeline, CSV/API ingestion, CRM-style lead tiles, callback queue, owner dashboard, and Isla Overwatch live assistant/video surface.

No credential values belong in this repository. Worker deployments consume the Cloudflare `default_secrets_store` bundle through the shared `blackholecapital/cloudflare-platform` deployment helper.
