import { LyricLine } from '../types';

export function parseLyrics(content: string): LyricLine[] {
  const lines = content.split('\n');
  const lyrics: LyricLine[] = [];

  // [start-end] Text | Freq
  // OR [time] Text
  const regex = /\[(\d+\.?\d*)-?(\d+\.?\d*)?\]\s*(.*?)(?:\s*\|\s*(\d+))?$/;

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const start = parseFloat(match[1]);
      let end = match[2] ? parseFloat(match[2]) : start + 3; // Default 3s if not specified
      const text = match[3].trim();
      const freq = match[4] ? parseInt(match[4]) : undefined;

      lyrics.push({
        startTime: start,
        endTime: end,
        text,
        targetFrequency: freq,
      });
    }
  }

  // Sort by start time just in case
  return lyrics.sort((a, b) => a.startTime - b.startTime);
}
