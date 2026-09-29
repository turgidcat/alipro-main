import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(here, '..');
const frontendDir = path.resolve(mobileDir, '..', 'web');
const webDir = path.join(mobileDir, 'www');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Android should use the project's Node API on the Alibaba Cloud server. A LAN URL can still be
// supplied through ALIPRO_MOBILE_API_BASE for local device debugging.
const apiBase = String(process.env.ALIPRO_MOBILE_API_BASE || 'https://turgidcat.space/projects/alipro/api').trim();
const env = {
  ...process.env,
  VITE_BASE_PATH: '/',
  ...(apiBase ? { VITE_API_BASE: apiBase } : {})
};

const result = spawnSync(npmCmd, ['run', 'build'], {
  cwd: frontendDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

fs.rmSync(webDir, { recursive: true, force: true });
fs.cpSync(path.join(frontendDir, 'dist'), webDir, { recursive: true });
console.log(`[android] frontend copied to ${webDir}`);
console.log(`[android] API base: ${apiBase || 'relative /api (same-origin)'}`);
