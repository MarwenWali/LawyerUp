# Phase 1 Runtime Integration (Supabase)

This guide deploys Phase 1 messaging runtime for LawyerUP.

## What gets deployed
- DB migration: `supabase/migrations/20260401_phase1_messaging.sql`
- DB migration: `supabase/migrations/20260401_auth_user_links.sql`
- Edge functions:
  - `send-message`
  - `conversations-create`
  - `conversations-list`
  - `conversations-messages`
  - `conversations-read`
- Backend auth bridge + legacy user provisioning script:
  - `backend/services/supabaseAuthBridge.js`
  - `backend/scripts/provisionSupabaseAuthUsers.js`

## 1) Prerequisites
Use PowerShell in repo root.

```powershell
cd C:\Users\amine\OneDrive\Bureau\ISS396\LawyerUp
npx supabase --version
```

If you are not logged in yet:

```powershell
npx supabase login
```

## 2) Link local repo to your Supabase project

```powershell
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

## 3) Set required function secrets

```powershell
npx supabase secrets set SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
npx supabase secrets set SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
```

## 4) Apply migrations

If your `SUPABASE_DB_URL` uses a pooler host (for example port `6543`), use the backend migration script:

```powershell
cd backend
npm run supabase:migrate
```

If you are linked to Supabase CLI with a personal access token and want standard CLI migration flow, use:

```powershell
npx supabase db push
```

If you need rollback, run in SQL editor:

- `supabase/rollback/20260401_phase1_messaging_down.sql`
- `supabase/rollback/20260401_auth_user_links_down.sql`

## 5) Deploy edge functions

These functions already validate bearer tokens inside function code (`auth.getUser`), so deploy with gateway JWT verification disabled:

```powershell
npx supabase functions deploy send-message --no-verify-jwt
npx supabase functions deploy conversations-create --no-verify-jwt
npx supabase functions deploy conversations-list --no-verify-jwt
npx supabase functions deploy conversations-messages --no-verify-jwt
npx supabase functions deploy conversations-read --no-verify-jwt
```

## 6) Backend runtime wiring (auth bridge)
Set these in `backend/.env` (same Supabase project values):

```env
SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
```

Then provision Supabase auth identities for existing users:

```powershell
cd backend
npm install
npm run auth:provision
```

## 7) Quick API verification (with a real user access token)
Replace values below.

```powershell
$TOKEN = "<SUPABASE_ACCESS_TOKEN>"
$BASE = "https://<YOUR_PROJECT_REF>.functions.supabase.co"

# List conversations
curl -X GET "$BASE/conversations-list?type=admin_lawyer" -H "Authorization: Bearer $TOKEN"

# Create/open conversation
curl -X POST "$BASE/conversations-create" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"type":"admin_lawyer","target_user_id":"<LAWYER_OR_ADMIN_UUID>"}'

# Send message
curl -X POST "$BASE/send-message" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"conversation_id":"<CONVERSATION_UUID>","content":"Hello from Phase 1"}'

# List messages
curl -X GET "$BASE/conversations-messages?conversation_id=<CONVERSATION_UUID>&limit=20" -H "Authorization: Bearer $TOKEN"

# Mark read
curl -X POST "$BASE/conversations-read" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"conversation_id":"<CONVERSATION_UUID>"}'
```

## 8) Frontend runtime wiring
Set these in `Frontend/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=<YOUR_SUPABASE_ANON_KEY>
```

Then run:

```powershell
cd Frontend
npm install
npm run start
```

## 9) Important auth/session note
Edge functions validate Supabase bearer tokens (`Authorization: Bearer <supabase access token>`).
This repo now bridges backend login/register to Supabase Auth and returns `supabaseSession` in auth responses.
The frontend consumes this and calls `supabase.auth.setSession(...)`.

Existing users should log out and log back in once after deployment so a fresh Supabase session is stored on device.
