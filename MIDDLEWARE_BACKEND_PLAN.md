# Plan: Middleware to Connect the App to the Backend

This document outlines how to add a **client-side API layer (middleware)** so the LawyerUp Expo app talks to the admin-dashboard backend in a central, configurable, and maintainable way.

---

## 1. Current State

| Where   |                                                 What                                                |
|---------|-----------------------------------------------------------------------------------------------------|
| **App** | `LawyersList.js` uses raw `fetch('http://localhost:3001/api/approved-lawyers')` — URL is hardcoded. |
| **App** |          `api/ai.js` is a placeholder with no real HTTP calls.                                      |
| **Backend** | Express on port 3001; routes: `GET /api/approved-lawyers`, `GET /api/pending-lawyers`, `GET /api/rejected-lawyers`, `GET /api/stats`, `POST /api/approve-lawyer/:id`, `POST /api/reject-lawyer/:id`. |

**Problems:** No single base URL, no auth headers, no shared error handling, and `localhost` fails on a real device (must use your machine’s IP or a deployed URL).

---

## 2. Goals of the Middleware Layer

- **Single entry point** — All backend requests go through one API client.
- **Configurable base URL** — Different URL for dev (emulator/local) vs device vs production.
- **Request middleware** — Add headers (e.g. `Authorization`, `Content-Type`), timeouts, retries if needed.
- **Response middleware** — Parse JSON, handle 401/403/500 in one place, optionally refresh token or show a global error.
- **Typed API surface** — Functions like `getApprovedLawyers()`, `approveLawyer(id, body)` instead of raw `fetch` in screens.

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Screens (ChatScreen, LawyersList, AuthScreen, …)                │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  API modules (api/lawyers.js, api/ai.js, api/auth.js …)           │
│  e.g. getApprovedLawyers(), sendPrompt(), login()                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  API client / middleware (api/client.js)                         │
│  - base URL from config                                          │
│  - request: add headers, timeout                                  │
│  - response: parse JSON, handle errors                            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (admin-dashboard server, e.g. http://192.168.x.x:3001)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Step-by-Step Implementation

### Step 1: Config for base URL

- **Option A (simple):** Create `api/config.js` that exports `API_BASE_URL`.
  - Use a constant for dev: `'http://localhost:3001'` for Android emulator, or `'http://10.0.2.2:3001'` for Android emulator (special alias to host loopback).
  - For iOS simulator, `localhost` is fine.
  - For **physical device**, use your computer’s LAN IP, e.g. `'http://192.168.1.10:3001'`.
- **Option B (recommended):** Use environment-based config so you can switch per build:
  - Expo: use `app.config.js` and `extra.apiUrl` (or `EXPO_PUBLIC_API_URL` in SDK 49+), then read via `expo-constants`: `Constants.expoConfig?.extra?.apiUrl`.
  - Default in config to `http://localhost:3001` so it works without env set.

Example `api/config.js`:

```js
// Default for dev; override with env / app.config.js in production
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3001'
  : 'https://your-backend.com';
```

Or read from `Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:3001'` if you set it in `app.config.js`.

### Step 2: API client (middleware) — `api/client.js`

Create a thin wrapper around `fetch` that:

1. **Builds URL** — `API_BASE_URL + path` (e.g. `/api/approved-lawyers`).
2. **Request middleware:**
   - Set `Content-Type: application/json` for POST/PUT.
   - Add `Authorization: Bearer <token>` if a token exists (read from AsyncStorage or context later).
   - Set a timeout (e.g. 15s) using `AbortController`.
3. **Calls `fetch`** with method, headers, body (JSON.stringify if object).
4. **Response middleware:**
   - If `!response.ok`, throw or return a structured error (status, message).
   - Parse `response.json()` and return it.
   - Optionally handle 401 (e.g. clear token and redirect to login) in one place.

Export a function like:

```js
async function request(path, options = {}) {
  const { method = 'GET', body, token, timeout = 15000 } = options;
  const url = `${API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const headers = { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}
```

Then export helpers: `get(path, token?)`, `post(path, body, token?)` that call `request`.

### Step 3: Use the client in API modules

- **Lawyers API** — Create `api/lawyers.js` (or extend a single `api/backend.js`):
  - `getApprovedLawyers()`
  - `getPendingLawyers()`
  - `getRejectedLawyers()`
  - `getStats()`
  - `approveLawyer(id, { fees })`
  - `rejectLawyer(id)`
  Each function calls `client.get(...)` or `client.post(...)` with the right path and options.
- **AI** — In `api/ai.js`, replace the mock with a call to the client (e.g. `client.post('/api/chat', { prompt })`) when the backend has that route.
- **Auth (later)** — When you add login, e.g. `api/auth.js` with `login(email, password)` calling `client.post('/api/auth/login', body)` and storing the token; the client can then accept an optional `token` argument (or read from a small auth store) so request middleware adds the header.

### Step 4: Replace direct `fetch` in the app

- In `LawyersList.js`, replace `fetch('http://localhost:3001/api/approved-lawyers')` with:
  - `import { getApprovedLawyers } from '../api/lawyers';`
  - `const data = await getApprovedLawyers();`
- Any other screen that will call the backend should use the same pattern (api module → client).

### Step 5: Backend URL on physical device

- Start the backend on your machine and note its LAN IP (e.g. `192.168.1.10`).
- Either set that in `api/config.js` for local testing, or put it in `app.config.js` → `extra.apiUrl` and read it in config.
- Ensure the phone/tablet and computer are on the same Wi‑Fi and that the backend allows CORS (already does with `cors()`).

### Step 6 (optional): Server-side middleware on the backend

When you add auth or need logging/rate limiting:

- **Auth middleware** — Express middleware that reads `Authorization` header, verifies JWT, and attaches `req.user`. Use it on routes that require login.
- **Logging** — `morgan` or a simple middleware that logs method, path, and status.
- **Rate limiting** — `express-rate-limit` to avoid abuse.

These are **backend** middleware; the **client middleware** (API client + config) is what “connects” the app to the backend.

---

## 5. Suggested File Layout

```
api/
  config.js       # API_BASE_URL (and optionally token getter)
  client.js       # request(), get(), post() — request/response middleware
  lawyers.js      # getApprovedLawyers(), approveLawyer(id, body), …
  ai.js           # sendPrompt() — use client.post() when backend is ready
  auth.js         # (later) login(), logout(), getToken()
```

Screens import from `api/lawyers`, `api/ai`, etc., and never use raw `fetch` to the backend.

---

## 6. Checklist

- [ ] Add `api/config.js` with `API_BASE_URL` (and optional env/app.config reading).
- [ ] Add `api/client.js` with timeout, JSON headers, optional auth header, and error handling.
- [ ] Add `api/lawyers.js` with functions for all current backend lawyer routes.
- [ ] Replace `fetch` in `LawyersList.js` with `getApprovedLawyers()` from `api/lawyers`.
- [ ] (Optional) Use `app.config.js` + `expo-constants` for API URL in production.
- [ ] Test on simulator (localhost) and on device (LAN IP or production URL).
- [ ] When backend adds auth, add token to client (e.g. from AsyncStorage) and optional backend auth middleware.

This gives you a single middleware-style layer to connect the app to the backend and keeps URLs, headers, and errors in one place.
