let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedContext = new AudioContextClass();
  }
  return sharedContext;
}

export async function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}
