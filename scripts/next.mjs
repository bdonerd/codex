// Runs the Next.js CLI with its usage reporting switched off.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

process.env.NEXT_TELEMETRY_DISABLED = '1';
const bin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
