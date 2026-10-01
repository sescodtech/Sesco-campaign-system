# CampaignOS — Campaign Management & Customer Engagement Platform

CampaignOS is a multi-tenant campaign management and customer engagement platform built with Next.js, TypeScript and Supabase. The current codebase contains the core product through **Phase 20**: contact/import management, audiences, reusable templates, Email/SMS/WhatsApp campaigns, durable queueing and scheduling, provider events, suppression/consent, analytics, communication history, approvals, RBAC/team management, automation journeys, auditability and security hardening.

## Technology stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase Row Level Security
- Supabase Storage-ready architecture
- XLSX spreadsheet parsing
- Zod validation
- React Hook Form where appropriate
- Vercel-ready application hosting
- GitHub Actions queue runner

## Product architecture

The platform is organization-scoped. Organization-owned records use `organization_id`, with authorization enforced at database/server level rather than only in the browser.

Main domains:

- Authentication and organizations
- Roles and granular permissions
- Contacts and custom fields
- Excel/CSV imports and saved mappings
- Lists, tags and dynamic segments
- Email templates and personalization
- Campaign creation and maker/checker approval
- Email, SMS and WhatsApp providers
- Durable campaign recipients/jobs
- Scheduling and provider quota handling
- Webhook event tracking
- Consent, suppression and unsubscribe management
- Analytics and contact communication history
- Team invitations and custom roles
- Audit/activity monitoring
- Automation journeys
- MFA, IP controls, rate limiting, replay protection and security events

## Supported communication providers

### Email

- Brevo
- Resend
- Mailjet

Email sending uses a provider abstraction so campaign business logic is not tied to one vendor.

### SMS

- Termii adapter
- Generic/custom HTTP SMS adapter

The Termii configuration accepts the account-specific API base URL shown in the provider dashboard, plus API key, route and sender ID. Phone destinations are normalized to digits-only international format before sending.

### WhatsApp

- Meta WhatsApp Business Cloud API

The integration stores server-side encrypted credentials and uses approved provider template names/languages/components. The Graph API version is configured by the administrator so the application is not tied permanently to one version.

## Requirements

- Node.js 20+
- npm
- Supabase project
- GitHub repository if using the included scheduled queue workflow
- Vercel or another Next.js-compatible deployment platform
- Provider credentials for channels you choose to activate

## Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Before production deployment:

```bash
npm run typecheck
npm run build
```

## Environment variables

Start from `.env.example`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

APP_URL=http://localhost:3000

INTEGRATION_ENCRYPTION_KEY=
CRON_SECRET=
WEBHOOK_SECRET=

