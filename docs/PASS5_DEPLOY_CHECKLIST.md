# Pass 5 deploy checklist

- `npm run check`
- apply `0005_campaign_orchestration.sql`
- deploy `kenji-campaign-worker`
- deploy `kenji-overwatch-worker`
- open **Campaigns**
- preview an audience before creating a draft
- create a draft and verify no calls are placed
- launch a small test campaign
- verify one-minute rate-limited dispatch into `kenji-call-jobs`
- verify busy/no-answer retries wait for the configured delay
- verify callback/DNC/qualified outcomes stop campaign retries
- verify **Pause all active** stops new dispatch
