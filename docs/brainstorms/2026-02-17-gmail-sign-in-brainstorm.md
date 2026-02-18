---
date: 2026-02-17
topic: gmail-sign-in
---

# Gmail Sign-In for Optional User Identity

## What We’re Building
Add a simple, optional Gmail sign-in flow to the existing Kannada PWA that gives learners a visible identity (name/photo) but does not create backend accounts, store user history, or gate lesson content. The feature should stay lightweight and aligned with the current architecture (static frontend, Google TTS assets, service-worker caching), while improving usability for adults/teachers on shared school devices.

## Why This Approach
The user preference is an optional UI-only login with no backend and no required personalization features. Given the VPS allow-listing model for traffic control, we should avoid adding server-side auth complexity that could delay delivery and introduce storage/privacy obligations. A client-side Google sign-in path is the minimum viable solution and can be introduced without changing static hosting assumptions.

## Key Decisions
- Decision 1: Use a **client-only Google Identity** flow (Google Identity Services button) with no backend token verification and no user data persistence.
- Decision 2: Store sign-in state client-side only (e.g., localStorage/session flag) to keep the feature optional and non-blocking.
- Decision 3: Keep login strictly optional with a clear manual sign-out and no feature lockout for unsigned users.
- Decision 4: Delay any server-side user account system until explicit progress sync/dashboard requirements are added later.

## Compared Approaches

### Recommended: Client-Only Google Identity Button
Implement a button that starts Google sign-in and shows avatar/name when authenticated, but all app content remains publicly accessible.

**Pros:** Fastest path, no new backend, minimal privacy burden, works with current static VPS deployment.  
**Cons:** Cannot guarantee identity proof or secure entitlement; state can be cleared on browser changes.

### Approach B: Client Sign-In + Tiny Verify Endpoint
Add a minimal backend endpoint that verifies Google ID tokens and returns signed session info, still without storing profile data.

**Pros:** Better identity confidence and auditability.  
**Cons:** Adds backend deployment, endpoint hardening, and maintenance overhead.

### Approach C: Full Auth Provider (OAuth + DB)
Add Firebase/Auth0 and optional user profile storage.

**Pros:** Scalable if progress tracking is needed later.  
**Cons:** Overkill for current scope; higher cost and complexity.

## Open Questions
- None.

## Next Steps
1. Run `/prompts:workflows-plan` to define UI copy, placement, and edge handling.
