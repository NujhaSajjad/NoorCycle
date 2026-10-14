# NoorCycle participant tracker — setup and operations

## 1. Database migrations

Run the SQL files in `supabase/migrations/` **in order** in the Supabase SQL Editor:

1. `001_initial_schema.sql`
2. `002_rpc_functions.sql`
3. `003_quarter_system.sql`
4. `004_participants_auth.sql`
5. `005_security_hardening.sql`

The application code in `src/` expects the **V4** RPC signatures created by migration `005`. Running only through `004` leaves the app calling functions that do not exist on the server.

## 2. Create the admin account

Run once in the Supabase SQL Editor (do **not** CSV-import participant 0):

```sql
INSERT INTO participants
  (participant_number, username, password_hash, is_admin, is_reader)
VALUES
  (0, 'your_admin_username', crypt('YourSecureAdminPass!', gen_salt('bf', 10)), TRUE, FALSE);
```

Choose a strong password. This account controls the programme.

## 3. Supabase Auth settings

Fixed accounts are derived from the participant table, so the app creates a Supabase Auth account on the first successful login. Disable **email confirmations** for the project (Auth → Providers → Email) so the first login completes immediately.

## 4. Environment

`.env.local` must contain:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Run `npm install`, then `npm run dev`.

## 5. Configure the programme start date

Log in with the admin account, open `/admin`, and set **Programme Start Date**. All 120 daily assignments rotate from Day 1 = that date. Changing it later shifts every participant's assignment, so set it before issuing credentials.

Assignment formula (server-side):

```
Part = ((ParticipantNumber - 1 + ProgramDay - 1) % 120) + 1
Para = ceil(Part / 4)
Quarter = ((Part - 1) % 4) + 1
```

`ProgramDay` is derived only from the start date and the calendar date — never from login count or device.

## 6. Import participants

CSV columns, header optional:

```
participant_number,username,password,is_admin
1,noor_001,secret123,false
2,noor_002,secret456,false
...
```

Rules:
- Participant numbers must be `1`–`120`, unique.
- Usernames must be unique across participants.
- Passwords must be at least 6 characters.
- Re-importing a participant updates username/password/admin flag. Existing `reading_log` history and Supabase Auth links are preserved.
- Participant `0` (admin) cannot be managed from this form.

Paste the CSV in `/admin` → **Import Participants** and review the per-row result.

## 7. Using the tracker

Each participant signs in at `/` with their username/password. They see today's assigned Para and quarter, start the timer, read independently using a Mushaf or Quran app, and confirm completion. Progress is saved in `reading_log` keyed by participant number and calendar date, so refresh, logout, or switching devices keeps history. A missed day does not shift the rotation.

The admin dashboard shows today's `completed / total`, pending count, remaining assignments, and percentage. Each date is tracked separately.

## 8. Tests

```
npm run test:assignment
```

Verifies the assignment formula, the para/quarter conversion, all 120 rotations (every participant sees every part exactly once), and date-based (not login-based) progression.