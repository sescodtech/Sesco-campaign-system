# Vercel TypeScript fix — 2026-10-01

The Vercel build compiled successfully but failed during TypeScript validation because Supabase query `data` is typed as nullable.

Fixed files:
- `app/(dashboard)/analytics/page.tsx`
- `app/(dashboard)/campaigns/page.tsx`

Change applied:
- Replaced nullable destructuring defaults such as `const { data = [] } = ...` with an explicit result followed by `const data = result.data ?? []` (or equivalent).

Reason:
JavaScript destructuring defaults only apply to `undefined`, not `null`. Supabase query responses use `T[] | null`, so TypeScript correctly rejected `data.reduce(...)` / `data.map(...)` when `data` could still be `null`.

The Next.js 15.5.4 security warning in the Vercel log is separate from this compile failure and should be handled as a dependency upgrade after the immediate build is stable.
