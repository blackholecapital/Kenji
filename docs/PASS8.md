# Pass 8 — Queue-backed video lane + full-stack rehearsal

Pass 8 closes the last advisory lane from Scale Lab. Isla Live now travels through the same orchestration governor pattern as voice, SMS and email without changing the shared `blackhole-video-worker` contract.

## Video route

```text
Browser / Isla Live
  → kenji-orch-video-ingress
  → kenji-orchestrator-worker / LaneGovernor
  → kenji-video-jobs
  → kenji-video-worker
  → blackhole-video-worker
  → LiveKit + LemonSlice + EILA voice
```

The browser still calls `POST /api/video/session`. Overwatch creates a `video_jobs` ledger row, enqueues it and waits briefly for the governed job to produce the normal LiveKit session payload. The existing Isla Live client therefore needs no contract change.

If the lane is saturated, disabled or circuit-open, the job stays queued in orchestration instead of bypassing capacity control. Overwatch returns a visible busy/error state rather than claiming a room opened.

## Added

- `kenji-orch-video-ingress` + DLQ
- `kenji-video-jobs` + DLQ
- `kenji-video-worker`
- queue-mode `video` lane in `orchestration_lanes`
- D1 `video_jobs` lifecycle ledger
- five-attempt broker retry budget
- shared `blackhole-video-worker` service binding from the execution worker
- authenticated video readiness reporting
- Full-stack rehearsal panel inside Scale Lab
- zero-provider-traffic preflight across data, voice, SMS, email, nurture, orchestration and video

## Capacity boundary

The video governor controls how quickly Kenji creates avatar sessions. It does not manufacture GPU, LiveKit, LemonSlice or renderer capacity. Scale Lab remains a control-plane model; live ceilings should only be raised after downstream provider/runtime capacity is validated.

## Deploy

```bash
cd ~/Kenji
git fetch origin
git checkout -B build/pass8-video-governor origin/build/pass8-video-governor
npm run check
CLOUDFLARE_PLATFORM_DIR="$HOME/cloudflare-platform" npm run deploy:pass8
```

After deployment:

1. Open **Scale Lab** and confirm `video` shows `queue` mode.
2. Run **Full-stack rehearsal**. It sends no provider traffic.
3. Start **Isla Live**. The normal LiveKit/LemonSlice UI should open after passing through the governed video lane.
4. Lower the video ceiling or open the video circuit to verify new sessions wait/fail visibly without affecting voice, SMS or email.

No new secret values are required. Pass 8 reuses the centralized internal capability token and the existing shared video broker credential boundary.
