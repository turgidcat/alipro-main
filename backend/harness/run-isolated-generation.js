const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { DEFAULT_DATABASE_PATH } = require('../config/runtime');
const { prepareSoakBaseline, resetSoakRange } = require('./prepare-soak-baseline');
const { assertJudgeAcceptanceForPaidRun } = require('./judge-acceptance-policy');
const { DEFAULT_WORD_COUNT, clampWordCount } = require('../services/word-count-policy');

const BACKEND_DIR = path.join(__dirname, '..');

function getArgValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && typeof process.argv[index + 1] === 'string'
    ? process.argv[index + 1]
    : fallback;
}

function parseChapters(value = '') {
  return String(value || '').split(',').map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHealth(baseUrl, serverProcess, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`隔离后端提前退出，退出码 ${serverProcess.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (_) {
      // 服务启动期间连接失败是预期状态。
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('等待隔离后端启动超时');
}

function runVerifier(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['verify-batch-generation.js', ...args], {
      cwd: BACKEND_DIR,
      env,
      stdio: 'inherit'
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`隔离验收失败，退出码 ${code ?? 'null'}${signal ? `，信号 ${signal}` : ''}`));
    });
  });
}

function stopProcess(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill();
  });
}

async function main() {
  const bookId = getArgValue('--book-id', process.env.BATCH_VERIFY_BOOK_ID || '');
  const chapters = getArgValue('--chapters', process.env.BATCH_VERIFY_CHAPTERS || '1,2,3');
  const promptVersion = getArgValue('--prompt-version', process.env.BATCH_VERIFY_PROMPT_VERSION || 'chapter.v2');
  const mode = getArgValue('--mode', process.env.BATCH_VERIFY_MODE || 'generate').trim().toLowerCase();
  const reportPath = getArgValue('--report-path', process.env.BATCH_VERIFY_REPORT_PATH || '');
  const prepareTo = Number(getArgValue('--prepare-to', process.env.BATCH_VERIFY_PREPARE_TO || '0')) || 0;
  const targetWordCount = clampWordCount(
    getArgValue('--target-word-count', process.env.BATCH_VERIFY_TARGET_WORD_COUNT || String(DEFAULT_WORD_COUNT))
  );
  const continueOnFailure = process.argv.includes('--continue-on-failure') || process.env.BATCH_VERIFY_CONTINUE_ON_FAILURE === '1';
  const sourceDatabase = getArgValue('--source-database', process.env.BATCH_VERIFY_SOURCE_DATABASE || DEFAULT_DATABASE_PATH);
  const outputDatabase = getArgValue('--output-database', process.env.BATCH_VERIFY_OUTPUT_DATABASE || '');
  const judgeAcceptanceReport = getArgValue('--judge-acceptance-report', process.env.JUDGE_ACCEPTANCE_REPORT || '');
  const allowPaidLongRun = process.argv.includes('--allow-paid-long-run') || process.env.ALLOW_PAID_LONG_RUN === '1';
  const preserveTargetState = process.argv.includes('--preserve-target-state');
  if (!bookId) {
    throw new Error('请提供 --book-id 或 BATCH_VERIFY_BOOK_ID');
  }
  const parsedChapters = parseChapters(chapters);
  assertJudgeAcceptanceForPaidRun({ chapters: parsedChapters, reportPath: judgeAcceptanceReport, allowPaidLongRun });
  const resolvedSourceDatabase = path.resolve(sourceDatabase);
  if (!fs.existsSync(resolvedSourceDatabase)) {
    throw new Error(`源数据库不存在：${resolvedSourceDatabase}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-harness-'));
  const isolatedDbPath = path.join(tempDir, 'novel.db');
  let serverProcess = null;

  try {
    fs.copyFileSync(resolvedSourceDatabase, isolatedDbPath);
    if (prepareTo > 0) {
      const prepared = await prepareSoakBaseline({
        databasePath: isolatedDbPath,
        bookId,
        targetChapters: prepareTo,
        targetWordCount
      });
      console.log(`隔离长篇基准已准备：新增 ${prepared.inserted} 章规划，目标 ${prepareTo} 章。`);
    }
    if (mode === 'generate' && !preserveTargetState) {
      const reset = await resetSoakRange({
        databasePath: isolatedDbPath,
        bookId,
        chapters: parsedChapters
      });
      console.log(`隔离重跑范围已清空旧正文、反馈和账本：第 ${reset.startChapter}-${reset.endChapter} 章。`);
    }
    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      HARNESS_ISOLATED: '1',
      NOVEL_DB_PATH: isolatedDbPath,
      BATCH_VERIFY_BASE_URL: baseUrl
    };
    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: BACKEND_DIR,
      env,
      stdio: ['ignore', 'inherit', 'inherit']
    });
    await waitForHealth(baseUrl, serverProcess);
    console.log(`隔离 Harness 已启动：${isolatedDbPath}`);
    const verifierArgs = [
      '--mode', mode,
      '--base-url', baseUrl,
      '--book-id', bookId,
      '--chapters', chapters,
      '--prompt-version', promptVersion
    ];
    if (reportPath) verifierArgs.push('--report-path', path.resolve(reportPath));
    if (continueOnFailure) verifierArgs.push('--continue-on-failure');
    await runVerifier(verifierArgs, env);
  } finally {
    await stopProcess(serverProcess);
    if (outputDatabase && fs.existsSync(isolatedDbPath)) {
      const resolvedOutputDatabase = path.resolve(outputDatabase);
      fs.mkdirSync(path.dirname(resolvedOutputDatabase), { recursive: true });
      fs.copyFileSync(isolatedDbPath, resolvedOutputDatabase);
      console.log(`隔离数据库检查点已写入：${resolvedOutputDatabase}`);
    }
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error('隔离连续生成验收失败：', error.message || error);
  process.exitCode = 1;
});