# Optional legacy/direct provider environment configuration.
BREVO_API_KEY=
RESEND_API_KEY=
MAILJET_API_KEY=
MAILJET_API_SECRET=
```

Security rules:

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code.
- Never prefix private provider keys, encryption keys, cron secrets or webhook secrets with `NEXT_PUBLIC_`.
- Use a long random value for `INTEGRATION_ENCRYPTION_KEY`.
- Use separate strong random values for `CRON_SECRET` and `WEBHOOK_SECRET`.

## Database migrations

Run every SQL migration in order. Do not cherry-pick later migrations into a blank database.

1. `001_foundation.sql`
2. `002_organizations_profiles.sql`
3. `003_roles_permissions_memberships.sql`
4. `004_operational_foundation.sql`
5. `005_rls_policies.sql`
6. `006_contacts_imports.sql`
7. `007_contact_organization_tools.sql`
8. `008_dynamic_segments.sql`
9. `009_email_templates.sql`
10. `010_campaign_builder.sql`
11. `011_email_provider_integrations.sql`
12. `012_campaign_queue.sql`
13. `013_campaign_scheduling.sql`
14. `014_message_events.sql`
15. `015_suppression_consent.sql`
16. `016_analytics_reporting.sql`
17. `017_contact_communication_history.sql`
18. `018_campaign_approval_workflow.sql`
19. `019_team_role_management.sql`
20. `020_advanced_audit_activity.sql`
21. `021_sms_channel.sql`
22. `022_whatsapp_channel.sql`
23. `023_automation_journeys.sql`
24. `024_security_hardening.sql`

After applying the migrations, inspect Supabase SQL output for errors before proceeding.

## First administrator setup

Public administrator registration is intentionally not exposed.

1. Create the first user from **Supabase Authentication → Users**.
2. Start the application and sign in at `/login`.
3. A user without an organization membership is redirected to `/setup`.
4. Complete the organization setup form.
5. The authenticated `bootstrap_organization` RPC creates the organization, default roles/permissions and the first Super Admin membership.

Default roles include:

- Super Admin
- Administrator
- Campaign Manager
- Marketing Officer
- Customer Service
- Viewer
- Auditor

Custom roles can be added later from Team & Roles.

## Main application routes

The protected workspace includes:

- `/dashboard`
- `/contacts`
- `/contacts/imports`
- `/contacts/lists`
- `/contacts/segments`
- `/contacts/suppression`
- `/campaigns`
- `/campaigns/new`
- `/templates`
- `/automation`
- `/analytics`
- `/integrations`
- `/team`
- `/audit`
- `/settings`
- `/settings/security`

Authentication/security routes include:

- `/login`
- `/forgot-password`
- `/reset-password`
- `/setup`
- `/security/mfa`
- `/security/blocked`

## Contacts and spreadsheet imports

The importer supports Excel/CSV workflows including:

- worksheet selection
- header row selection
- start/end row range
- preview
- column mapping
- custom-field mapping
- invalid email/phone detection
- duplicate detection
- update/skip/create strategies
- rejected-row reporting
- import history
- saved mapping profiles

Sensitive account identifiers are masked in normal UI views.

## Audiences

Campaign audiences can use:

- static lists
- dynamic segments
- selected contacts where supported

Dynamic segment rules are stored as structured data and support AND/OR grouping and common text/date/number operators.

## Templates and personalization

Email templates and channel templates are stored per organization.

Personalization supports contact fields such as:

```text
{{first_name}}
{{last_name}}
{{full_name}}
{{email}}
{{phone}}
{{branch}}
{{account_type}}
{{masked_account_number}}
```

SMS templates store text content. WhatsApp campaign templates store the provider-approved template name, language and components required by Meta.

## Campaign workflow

Campaign states support the maker/checker process:

```text
Draft
  ↓
Submit for approval
  ↓
Approved / Rejected
  ↓
Schedule or send
  ↓
Queued
  ↓
Sending
  ↓
