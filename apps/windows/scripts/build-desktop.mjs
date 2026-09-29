import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(here, '..', '..', 'web');
const env = {
  ...process.env,
  VITE_BASE_PATH: '/',
  VITE_API_BASE: 'https://turgidcat.space/projects/alipro/api'
};
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCmd, ['run', 'build'], {
  cwd: frontendDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

// electron-builder 只打包 apps/windows，将共用界面的构建结果复制到自身 dist。
const desktopDistDir = path.resolve(here, '..', 'dist');
fs.rmSync(desktopDistDir, { recursive: true, force: true });
fs.cpSync(path.join(frontendDir, 'dist'), desktopDistDir, { recursive: true });
console.log(`[desktop] frontend copied to ${desktopDistDir}`);
