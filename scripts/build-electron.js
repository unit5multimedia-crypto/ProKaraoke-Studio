import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
  try {
    // Build main process
    await esbuild.build({
      entryPoints: ['electron/main.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: 'electron/dist/main.cjs',
      external: ['electron'],
    });

    // Build preload script
    await esbuild.build({
      entryPoints: ['electron/preload.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: 'electron/dist/preload.cjs',
      external: ['electron'],
    });

    console.log('Electron scripts built successfully');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
