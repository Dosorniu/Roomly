# Shared Roomly setup

Status: integration code and migrations are prepared. No hosted Supabase project
has been created or connected, and real email delivery / hosted Realtime have not
been verified yet. The default remains an explicitly local demo.

## Create and configure the project

1. Create a Supabase project in your own account. Keep its database password and
   secret/service-role keys outside the repository and chat.
2. Run the SQL files in `supabase/migrations` in filename order using the SQL
   editor (or `supabase db push` from an authenticated CLI). They create the
   private hierarchy, rooms, sessions, memberships, allowlist, watches and alerts.
   The catalog is still 27 sample rooms; new shared availability starts Unknown.
3. Add only agreed student emails through the SQL editor, for example:
   `insert into roomly_private.allowed_students(email, university_id) values ('student@example.edu', 'cbs');`
   Use lowercase real addresses. Registration does not grant room access until
   the email is verified and present in this allowlist. Removing it revokes RPC
   access. No real emails are seeded or committed.
4. In Authentication, enable email login and email confirmation. Set the Site URL
   to the local preview URL for testing and eventually your deployed URL. Configure
   permitted redirect URLs. For a code-based sign-in flow, set the Magic Link email
   template to include `{{ .Token }}`. Default magic links are also accepted by the
   client, provided the redirect URL is correct. Use a configured SMTP provider
   before inviting actual students; default email sending has provider limits.
5. Copy `.env.example` to an ignored `.env.local`. Set
   `NEXT_PUBLIC_ROOMLY_MODE=supabase`, the project URL and **publishable key**
   (legacy anon key also works). Never use the secret/service-role key. Restart
   the dev server or rebuild after changing these build-time public variables.
6. The migration publishes only `public.roomly_revision` to `supabase_realtime`.
   Enable/check that publication in the dashboard. The app subscribes to revision
   changes and refetches its authorized projection. A five-second poll and a focus
   refresh recover missed/disconnected events.
7. Optional cleanup: enable pg_cron and schedule
   `select cron.schedule('roomly-expiration', '* * * * *', 'select roomly_private.expire_sessions()');`.
   Every read/command also expires sessions using server time, so stale sessions
   are never returned as occupied even without this maintenance job.

## Authorization and transactions

`roomly_snapshot`, `roomly_command` and `roomly_watch` are the API surface. They
are PostgreSQL functions exposed through Supabase RPC; a second web API server is
unnecessary. Only the authenticated role can call them. The actor comes from
`auth.uid()` and a confirmed entry in `auth.users`, never a browser-supplied user ID
or an OpenAI HTTP header. Functions use an empty search_path and fully qualified
relations. Private tables have no browser grants and are outside exposed schemas.

Occupancy commands execute in one transaction under an advisory lock. Unique
constraints enforce one active session per room and one membership per user;
capacity, duration, sharing and holder permissions are checked in SQL. V1 uses
one short global occupancy lock for predictable correctness at small campus scale.
Larger deployments should use ordered room/user locks after load testing.

Snapshots expose counts, session times, the caller's membership and whether that
caller is holder. They do not expose other students' IDs or emails. Watches and
notifications are account-specific. The last leave creates durable alerts for
watchers; expiration creates Unknown and sends no false Free alert. Alerts are
retained for 30 days (latest 50 displayed). These are in-app alerts, not push/email.

## Verification before enabling shared use

- Run lint, TypeScript, domain/routes, database and E2E checks, then build.
- Add two test email addresses to the allowlist and sign in from independent
  browsers/devices. A checks in, B sees and joins, A leaves, B becomes holder,
  B leaves, and an account watching the room receives an alert after reconnecting.
- Try an unapproved email and a non-holder update: both must be rejected.
- Verify the deployed CSP permits only your Supabase HTTPS/WebSocket origin and
  the realtime subscription connects. Client configuration must not contain secrets.
- Keep real student deployment off until these hosted tests pass. Demo browser
  data is intentionally not copied into the shared database.

References: [Supabase Auth](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[database functions](https://supabase.com/docs/guides/database/functions),
[Realtime](https://supabase.com/docs/guides/realtime/postgres-changes),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
