# SARA AI — Agent Onboarding & Setup Guide

This document is designed for AI coding agents and developers to quickly understand, configure, run, and verify the **SARA (Synthetically Adaptive Recommendation Assistant)** project on a new laptop or fresh environment.

---

## 1. Executive Overview

**SARA** is an AI-powered browser companion and adaptive recommendation engine. It observes real-time user browsing behavior (dwell time, scroll depth, YouTube video watching) via a Chrome Extension (MV3), processes signals using an adaptive candidate scoring engine (v2 diversity cap algorithm), and presents personalized content recommendations through a floating extension UI and a React analytics dashboard.

---

## 2. Monorepo Architecture

```
.
├── apps/
│   ├── backend/               # Node.js / Express API (Port 3001)
│   │                          # Handlers for /events/ingest, /recommendations, /feedback, /user/*
│   ├── dashboard/             # React + Vite + Tailwind Dashboard (Port 3000)
│   │                          # Interest cloud, behavior stream, KPI metrics
│   └── extension/             # Chrome Extension MV3 (manifest.json v3)
│                              # Background SW, content script, floating React overlay
├── packages/
│   ├── recommendation-engine/ # Multi-pass candidate generator, scorer, interest decay, diversity caps
│   ├── shared/                # Common TypeScript types, interfaces, EventType enums
│   └── site-adapters/         # DOM extractors (YouTubeAdapter for video titles, channels, search)
├── database/ / supabase/
│   └── migrations/            # Supabase SQL schema migrations (users, behavior_events, user_interests, etc.)
├── docs/                      # Demonstration & testing guides
└── .env.example               # Environment variables template
```

---

## 3. Prerequisites

Before setting up SARA on a new machine, ensure the following are installed:

- **Node.js**: `v18.0.0` or higher (recommended: `v20.x`)
- **npm**: `v9.0.0` or higher
- **Git**: `v2.x`
- **Google Chrome**: Latest version (for running the unpacked extension)
- **Supabase Account**: A Supabase project with database & auth configured.

---

## 4. Environment Configuration

1. Copy `.env.example` to `.env` in the project root directory:
   ```powershell
   cp .env.example .env
   ```

2. Fill in the required environment variables in `.env`:
   ```env
   # Backend
   PORT=3001
   NODE_ENV=development

   # Supabase Configuration
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

   # Dashboard Vite Environment Variables
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
   VITE_BACKEND_URL=http://localhost:3001

   # Google OAuth Client ID
   GOOGLE_OAUTH_CLIENT_ID=<your-google-oauth-client-id>
   ```

> ⚠️ **CRITICAL SECURITY NOTE**: Never commit `.env` to Git. `.gitignore` is configured to strictly exclude `.env` and `.env.*` files.

---

## 5. Step-by-Step Installation & Build

Run the following commands in the project root directory (`d:\Projects\Hackathon`):

### Step 1: Install Dependencies
```powershell
npm install
```

### Step 2: Run TypeScript Typecheck
```powershell
npm run typecheck
```
*Expected Result*: 0 errors across all 6 workspaces.

### Step 3: Build Monorepo Workspaces
```powershell
npm run build
```
*Expected Result*: Builds all packages and outputs extension bundles to `apps/extension/dist/`.

### Step 4: Run Test Suite
```powershell
npm run test
```
*Expected Result*: **40/40 tests passing** (`recommendation-engine`, `site-adapters`, `backend`, `dashboard`, `extension`).

---

## 6. Database Setup (Supabase SQL Migrations)

Apply the SQL migration scripts located in `supabase/migrations/` in sequential order via the Supabase SQL Editor:

1. `supabase/migrations/20260919000000_init_sara_schema.sql` (Creates `users`, `sessions`, `content_items`, `behavior_events`, `user_interests`, `learning_history`, `recommendations`, `feedback` tables).
2. `supabase/migrations/20260919000001_auth_rls_policies.sql` (Enables Row Level Security and user policies).
3. `supabase/migrations/20260919000002_service_role_policies.sql` (Grants service role bypass for background processing).

---

## 7. Running the Applications Locally

Start the backend server and frontend dashboard simultaneously:

```powershell
npm run dev
```

This starts:
- **Backend API**: `http://localhost:3001`
- **Dashboard**: `http://localhost:3000`

---

## 8. Loading & Authenticating the Chrome Extension

1. Open **Google Chrome** and navigate to `chrome://extensions`.
2. Toggle **Developer mode** ON (top right corner).
3. Click **Load unpacked**.
4. Select the directory: `apps/extension/dist` (ensure `npm run build` was run first).
5. Open `http://localhost:3000` and sign in with Google.
6. Open YouTube (`https://www.youtube.com/watch?v=...`) in Chrome.
7. Click the purple floating SARA icon in the bottom right corner to verify authenticated status and view real-time recommendations.

---

## 9. Verification & Pipeline Sanity Check

To verify the end-to-end pipeline on a fresh setup:

1. Open YouTube and watch a video for 10+ seconds.
2. Open Chrome DevTools (`F12`) on YouTube → **Console**.
3. Look for: `[SARA YouTube] Page navigation detected` and `[SARA YouTube] Sending behavior signal`.
4. Open Network tab and verify `POST http://localhost:3001/api/events/ingest` returns **`200 OK`**.
5. Switch to `http://localhost:3000` (Dashboard) and click **Refresh Now**.
6. Verify **Behavior Signals Observed** is `> 0` and dynamic topics appear in the **Interest Cloud**.

---

## 10. Agent Execution Guidelines

When operating on this codebase:
- **Do NOT break TypeScript strictness**: Always run `npm run typecheck` after modifications.
- **Do NOT modify OAuth architecture**: Authentication relies on Supabase Auth + Chrome `identity.launchWebAuthFlow`.
- **Do NOT remove diversity cap invariants**: Recommendation engine v2 enforces strict `maxTopicShare` limits without soft-pass fallback violations.
- **Always verify changes**: Run `npm run test` before declaring completing work.
