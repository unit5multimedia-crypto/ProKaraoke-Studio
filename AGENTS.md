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

## 5. Coding Standards
- **Imports:** Use named imports. Keep styles in Tailwind classes.
- **State:** Prefer `useMemo` for derived layout logic (like character-by-character lyric coloring).
- **Safety:** Wrap all YouTube API calls (`getCurrentTime`, `playVideo`) in `try-catch` blocks and check for existence before calling.