Completed / Failed / Cancelled
```

Scheduling requires the appropriate permission and approved state.

## Queue and provider limits

Campaign delivery is database-backed; it does not depend on the sender keeping a browser tab open.

The queue supports:

- recipient materialization
- batching
- retries
- idempotency safeguards
- provider message IDs
- daily/monthly quotas
- scheduled delivery
- per-channel provider selection

If an integration is configured with a daily limit of 300 and a campaign contains 900 recipients, recipient scheduling can distribute the workload across multiple days instead of bypassing the configured provider limit.

## Queue worker / GitHub Actions

The project includes:

`.github/workflows/campaign-queue.yml`

The workflow invokes authenticated application endpoints to release scheduled campaigns, process campaign jobs and process automation runs.

Add repository secrets:

```text
APP_URL
CRON_SECRET
```

The HTTP worker endpoints authenticate with `CRON_SECRET` and are not protected by the browser-session middleware.

## Email webhook configuration

Provider event endpoint pattern:

```text
https://YOUR_DOMAIN/api/webhooks/email/PROVIDER?secret=YOUR_WEBHOOK_SECRET
```

Examples:

```text
/api/webhooks/email/brevo
/api/webhooks/email/resend
/api/webhooks/email/mailjet
```

The handler normalizes provider events into the application event model and can update campaign recipient/communication history state.

## SMS webhook configuration

Each SMS integration has a generated `webhook_path_key`.

Use:

```text
https://YOUR_DOMAIN/api/webhooks/sms/PROVIDER/WEBHOOK_PATH_KEY?secret=YOUR_WEBHOOK_SECRET
```

The SMS webhook normalizes common delivery statuses. The generic adapter may require small payload-field adaptation for a provider whose callback schema differs materially from the supported normalizer.

Inbound STOP-style SMS events can update SMS consent/suppression when the provider callback supplies inbound-message data.

## WhatsApp webhook configuration

Each Meta WhatsApp integration has a generated `webhook_path_key`.

Configure the Meta callback URL as:

```text
https://YOUR_DOMAIN/api/webhooks/whatsapp/meta/WEBHOOK_PATH_KEY
```

Use the same verify token you save in the CampaignOS integration form.

The webhook supports:

- Meta verification challenge
- HMAC signature verification with the app secret
- delivery/read/failure event normalization
- webhook replay/deduplication
- inbound message storage
- contact communication history
- STOP/unsubscribe/cancel/quit consent handling

## Consent and suppression

The platform maintains channel-specific consent and suppression state.

Before a recipient is materialized and again immediately before provider send, the application checks the relevant channel consent/suppression state.

Suppression reasons include:

- unsubscribe
- hard bounce
- complaint
- manual block
- invalid address

Email marketing uses recipient-specific unsubscribe tokens and a public unsubscribe flow.

## Analytics

Campaign analytics include:

- recipients
- queued
- sent
- delivered
- opened/read
- clicked
- bounced/undelivered
- failed
- unsubscribed
- delivery rate
- open/read rate
- click rate
- click-to-open rate
- bounce/failure rate
- unsubscribe rate

Analytics reads organization-scoped data through RLS-aware structures.

## Automation journeys

Automation supports journeys with steps such as:

- Email
- SMS
- WhatsApp
- Delay
- Event-based condition

Journey trigger foundations include:

- manual
- list
- segment
- contact created
- campaign event

Runs and enrollments are durable database records, allowing retries and delayed steps independently of a browser session.

## Audit and activity monitoring

The audit subsystem records organization/user/action/entity metadata and now supports:

- category
- severity
- source
- actor email
- request ID
- contextual metadata
- filtering/search
- CSV export with permission and security-policy checks

Audit records remain protected by organization RLS and are treated as immutable application history.

## Security hardening

Organization security settings support:

- optional MFA enforcement
- absolute session lifetime controls
- failed-login throttling
- IPv4/CIDR allowlists
- data-export policy
- security events
- rate-limit buckets
- webhook replay receipts

The MFA page uses Supabase TOTP enrollment/challenge/verification. When an organization requires MFA, protected workspace access requires an AAL2 session.

Machine-to-machine endpoints such as webhooks and queue processors are excluded from browser authentication middleware and authenticate using their own signatures/secrets.

## Integration credential storage

Provider secrets are never returned to normal client code after storage. Integrations store encrypted credential payloads and expose only non-secret configuration/status information required by the UI.

## Deployment

### Supabase

1. Create the production project.
2. Apply migrations `001`–`024` in order.
3. Configure Auth site URL and redirect URLs for the production domain.
4. Create/bootstrap the first administrator.

### Vercel

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Add production environment variables.
4. Deploy.
5. Update `APP_URL` to the final HTTPS application URL.
6. Re-deploy if required after changing environment variables.

### Providers

After deployment, configure provider sender/domain settings and webhook URLs against the final HTTPS domain.

## Production verification checklist

Before sending real campaigns:

```bash
npm install
npm run typecheck
npm run build
```

Also verify:

- all migrations applied successfully
- RLS enabled on organization-owned tables
- sender domains/identities verified
- provider integration tests succeed
- webhook callbacks are publicly reachable over HTTPS
- queue workflow secrets are configured
- unsubscribe flow works from a test campaign
- consent/suppression blocks a test contact
- maker/checker approval is enforced
- MFA/IP policies are tested before enabling restrictive settings company-wide
- SMS sender ID/routing is approved where required
- WhatsApp templates are approved in Meta before use

## Known limitations at the Phase 20 milestone

- A complete production `npm run build` could not be executed in the build sandbox because npm dependency downloads timed out. See `BUILD_REPORT.md`.
- Provider-specific real traffic still requires your own credentials, verified senders/domains/numbers and provider-side webhook registration.
- The generic custom SMS adapter may require provider-specific callback-field mapping for some vendors.
- GitHub Actions scheduled workflows are suitable for a free/low-volume foundation but are not a precision real-time job scheduler.
- Advanced very-large-dataset optimization, billing/subscriptions and full production QA are intentionally scheduled for later phases.

## Roadmap after Phase 20

- **Phase 21:** performance and scale hardening
- **Phase 22:** SaaS plans, usage metering and billing readiness
- **Phase 23:** full production QA, accessibility and edge-case testing
- **Phase 24:** final production deployment, observability and operations

See `PHASE_PROGRESS.md` for the current status.
