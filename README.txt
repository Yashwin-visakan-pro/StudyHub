STUDY HUB — VISAKA SOFTWARES
GitHub Pages + Firebase + JARVIS Lite (Groq)

WHAT'S INCLUDED
- Responsive Study Hub interface for desktop and mobile
- Firebase email/password and Google authentication
- Shared weekly timetable read from Firestore: config/timetable, field: sessions
- Per-user activity stored at users/{uid}/activity
- JARVIS Lite chat using Groq API
- Markdown rendering and Mermaid flowcharts
- Firestore security rules

IMPORTANT SECURITY WARNING
This requested GitHub Pages-only Groq setup stores the key in api/index.json. GitHub Pages is public static hosting. Anyone can open that JSON file or inspect browser requests and copy the key. Local Storage is also readable by the browser user. Do not put a valuable/private API key here. A Vercel/Cloudflare backend is the proper way to keep it secret. If you proceed, use a separate key, monitor its usage, and rotate/revoke it if exposed. Do not commit a key you cannot afford to expose.

1) CONFIGURE FIREBASE
- Open Firebase Console > Project settings > General > Your apps.
- Check the Firebase config in app.js. It currently contains the config from the app.js file supplied for this project. Replace it if your Firebase project differs.
- Authentication > Sign-in method: enable Google and Email/Password.
- Authentication > Settings > Authorized domains: add your GitHub Pages hostname (for example, USERNAME.github.io). Also add localhost if testing locally.
- Create Firestore database.
- Firestore > Rules: publish firestore.rules from this package.

2) ADD THE GROQ KEY
- Open api/index.json.
- Replace PASTE_YOUR_GROQ_API_KEY_HERE with your Groq API key.
- Again: this file is public on GitHub Pages. Prefer a backend for real security.

3) CREATE THE SHARED TIMETABLE
In Firestore Data, create:
Collection: config
Document: timetable
Field: sessions (type: array)

Example sessions array:
[
  {
    "id": "mon-maths-01",
    "day": "Monday",
    "start": "18:00",
    "end": "19:00",
    "subject": "Mathematics",
    "topic": "Pair of Linear Equations"
  },
  {
    "id": "mon-science-01",
    "day": "Monday",
    "start": "19:15",
    "end": "20:00",
    "subject": "Science",
    "topic": "Electricity"
  }
]

Use unique IDs. Add more objects for the remaining days. All signed-in users can read this shared timetable. The rules only allow users with a Firebase custom admin claim to edit it from a client. For initial setup, create/edit it manually in Firebase Console.

4) DEPLOY TO GITHUB PAGES
- Put index.html, styles.css, app.js, api/ and firestore.rules in your repository's publishing root.
- If your repository uses a /public publishing folder, move these files into that folder and select that folder in GitHub Pages settings.
- Commit and push. In GitHub: Settings > Pages > choose Deploy from a branch and select the branch/folder containing index.html.
- Open https://USERNAME.github.io/REPOSITORY/ (or your configured custom domain).

5) TEST LOCALLY
Use VS Code Live Server or another local HTTP server. Do not open index.html directly as file:// because Firebase modules and fetch requests need an HTTP origin.

NOTES
- The supplied Firebase web apiKey is a client identifier, not a server secret. Protect your Firestore data with rules and configure authorized domains.
- The Groq key is not secure in this frontend-only architecture.
- Groq usage and limits depend on your Groq account and model availability.
- Firebase Authentication and Firestore have plan-specific quotas and limits.
- This package does not require Firebase Cloud Functions. The old Functions callable has been removed from app.js.
- The timetable is intentionally shared; activity remains private to each signed-in user.


MODEL UPDATE (18 NOV 2026)
The app uses openai/gpt-oss-120b. Groq shut down llama-3.3-70b-versatile on 16 Aug 2026 for free/developer-tier usage. If you already deployed an older version, replace the model field in app.js and redeploy the updated files. See https://console.groq.com/docs/deprecations and https://console.groq.com/docs/models for current model availability.
