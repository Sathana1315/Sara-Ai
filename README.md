# SARA — Smart Adaptive Recommendation Assistant

SARA (Synthetically Adaptive Recommendation Assistant) is an AI-powered browser assistant and recommendation engine that observes real-time user browsing signals (dwell time, scroll depth, topic engagement) on supported platforms (YouTube MVP) and delivers dynamic, personalized recommendations via a sleek floating UI and analytics dashboard.

---

## 🌟 Key Features

1. **Real-time Browsing Signal Collection**
   - Non-intrusive event ingestion (dwell time, scroll percentage, interaction events).
   - Dynamic interest decay and real-time interest cloud computation.

2. **Adaptive Recommendation Engine v2**
   - Multi-pass candidate generation & scoring algorithm.
   - Enforces configurable topic diversity caps (`maxTopicShare`) without soft-pass fallback violations.
   - Dynamic recency, dwell time, and explicit feedback weighting.

3. **Chrome Extension Floating UI**
   - Seamless Chrome MV3 extension with single-flight OAuth integration.
   - Direct session synchronization with backend & dashboard.
   - Tri-state authentication model ensuring immediate status awareness.

4. **Analytics Dashboard**
   - Real-time Interest Cloud visualization.
   - Interactive recommendation feed with immediate feedback controls (like, dislike, dismiss).
   - Learning history & behavior stream monitoring.

---

## 🏗️ Architecture & Monorepo Structure

```
.
├── apps/
│   ├── backend/               # Node.js / Express REST API (Supabase Auth, event ingestion, recommendation APIs)
│   ├── dashboard/             # React + Vite analytics dashboard & user portal
│   └── extension/             # Chrome Extension (MV3) with floating overlay UI
├── packages/
│   ├── recommendation-engine/ # Core scoring, interest profile calculation, diversity filtering
│   ├── shared/                # Common TypeScript interfaces, schemas, and types
│   └── site-adapters/         # Web page extractors (YouTube DOM parser & interaction tracker)
├── scripts/                   # System validation & setup scripts
└── database/                  # Supabase SQL migrations & RLS policy definitions
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ 
- **npm**: v9+
- **Supabase Account & Google Cloud OAuth Credentials**

### 2. Environment Setup
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Fill in your Supabase URL, publishable key, service role key (backend only), and Google OAuth client ID.

### 3. Installation & Build
```bash
# Install dependencies across all monorepo workspaces
npm install

# Run type check across workspaces
npm run typecheck

# Build all packages and applications
npm run build
```

### 4. Running Locally
```bash
# Start backend API (http://localhost:3001) and Dashboard (http://localhost:3000)
npm run dev
```

### 5. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked**.
4. Select the directory: `apps/extension/dist`.

---

## 🧪 Testing & Verification

Run the full automated unit & integration test suite (40 passing tests across workspaces):
```bash
npm run test
```

---

## 🔒 Security & Privacy

- All database operations are strictly protected by **Supabase Row Level Security (RLS)**.
- OAuth tokens are safely managed via Chrome `identity.launchWebAuthFlow` and never exposed to standard web contents.
- Environment secrets are strictly kept in `.env` (git-ignored) and `.env.example` contains only template placeholders.

---

## 📜 License

MIT License. Built for the Hackathon 2026.
