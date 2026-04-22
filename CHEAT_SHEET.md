# 🎤 ProKaraoke Studio - Developer Cheat Sheet

## 🚀 1. Running the App (Starting the Server)

**Option A: The Standard Web Version (Highly Recommended for Speed)**
*Use this heavily during development. It runs in Chrome/Edge and is much faster.*
```bash
npm run dev
```http://localhost:3000/?view=visuals
👉 *Then open your browser to `http://localhost:3000`*

**Option B: The Native Desktop Window**
*Use this when checking how it feels as a final "Studio" application.*
```bash
npm run electron:dev
```

---

## ☁️ 2. The AI Studio Sync (Git Cheat Sheet)

**When AI Studio builds something new:**
1. AI Studio automatically hits "Stage and Commit" (which does a `git push`).
2. You run this in your VS Code terminal to get my work:
```bash
git pull
```

**When YOU change something locally and want AI Studio to see it:**
Run these three commands in your VS Code terminal:
```bash
git add .
git commit -m "my update message"
git push
```

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
