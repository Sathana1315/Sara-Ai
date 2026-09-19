# SARA — Final Hackathon Judge Demo Script & Validation Guide

---

## 1. 30-Second Elevator Pitch

> *"SARA (Smart Adaptive Recommendation Assistant) is a real-time, privacy-first AI companion that observes your browsing behavior across disjointed websites—like YouTube, Dev.to, and Medium—without needing site-specific algorithms. SARA extracts context signals directly from your active browser session, updates a unified cross-site interest profile, and delivers instant, explainable recommendations and analytics back to your dashboard with explicit user feedback control."*

---

## 2. 2-Minute Executive Demo

1. **Clean Start:** Run `npm run demo:reset` -> Open `http://localhost:3000` -> Click **Continue with Google** to sign in.
2. **Browse YouTube:** Search `Game Development Architecture` -> Open a video -> Watch for 15s. SARA floating icon indicates signal capture.
3. **Verify Dashboard Profile:** Return to `http://localhost:3000` -> Show **Behavior Signals** increased, **Interest Cloud** renders `game development` weight bar, **Learning History** logs explicit score delta (+0.26).
4. **Cross-Site Signal:** Open `dev.to` -> Read a `Game Development` article -> Return to dashboard -> Show the **SAME** unified interest (`game development`) strengthened across sites.
5. **Interactive Feedback:** Open **Recommendations** -> Click 👍 **Like** -> Profile instantly updates.

---

## 3. 5-Minute Complete Hackathon Judge Walkthrough

| Step | Action | Expected Visible Behavior | Database & Technical Evidence |
| :--- | :--- | :--- | :--- |
| **1. Fresh State** | Run `npm run demo:reset` | Console outputs `✅ Cleared`. Dashboard shows 0 signals, 0 interests. | `behavior_events`, `user_interests`, `recommendations` count = 0 |
| **2. Auth Sign-In** | Click "Continue with Google" | Authenticated dashboard opens. Profile header shows user name & avatar. | JWT verified by Supabase Auth; `public.users` profile linked via `auth_user_id` |
| **3. YouTube Learning** | Open YouTube video on "Unity Shaders" | Content script extracts video title, channel, duration. SARA floating icon animates. | `POST /api/events/ingest` inserts row into `public.behavior_events` and auto-provisions `content_items` |
| **4. Profile Evolution** | Switch to Dashboard | **Interest Cloud** displays `unity`, `shaders` with weight bars & hover tooltips. | `public.user_interests` updated (`weight: 0.35`, `confidence: 0.55`, `interaction_count: 1`) |
| **5. Learning History** | Click "Interests & Learning" tab | Activity stream displays explanation: *"Observed VIDEO_VIEW on YouTube. Extracted topics: unity, shaders"* | Row inserted into `public.learning_history` |
| **6. Cross-Site Aggregation** | Open `dev.to` article on "Unity C# Architecture" | Generic content adapter extracts `unity` and `c#` keywords. | Ingests new event under SAME `user_id`, updating existing `unity` topic weight to `0.52` |
| **7. Recommendations** | Click "Recommendations" tab | Scored candidates displayed with match percentage and primary reason explanation. | Candidate items scored by `scoreCandidateItem()`; persisted to `public.recommendations` |
| **8. Interactive Feedback** | Click 👍 **Like** on a recommendation card | Card displays *"👍 SARA learned you like this"*; flash message appears. | `POST /api/feedback` inserts to `public.feedback`, updates status to `liked`, boosts signal weight |
| **9. Privacy Verification** | Click "Privacy & Controls" tab | UI details collected page metadata vs strictly excluded private data. | Verified: No passwords, auth tokens, form inputs, or HTML collected |

---

## 4. Backup Plan & Emergency Procedures

- **If Recommendations Feed shows no candidates:** The empty state displays: *"Keep exploring — SARA needs more signals to personalize your recommendations."* Simply open 1–2 more technical articles/videos to auto-provision candidates into `public.content_items`.
- **If Extension Service Worker goes idle:** Click the SARA floating icon in the bottom-right of any webpage to trigger instant auth status check and queue flush.
- **If Backend server needs restart:**
  ```bash
  npm run dev --workspace=@sara/backend
  ```
  Verify status at `http://localhost:3001/health`.

---

## 5. Developer Reset Procedure

To reset the development user's demo environment back to clean state:
```bash
npm run demo:reset
```
*Note: This strictly targets the local development user's SARA records and requires explicit developer confirmation.*
