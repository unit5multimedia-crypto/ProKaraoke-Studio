# AI Agent Instruction: ProKaraoke Studio

You are an expert full-stack engineer assistings in the development of ProKaraoke Studio. 
Follow these architectural guidelines to ensure consistency with the Lead Engineer's vision.

## 1. UI/UX Principles
- **Aesthetic:** High-contrast, dark-mode, "Studio" feel. Use `bg-brand-dark` (#09090b) and `text-brand-gold` (#FFD700).
- **Typography:** Titles use `font-display` (Outfit/Space Grotesk). Data/Stats use `font-mono`.
- **Motion:** All transitions should use `motion` from `motion/react`. Prefer scale and blur entries for stage elements.

## 2. Media Engine: The "Headless" YouTube Player
- **Constraints:** Never show native YouTube controls or widgets.
- **Implementation:** 
  - Use `enablejsapi: 1` and `controls: 0` in `playerVars`.
  - Maintain the `Interaction Shield` (transparent div) over the iframe to prevent clicking through to YouTube.
  - Always implement the "Autoplay Rescue" overlay for browsers that block auto-start.
- **Sync:** The player state must be synchronized via the `onStateChange` event to the component's `isPlaying` state.

## 3. Real-Time Pitch Analysis
- **Engine:** Autocorrelation-based pitch detection in `src/hooks/usePitchDetection.ts`.
- **Scoring:** Scoring happens in `KaraokeStage.tsx`. Updates should be smooth; use `lerp` or `motion` for the accuracy bar.

## 4. Multi-View Synchronization
- **Transport:** Uses the `BroadcastChannel` API with the name `karaoke-sync`.
- **Messages:**
  - `SETTINGS_SYNC`: Updates visual preferences.
  - `COMMAND`: Control signals (`PLAY`, `PAUSE`, `LOAD`).
  - `MEDIA_SYNC`: Syncs media URLs or base64 data between tabs.

## 6. Stage Visual View (The Concert)
- **Engine:** Use a WebGL `<canvas>` for rendering GLSL Shaders (Shadertoy style).
- **Audio Reactivity:** Pass `fftData` from the `AudioContext` as a uniform `u_audio` (float array) to the shader.
- **Goal:** Immersive, abstract visuals that react to frequency bands (Bass, Mid, High).

## 7. Prompter View (Singer Mode)
- **Aesthetic:** Minimalist. No scores, no distractions.
- **Customization:** Support `prompterBgColor` (e.g., #00ff00 for Green Screen background).
- **Lyrics:** Massive font size for far-distance reading on stage monitors.

## 8. Lyric Maker Architecture
- **State:** Use a `buffer` to store raw text and timestamps.
- **Workflow:** User "Taps" a key while the song plays to mark the start/end of each line.
- **Export:** Output should be a valid `LyricLine[]` array.

---

## 🚀 TARGET DEADLINE: "THE SUNDAY EVENT" MILESTONE

We have a strict deadline for an upcoming Sunday event. All AI Agents (Cursor, Cline, Copilot, AI Studio) reading this file **MUST PRIORITIZE STABILITY** and strictly build features in the following priority order. Do not attempt "Priority 1" (Video Output) before Sunday, as complex native dependencies breaking could ruin the event. 

**Focus exclusively on the "Fun Factor" (Priorities 3, 6, and 4) to ensure the Sunday Gathering has a fully playable, classic Videoke experience.**

### 🏆 IMMEDIATE PRIORITY A: The Score System (Ref: Roadmap Priority 3)
*   **Goal:** Provide the classic "Videoke End-of-Song Scoring" experience.
*   **Requirements:** At the end of a track, calculate a total score (0-100%). Display it using giant, animated typography (Tailwind + Motion). 
*   **Audio Feedback:** Implement simple browser-based text-to-speech (TTS) to announce the score ("Excellent! 95!"), or use the Web Audio `OscillatorNode` for classic arcade win sounds. 

### 🎤 IMMEDIATE PRIORITY B: Videoke Voice FX (Ref: Roadmap Priority 6)
*   **Goal:** Make the singers sound like they are in a real studio/hall.
*   **Requirements:** Connect the microphone feed (`getUserMedia`) through the Web Audio API. 
*   **Nodes required:** `GainNode` (for volume/monitoring), `ConvolverNode` (for Reverb/Hall effect), and `DelayNode` (for Echo). Provide a simple slider in the Operator Panel to adjust Reverb intensity.

### 📝 IMMEDIATE PRIORITY C: Lyric Maker Tool (Ref: Roadmap Priority 4)
*   **Goal:** Allow the operator to rapidly prepare specific songs for the Sunday setlist.
*   **Requirements:** Enhance the existing Lyric parser. Include a "Tap-to-sync" UI where the operator can press the Spacebar while a YouTube video plays to map timestamps automatically.

### ⚠️ POST-SUNDAY FEATURE BACKLOG (Do NOT build before Sunday)
1. **Virtual Camera / NDI Support** (Too risky for native Electron before the event).
2. **Full Shadertoy Advanced Editor** (Too UI-heavy, stick to current visual canvas).
3. **Complex User Accounts / Saved Highscores using Databases** (Keep it local and offline-first for now to prevent network issues during the event).
