# RBAC/Refresh Stability Tracker (API)

- incident_id: RBAC-REFRESH-2026-03
- repo: API-REST-STACK-NODE
- status: completed
- owner: codex-agent
- last_update: 2026-03-17

## Objective
Stabilize refresh/session behavior to prevent false auth expiry, refresh storms, and downstream RBAC false negatives.

## Phase Status
- Phase 0 (tracking scaffold): completed
- Phase 1 (backend hardening): completed
- Phase 2 (frontend hardening): completed (tracked in frontend repo)
- Phase 3 (cross-repo sync): completed
- Phase 4 (final validation + close): completed

## Implemented In This Repo
1. Added refresh replay safety window:
- `AUTH_SECURITY_POLICY.REFRESH_REPLAY_WINDOW_MS`
2. Added dedicated refresh limiter config:
- `RATE_LIMIT_MAX_REFRESH`
3. Added `refreshRateLimiter` middleware and wired auth refresh routes to it.
4. Hardened `AuthService.refresh` with:
- in-flight dedupe by refresh token hash,
- short replay cache for concurrent refresh callers,
- cache prune logic.

## DoD Checks (Phase 1 + Close)
- [x] Refresh path has concurrency protection.
- [x] Refresh has dedicated limiter profile config.
- [x] No public API contract changes.
- [x] Full backend test suite green.
- [x] Commit created.

## Validation Evidence
- Manual backend run shared by user (2026-03-17):
- `Test Files 106 passed | 1 skipped (107)`
- `Tests 365 passed | 1 skipped (366)`

## Phase Summary
- Root mitigation implemented at source: refresh race/replay and limiter tuning are now backend-controlled.
- Refresh endpoints no longer share stricter sensitive throttle budget with unrelated flows.
- Frontend sync and tracker parity completed.
