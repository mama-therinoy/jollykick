# JollyKick v0.1 — Login + Pregnancy Foundation

This development build connects to the new JollyKick Supabase project.

Implemented:
- Email/password login (development test account)
- Automatic routing to pregnancy onboarding when no active pregnancy exists
- Optional baby nickname and required due date
- Pregnancy plan foundation (`free` / `plus`)
- Kick events linked to `pregnancy_id`
- Four movement types: kick, jab, stretch, burst
- Today summary, edit/delete, 24-hour activity
- Free history UI limited to today + previous 2 calendar days (3 days total)
- Uses the new schema fields `occurred_at` and `pregnancy_id`

Not yet implemented:
- Public self-registration
- Google/Facebook login
- Plus payment/activation UI
- PWA manifest/service worker
- Account/pregnancy settings
- Knowledge/privacy pages
- Server-side enforcement of the 3-day Free history visibility rule (current restriction is UI-level; RLS still protects ownership)

Security:
- Frontend contains only the Supabase publishable key.
- Never place an `sb_secret_...`, service-role key, database password, or access token in this repository.
