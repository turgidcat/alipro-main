import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(here, '..', '..', 'frontend-react');
const env = {
  ...process.env,
  VITE_BASE_PATH: '/',
  VITE_API_BASE: 'http://127.0.0.1:3000/api'
};
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCmd, ['run', 'build'], {
  cwd: frontendDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

// electron-builder 只会打包 desktop-ide 自身目录，因此把 React 构建产物
// 同步到 desktop-ide/dist，开发目录仍然继续使用 frontend-react/dist。
const desktopDistDir = path.resolve(here, '..', 'dist');
fs.rmSync(desktopDistDir, { recursive: true, force: true });
fs.cpSync(path.join(frontendDir, 'dist'), desktopDistDir, { recursive: true });
console.log(`[desktop] frontend copied to ${desktopDistDir}`);

// 只把运行后端所需的内容放进安装包，排除本地校准结果、日志和当前平台的
// Python 虚拟环境，避免把开发机上的近 GB 临时文件带入体验版。
const backendSourceDir = path.resolve(here, '..', '..', 'backend');
const backendRuntimeDir = path.resolve(here, '..', 'backend-runtime');
const excludedRoots = new Set(['harness-results', 'logs', 'tts-venv']);
fs.rmSync(backendRuntimeDir, { recursive: true, force: true });
fs.cpSync(backendSourceDir, backendRuntimeDir, {
  recursive: true,
  filter(source) {
    const relative = path.relative(backendSourceDir, source);
    if (!relative) return true;
    const normalized = relative.split(path.sep).join('/');
    const firstSegment = normalized.split('/')[0];
    if (excludedRoots.has(firstSegment)) return false;
    if (/^database\/.*\.backup-/.test(normalized)) return false;
    if (normalized === 'data/database.sqlite' || normalized.endsWith('.log')) return false;
    return true;
  }
});
console.log(`[desktop] backend runtime staged at ${backendRuntimeDir}`);
