# Pass 21 stabilization hotfix

This hotfix addresses two launch-blocking failures found during browser acceptance after Pass 21.

## Browser freeze

`pass18-client-workspace.js` was still managing callback score flames after Pass 19 moved callback heat beside the customer name. Pass 19 removed the old callback-score flame node, while Pass 18 assumed that node always existed. Its MutationObserver then repeatedly scheduled decoration work and threw on `flame.textContent`, creating a UI lockup.

The hotfix:

- makes callback decoration null-safe;
- stops Pass 18 from managing the legacy score flame after Pass 19 owns the callback tile;
- watches structural DOM changes only, not character-data changes caused by its own decorators;
- removes the unnecessary top-actions observer;
- prevents overlapping Pass 18 data refreshes;
- catches a decoration failure so one optional visual enhancement cannot freeze the application.

## Auth repair

Pass 21 added code that stores the PBKDF2 iteration count per account, but migration `0013_user_onboarding.sql` did not add `owner_users.pass_iterations`.

Migration `0014_auth_onboarding_repair.sql` adds that column with a default of `180000`, preserving compatibility with accounts created before Pass 21. New accounts continue to use 240000 iterations.

The signup enhancement now boots immediately from the already-rendered login DOM instead of waiting behind older DOM decorators. Registration status fails closed if the access endpoint is unavailable.

## Deploy

After merge:

```bash
cd ~/Kenji
git fetch origin
git checkout main
git reset --hard origin/main
npm run check
npm run deploy:pass21
```

The deploy applies all pending D1 migrations before redeploying Overwatch.

## Acceptance

1. Hard refresh and leave the page idle for 30 seconds. No repeated `pass18-client-workspace.js` errors should appear.
2. Click Login. The tile remains responsive.
3. `New User Sign Up` appears when registration is enabled.
4. Existing account login works with the original password after the `pass_iterations` repair.
5. New signup creates a session and reloads authenticated.
6. Owner Setup > Access Control can disable future signup.
