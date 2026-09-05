# Pass 21 — User onboarding + auth hardening

## Goal

Make the public demo easy to browse while giving approved testers a clean account-creation path and giving the owner a simple switch to close registration after onboarding.

## Account model

- The first account created is `owner`.
- Later accounts created while registration is open are `operator`.
- Existing owner accounts remain compatible.
- Existing users can continue logging in after new-user registration is disabled.

## Login tile

The existing Login button opens the branded login tile.

- **Login** uses Email + Passcode.
- **New User Sign Up** opens Name + Email + Passcode + Confirm Passcode.
- Passcodes require at least 8 characters.
- If signup is disabled, the registration button is removed and the tile states that registration is closed.

The old `/api/auth/bootstrap` route remains compatible for a truly empty installation and creates the first owner.

## Owner Setup

Owner Setup now includes **Access Control**:

- current user count
- current registered users (owner only)
- `Allow new user sign up` toggle
- existing users are unaffected when signup is disabled

Only the owner can change signup availability or list registered users.

## Hardening

- PBKDF2-SHA256 password hashing
- existing hashes default to 180,000 iterations for compatibility
- new hashes use 240,000 iterations
- random per-user salts
- raw passwords are never stored
- session tokens are stored only as SHA-256 hashes
- HttpOnly + Secure + SameSite=Lax session cookie
- maximum eight active sessions per user
- expired-session cleanup
- login and signup throttling by email/IP fingerprint
- 15-minute block after repeated failures
- same-origin requirement on authentication mutations
- generic invalid-login responses
- owner-only registration control

## Deploy

```bash
cd ~/Kenji
git fetch origin
git checkout main
git reset --hard origin/main
npm run check
npm run deploy:pass21
```

The deploy applies `0013_user_onboarding.sql` before deploying Overwatch.

## Acceptance

1. Open the dashboard without logging in. Demo View remains browseable.
2. Click Login.
3. Click New User Sign Up.
4. Create the first or next approved account.
5. Confirm the page reloads into authenticated Owner/Operator mode.
6. Log out and log back in with Email + Passcode.
7. Open Owner Setup → Access Control.
8. As Owner, disable new-user signup.
9. Log out and verify New User Sign Up is no longer offered.
10. Verify an existing user can still log in.
11. Re-enable signup only if another approved tester needs an account.

## Boundary

This pass changes authentication/onboarding and the Overwatch UI only. It does not change provider routing, call/SMS/email execution, queues, Durable Objects, HighLevel, shared runtimes, or any other repository.
