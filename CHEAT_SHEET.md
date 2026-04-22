# 🎤 ProKaraoke Studio - Developer Cheat Sheet

## 🚀 1. Running the App (Starting the Server)

**Option A: The Standard Web Version (Highly Recommended for Speed)**
*Use this heavily during development. It runs in Chrome/Edge and is much faster.*
```bash
npm run dev
```

👉 *Then open your browser to `http://localhost:3000`*
(Or use your specific views like `http://localhost:3000/?view=visuals` or `http://localhost:3000/?view=singer`)

**Option B: The Native Desktop Window**
*Use this when checking how it feels as a final "Studio" application.*
```bash
npm run electron:dev
```

**Option C: Google Drive (Cloud Library)**
*Use this to pick your personal videos and lyrics directly from your Drive.*
1. Go to the **Drive** tab in the Operator Desk.
2. Click **Connect Drive** and sign in.
3. Pick a **Text file** for lyrics or a **Video file** for the music.

---

## ☁️ 2. The Foolproof "AI + VS Code Workflow"

Whenever you make changes in VS Code, and I make changes in AI Studio, always run this exact sequence in your VS Code terminal to sync us perfectly:

**Step 1: Save YOUR work locally**
Always do this first to protect the changes you made on your computer.
```bash
git add .
git commit -m "saving my local changes"
```

**Step 2: Download MY work (from AI Studio)**
Fetch the code I wrote for you down to your computer.
```bash
git pull
```
*(Note: If VS Code shows you "Merge Conflicts" here, click the buttons to pick the code you want to keep, and save the files).*

**Step 3: Finish the Merge**
If you had to click those Merge Conflict buttons in Step 2, you tell Git you are done by running an update commit:
```bash
git add .
git commit -m "merged AI changes"
```

**Step 4: Upload the final combined version to the cloud**
Push the beautifully combined code up to GitHub so AI Studio has the latest version too.
```bash
git push
```

💡 **One extra command to remember:**
If you ever feel lost or aren't sure what Git is doing, just type:
```bash
git status
```
It will always tell you exactly what is going on (e.g., “You have uncommitted changes” or “You need to git pull”).

**If the "Bouncer" blocks you (GitHub Push Protection Error):**
1. Check `.env.example` - Ensure NO keys are there.
2. In terminal, run: `git commit --amend --no-edit`
3. Then force push: `git push -f`

---

## 🤖 3. Using Gemini Agentic AI in VS Code (Cline/Roo)

If you install **Cline** into VS Code:
1. Don't use `git pull` or `git push` while working with the agent. Let it edit files directly on your C: Drive.
2. If it asks "Can I run this command?", usually click **Allow**. 
3. The AI lives by the rules in `AGENTS.md`. If you want the AI to change its behavior, edit `AGENTS.md` and tell it to re-read it.

---

## 🎨 4. Tailwind Styling Quick Reference (Karaoke Theme)
*   **Background:** `bg-brand-dark` (The deeply dark studio color)
*   **Gold Accents:** `text-brand-gold` (Use for scores and active lines)
*   **Titles:** `font-display`
*   **Timer/Stats:** `font-mono`

*(Pro tip: Use `motion/react` instead of standard CSS transitions for the buttery smooth Karaoke lyrics slide).*

---

## 🔑 5. API Key Configuration (For YouTube & Search)

If you see **"500 Internal Server Error"** or **"API key is missing"**, you need to set up your `.env` file:

1. Create a file named `.env` in the root folder (same place as `package.json`).
2. Copy the contents of `.env.example` into it.
3. Replace the empty values with your actual keys:

```env
# Get from Google Cloud Console (APIs & Services > Credentials)
GOOGLE_CLIENT_ID=your_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_secret_here

# Get from Google Cloud Cloud Console (YouTube Data API v3)
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

*Note: Frontend keys MUST start with `VITE_` to work in your browser!*
