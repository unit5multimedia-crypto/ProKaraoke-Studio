# ProKaraoke Studio 🎤🎸

A local-first, zero-cost professional karaoke experience with real-time pitch scoring, custom video bumpers, and dynamic background engines.

## 🚀 Quick Start (Local Development)

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Set up Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_CLIENT_ID=your_google_id
   GOOGLE_CLIENT_SECRET=your_google_secret
   ```

3. **Start the Studio:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌟 Key Features

- **Headless Media Stage:** Seamless YouTube integration with all native widgets hidden for a true videoke feel.
- **Vocal Engine:** Real-time pitch analysis and scoring with visual feedback labels.
- **Dynamic Bumpers:** Custom video intros that play while the main track loads.
- **Dual-View Sync:** Open a "Singer View" on a second monitor while controlling everything from the "Operator Console."
- **AI-Powered Search:** Natural language searching that finds perfect karaoke versions on YouTube.

## 🛠 Tech Stack

- **React 18 + Vite**
- **Express.js** (Custom Hybrid Server)
- **Tailwind CSS + Motion**
- **Google Gemini API** (Search & Logic)
- **Web Audio API** (Pitch Detection)

## 🤖 Development with AI Agents

This project is designed to work with **GitHub Copilot** or other AI agents. See [AGENTS.md](./AGENTS.md) for specialized instructions and architectural patterns.
