# SARA — Hackathon Demonstration Guide & Procedure

This guide provides a 5–10 minute, end-to-end procedure for demonstrating SARA live during hackathon judging.

---

## 1. Prerequisites

- Node.js 18+ and npm installed
- Google Chrome browser
- Connected Supabase project (`xloherpfgrrkgegdxipx`)
- Configured `.env` file at project root

---

## 2. Startup Commands

Open two terminal windows at the project root (`D:\Projects\Hackathon`):

**Terminal 1 — Backend Service (Port 3001):**
```bash
npm run dev --workspace=@sara/backend
```
*Verify output:* `SARA Backend API running on http://localhost:3001`

**Terminal 2 — Dashboard App (Port 3000):**
```bash
npm run dev --workspace=@sara/dashboard
```
*Verify output:* `VITE v5.4.21 ready in ... http://localhost:3000/`

**Verify Health Endpoint:**
Open `http://localhost:3001/health` in your browser.
Expected response:
```json
{
  "status": "healthy",
  "service": "SARA Backend API",
  "database": "healthy",
  "authConfigured": true
}
```

---

## 3. Load Chrome Extension

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in upper right).
3. Click **Load unpacked**.
4. Select the directory: `D:\Projects\Hackathon\apps\extension\dist`.
5. Confirm the SARA extension icon appears in the toolbar.

---

## 4. Reset & Initial Authentication (Clean State)

1. Run the reset utility to ensure a fresh demo state:
   ```bash
   npm run demo:reset
   ```
2. Open `http://localhost:3000` in Chrome.
3. Click **Continue with Google** to sign in.
4. Verify initial state:
   - **Behavior Signals Captured:** 0
   - **Learned Interests:** 0
   - **Recommendations:** 0
   - Interest Cloud displays: *"Keep exploring — SARA needs more signals..."*

---

## 5. Live Demonstration Procedure (5–10 Minutes)

### Step A: Video Behavior Signal Capture (YouTube)
1. Navigate to [YouTube](https://www.youtube.com).
2. Search for: `Game Development Architecture`.
3. Open a video (e.g., *Unity Game Architecture Tutorial*).
4. Watch for 15+ seconds, scroll down to comments, or pause/play.
5. Notice the SARA floating assistant icon in the bottom-right corner.
6. Click the floating icon:
   - Displays *"Learning your interests..."* while processing signals.

### Step B: Verify Dashboard Profile Learning
1. Return to the SARA Dashboard tab (`http://localhost:3000`).
2. Click **Refresh** or wait for the 30-second auto-refresh.
3. Observe live profile evolution:
   - **Behavior Signals Captured:** Increases (e.g., 2 signals)
   - **Learned Interests:** `game development`, `unity` appear with weight bars
   - **Learning History:** Log entry showing explanation: *"Observed VIDEO_VIEW on YouTube. Extracted topics: game development, unity (Weight delta: +0.26)"*
   - **Signal Log:** Displays raw event (`youtube.com`, duration, keywords).

### Step C: Cross-Site Profile Aggregation
1. Navigate to a technical content site (e.g., [dev.to](https://dev.to) or [medium.com](https://medium.com)).
2. Open an article related to `Game Development` or `C# Shaders`.
3. Read the article and scroll down 50%+.
4. Return to the SARA Dashboard tab (`http://localhost:3000`).
5. Observe cross-site unified profile updates:
   - The **SAME** interest (`game development`) increases in weight and confidence score.
   - Signal Log displays events from both `youtube.com` and `dev.to` under one unified user identity.

### Step D: Recommendations & Interactive Feedback
1. Switch to the **Recommendations** tab on the dashboard.
2. View scored recommendations generated from real observed pages.
3. Hover over an item to read its explanation:
   - *"Recommended because: You frequently engage with game development content..."*
4. Click 👍 **Like** on a recommendation:
   - Flash notification confirms: *"👍 SARA learned you like this — profile updated!"*
   - Signal weight for `game development` receives a positive multiplier boost.
5. Click 👎 **Dislike** or ⏭️ **Skip** on another recommendation to show deprioritization.

---

## 6. Privacy & Controls Verification

1. Click the **Privacy & Controls** tab on the sidebar.
2. Review collected data summary:
   - ✅ Collected: Page title, URL, duration, scroll depth, topic keywords.
   - 🚫 Not Collected: Passwords, payment info, auth tokens, form inputs, raw HTML.

---

## 7. Troubleshooting & Emergency Steps

- **Dashboard blank or 401 error:** Verify user is signed in. Click "Continue with Google".
- **Backend disconnected:** Check Terminal 1 output. Verify port 3001 is active.
- **Extension not firing:** Click the reload icon on `chrome://extensions` for SARA extension.
- **Stale recommendations:** Click the **Refresh Data** button on the top-right header of the dashboard.
