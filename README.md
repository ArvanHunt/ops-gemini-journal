# Gemini Reflection Journal

A secure, user-authenticated multi-turn reflective journaling and brainstorming web application powered by **Google Gemini 3.6 Flash**, **Firebase Authentication (Google Sign-In)**, and **Google Cloud Firestore**.

---

## Architecture & Security Highlights

1. **User Identity & Passwordless Authentication**: Outsources authentication to Firebase Auth (Google Sign-In), eliminating local credential storage and preventing password-related vulnerabilities.
2. **User-Isolated Cloud Firestore**: All reflections, chat turns, summaries, and tags are partitioned under `/users/{userId}/entries/{entryId}`, secured by Firestore security rules that strictly check `request.auth.uid == userId`.
3. **Resilient Gemini 3.6 Flash Fallback Matrix**: Server-side proxy with an automated model fallback ladder:
   - Primary: `gemini-3.6-flash`
   - High-Availability Fallback: `gemini-3.1-flash-lite`
   - Dynamic Alias: `gemini-flash-latest`
   - Deep Reasoning Fallback: `gemini-3.7-flash`
4. **Zero-Hardcoding Hygiene**: Backend proxy keeps all Gemini API keys strictly confidential using environment variables and Google Cloud Secret Manager.

---

## 1. Prerequisites & GCP Services Setup

Ensure you have the [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) installed and authenticated:

```bash
# Login to GCP
gcloud auth login

# Set your target project ID
gcloud config set project YOUR_PROJECT_ID

# Enable the required APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

---

## 2. Cloud Firestore Security Rules

Deploy the following security rules to protect user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 3. Secret Management Setup

Create the `GEMINI_API_KEY` secret in Secret Manager and grant Cloud Run runtime service account access:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Retrieve your Google Cloud project number
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

# 3. Grant the default compute service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Local Development

```bash
# Install dependencies
npm install

# Start development server with live Vite + Express
npm run dev
```

Visit `http://localhost:3000` to interact with the application.

---

## 5. Build & Cloud Run Deployment

```bash
# 1. Build the production client and backend bundle
npm run build

# 2. Deploy directly to Google Cloud Run with Secret Manager binding
gcloud run deploy gemini-reflection-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars NODE_ENV=production

# 3. Apply the mandatory verification challenge label
gcloud run services update gemini-reflection-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## Step-by-Step Functional Walkthrough & Verification

Use the following step-by-step test matrix to verify all user interactions and workflows:

### Scenario 1: Authentication & Landing View
1. Open the application landing page.
2. Confirm the landing screen renders the hero greeting, features overview, and "Sign In with Google" button without exposing private dashboards.
3. Click "Sign In with Google". Complete the authentication popup.
4. Verify the user is redirected to their private dashboard, displaying their profile name and avatar in the header.

### Scenario 2: Creating a Reflection & Real-Time Sync
1. In the dashboard, click **"New Reflection"** or select a writing prompt starter.
2. Change the reflection title to `"Navigating Career Milestones"` and select the **"Brainstorm & Ideas"** mode.
3. Enter freeform thoughts in the journal textarea.
4. Verify the top status badge updates to **"Saving to Firestore..."** and confirms **"Saved to Firestore"**.

### Scenario 3: Multi-Turn Gemini Conversation
1. In the active reflection thread, type: *"What are 3 distinct strategies I can use to balance short-term deliverables with long-term vision?"* and click **Send**.
2. Verify the typing indicator animates while Gemini reflects.
3. Verify Gemini returns a nuanced multi-paragraph response with actionable bullet points.
4. Ask a follow-up: *"How can I communicate this to my team without overwhelming them?"*
5. Verify Gemini continues the conversation with contextual continuity.

### Scenario 4: Synthesis & Auto-Summarization
1. Click **"Synthesize Key Insights"**.
2. Verify Gemini returns the structured **SummaryCard** containing a concise title, emotional sentiment tone chip, key bullet point insights, actionable steps, and suggested follow-up prompts.
3. Click the **"Copy"** button on the summary card to verify clipboard copying.
4. Click on one of the suggested follow-up prompts and confirm it automatically initiates the next conversation turn.

### Scenario 5: Data Isolation & History Management
1. Add tags like `#career` and `#strategy` to the entry.
2. Toggle the **Pin** button to pin the reflection to the top of the sidebar.
3. Create a second entry titled `"Gratitude for Mentors"` using the *Gratitude & Joy* mood.
4. In the history sidebar, observe the entry count badges on each mood filter tag (e.g. *Reflection (1)*, *Gratitude (1)*, *Brainstorm (0)*).
5. Click **"Gratitude"** — confirm only the gratitude reflection is displayed.
6. Click **"Reflection"** in addition to Gratitude to test multi-select filtering — verify both reflections are shown and the active filter badge updates (e.g., *"2 of 2"*).
7. Click **"Clear filters"** or **"Reset all filters"** to restore the full reflection list.
8. Use the search bar in the sidebar to search for `"career"` — confirm only the matching entry is filtered.
9. Switch between entries and verify full state restoration.
10. Click **"Export as Markdown"** and verify download of the complete session transcript.
11. Sign out, and confirm the dashboard clears and returns securely to the landing screen.

### Scenario 6: Cross-Entry Pattern Analysis & Trend Detection
1. Create at least 3 distinct reflections (e.g., about career decisions, morning routines, and creative projects).
2. Click the **"Detect Patterns"** button in the top navigation bar or sidebar.
3. Observe the pattern analysis modal synthesize trends across the historical timeline.
4. Verify the analysis card displays a dominant headline, a multi-sentence synthesis summary, dominant emotional tones, recurring themes with entry counts and contextual evidence, and growth highlights.
5. Click on an expandable theme card to inspect the contextual evidence.
6. Click one of the suggested exploration prompts to automatically create a new reflection focused on that pattern.
7. If fewer than 3 entries exist, verify the friendly prompt: *"Write a few more reflections to unlock pattern detection"*.

### Scenario 7: Client-Side PDF Export & Digest Generation
1. Open any active reflection containing journal text, dialogue with Gemini, and synthesized key insights.
2. Click the **"Export PDF"** button in the top reflection toolbar.
3. Open the downloaded PDF and verify the formatting:
   - Header with title, date, mood badge, and tags.
   - Distinct styled block for the initial reflection text.
   - Alternating conversational bubbles for user vs. Gemini AI messages.
   - Styled section for synthesized insights, emotional tone, key takeaways, and action steps.
   - Clean page numbering and running headers.
4. In the Reflection History sidebar, filter entries (e.g. by mood or search query).
5. Click **"Export Filtered PDF"** or **"Export All to PDF"** in the sidebar footer.
6. Confirm the multi-entry PDF digest downloads cleanly with all selected reflections separated by page breaks.

### Scenario 8: Future Self Reflection Mode
1. Create a new reflection and select the **"Future Self"** mode (`Hourglass` icon).
2. Note the custom writing starters tailored for future perspective (e.g., *"If you could see me right now, what perspective would you give me on..."*).
3. Write a reflection discussing a current challenge, decision, or anxiety.
4. Send a message to Gemini.
5. Verify that Gemini responds in the first person as the user's Future Self:
   - Tone is warm, wise, compassionate, and grounded.
   - Draws natural connections to past themes, patterns, and struggles from the user's historical entries.
   - Validates present feelings while providing reassuring, long-term wisdom.
6. Check that the entry saves with the `future_self` mode and is properly counted and filterable in the Reflection History sidebar.

