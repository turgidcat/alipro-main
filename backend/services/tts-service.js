/*
 * Edge TTS 有声书服务
 *
 * 通过 Python 版 edge-tts（Microsoft Edge 在线朗读接口，免密钥）合成：
 *  - 单次请求有长度上限，长文本按句子边界分片合成后合并 MP3；
 *  - 音色列表优先实时拉取，失败时回退到内置常用中文音色；
 *  - 生成结果以 manifest.json + 音频文件的形式持久化在 data/audio 下。
 *
 * Python 运行环境优先使用 backend/tts-venv（见 README），
 * 可通过环境变量 ALIPRO_TTS_PYTHON 指定 python 可执行文件。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const AUDIO_DIR = process.env.ALIPRO_TTS_DIR
  ? path.resolve(process.env.ALIPRO_TTS_DIR)
  : path.join(__dirname, '..', 'data', 'audio');
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json');

const MAX_CHARS_PER_REQUEST = 1200;
const VOICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const RATE_MIN = -30;
const RATE_MAX = 30;
const VOLUME_MIN = -50;
const VOLUME_MAX = 50;
const PITCH_MIN = -15;
const PITCH_MAX = 15;

// 免费 Edge 端点实测可用的输出格式（高音质为 96kbps MP3）。
const OUTPUT_FORMAT_DEFAULT = 'audio-24khz-48kbitrate-mono-mp3';
const OUTPUT_FORMAT_HIGH = 'audio-24khz-96kbitrate-mono-mp3';
const SUPPORTED_OUTPUT_FORMATS = new Set([
  OUTPUT_FORMAT_DEFAULT,
  OUTPUT_FORMAT_HIGH
]);

const ZH_VOICE_NAMES = {
  'zh-CN-XiaoxiaoNeural': '晓晓',
  'zh-CN-XiaoyiNeural': '晓伊',
  'zh-CN-YunjianNeural': '云健',
  'zh-CN-YunxiNeural': '云希',
  'zh-CN-YunxiaNeural': '云夏',
  'zh-CN-YunyangNeural': '云扬',
  'zh-CN-liaoning-XiaobeiNeural': '晓北',
  'zh-CN-shaanxi-XiaoniNeural': '晓妮',
  'zh-TW-HsiaoChenNeural': '曉臻',
  'zh-TW-HsiaoYuNeural': '曉雨',
  'zh-TW-YunJheNeural': '雲哲',
  'zh-HK-HiuGaaiNeural': '曉佳',
  'zh-HK-HiuMaanNeural': '曉曼',
  'zh-HK-WanLungNeural': '雲龍'
};

const FALLBACK_VOICES = [
  { ShortName: 'zh-CN-XiaoxiaoNeural', FriendlyName: 'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', Gender: 'Female', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-XiaoyiNeural', FriendlyName: 'Microsoft Xiaoyi Online (Natural) - Chinese (Mainland)', Gender: 'Female', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-YunxiNeural', FriendlyName: 'Microsoft Yunxi Online (Natural) - Chinese (Mainland)', Gender: 'Male', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-YunjianNeural', FriendlyName: 'Microsoft Yunjian Online (Natural) - Chinese (Mainland)', Gender: 'Male', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-YunxiaNeural', FriendlyName: 'Microsoft Yunxia Online (Natural) - Chinese (Mainland)', Gender: 'Male', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-YunyangNeural', FriendlyName: 'Microsoft Yunyang Online (Natural) - Chinese (Mainland)', Gender: 'Male', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-liaoning-XiaobeiNeural', FriendlyName: 'Microsoft Xiaobei Online (Natural) - Chinese (Liaoning)', Gender: 'Female', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-shaanxi-XiaoniNeural', FriendlyName: 'Microsoft Xiaoni Online (Natural) - Chinese (Shaanxi)', Gender: 'Female', Locale: 'zh-CN' },
  { ShortName: 'zh-TW-HsiaoChenNeural', FriendlyName: 'Microsoft HsiaoChen Online (Natural) - Chinese (Taiwan)', Gender: 'Female', Locale: 'zh-TW' },
  { ShortName: 'zh-TW-YunJheNeural', FriendlyName: 'Microsoft YunJhe Online (Natural) - Chinese (Taiwan)', Gender: 'Male', Locale: 'zh-TW' },
  { ShortName: 'zh-HK-HiuMaanNeural', FriendlyName: 'Microsoft HiuMaan Online (Natural) - Chinese (Hong Kong SAR)', Gender: 'Female', Locale: 'zh-HK' },
  { ShortName: 'zh-HK-WanLungNeural', FriendlyName: 'Microsoft WanLung Online (Natural) - Chinese (Hong Kong SAR)', Gender: 'Male', Locale: 'zh-HK' }
].map((voice) => ({
  ...voice,
  Name: voice.ShortName,
  VoiceTag: { ContentCategories: ['General', 'Novel'], VoicePersonalities: ['Friendly'] }
}));

let voiceCache = {
  voices: null,
  source: '',
  fetchedAt: 0,
  loading: null
};

/**
 * 按句子边界切分长文本，避免单次 Edge TTS 请求超长。
 */
function splitText(text, maxChars = MAX_CHARS_PER_REQUEST) {
  const clean = String(text || '').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks = [];
  const boundaryChars = ['。', '！', '？', '；', '\n', '.', '!', '?', ';'];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    if (end < clean.length) {
      const windowStart = Math.max(start, end - 200);
      const lookback = clean.slice(windowStart, end);
      let boundary = -1;
      for (const ch of boundaryChars) {
        const found = lookback.lastIndexOf(ch);
        if (found > boundary) boundary = found;
      }
      if (boundary >= 60) {
        end = windowStart + boundary + 1;
      }
    }
    const segment = clean.slice(start, end).trim();
    if (segment) chunks.push(segment);
    start = end;
  }
  return chunks;
}

/**
 * 去掉后续分片开头的 ID3 标签，保证多个 MP3 分片能无缝拼接。
 */
function stripId3Tag(buffer) {
  if (
    buffer.length > 10 &&
    buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33
  ) {
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    return buffer.subarray(10 + size);
  }
  return buffer;
}

function normalizeVoice(voice) {
  return {
    shortName: voice.ShortName,
    name: voice.Name || voice.ShortName,
    friendlyName: voice.FriendlyName || voice.ShortName,
    displayName: ZH_VOICE_NAMES[voice.ShortName] || voice.FriendlyName || voice.ShortName,
    gender: voice.Gender === 'Male' ? 'male' : 'female',
    locale: voice.Locale || '',
    contentCategories: voice.VoiceTag?.ContentCategories || [],
    personalities: voice.VoiceTag?.VoicePersonalities || []
  };
}

function sortZhVoices(list) {
  const regionOrder = { 'zh-CN': 0, 'zh-TW': 1, 'zh-HK': 2 };
  return [...list].sort((a, b) => {
    const ra = regionOrder[a.Locale] ?? 9;
    const rb = regionOrder[b.Locale] ?? 9;
    if (ra !== rb) return ra - rb;
    return String(a.FriendlyName).localeCompare(String(b.FriendlyName), 'zh-CN');
  });
}

function resolvePython() {
  if (process.env.ALIPRO_TTS_PYTHON) return process.env.ALIPRO_TTS_PYTHON;
  const venvPython = path.join(
    __dirname,
    '..',
    'tts-venv',
    process.platform === 'win32' ? 'Scripts' : 'bin',
    process.platform === 'win32' ? 'python.exe' : 'python'
  );
  return fs.existsSync(venvPython) ? venvPython : 'python';
}

/**
 * 调用 Python 助手脚本，支持 voices / synthesize 两个子命令。
 */
function runPythonHelper(args, input) {
  return new Promise((resolve, reject) => {
    const helper = path.join(__dirname, 'edge-tts-helper.py');
    const child = spawn(resolvePython(), [helper, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      // Windows 系统代理会让 aiohttp 把合成请求打进代理，导致连不上
      // speech.platform.bing.com；这里显式放行 Edge TTS 域名。
      env: {
        ...process.env,
        NO_PROXY: 'speech.platform.bing.com,localhost,127.0.0.1',
        no_proxy: 'speech.platform.bing.com,localhost,127.0.0.1'
      }
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(Object.assign(new Error('Edge TTS 合成超时，请稍后重试'), { status: 504 }));
    }, 90000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(
        Object.assign(
          new Error('未找到 TTS 运行环境，请先安装 Python 并创建 backend/tts-venv（见 README）'),
          { status: 503, cause: error }
        )
      );
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        Object.assign(new Error(`Edge TTS 合成失败（exit ${code}）：${stderr.slice(0, 200)}`), {
          status: 502
        })
      );
    });

    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

/**
 * 获取中文音色列表。优先实时拉取，缓存 6 小时；失败时回退内置列表。
 */
async function getZhVoices() {
  if (
    voiceCache.voices &&
    Date.now() - voiceCache.fetchedAt < VOICE_CACHE_TTL_MS
  ) {
    return voiceCache.voices;
  }
  if (voiceCache.loading) return voiceCache.loading;

  voiceCache.loading = (async () => {
    try {
      const raw = await runPythonHelper(['voices']);
      const all = JSON.parse(raw || '[]');
      const zh = sortZhVoices(
        (Array.isArray(all) ? all : []).filter((v) =>
          String(v.Locale || '').toLowerCase().startsWith('zh')
        )
      );
      voiceCache.voices = {
        voices: zh.map(normalizeVoice),
        source: 'live',
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      voiceCache.voices = {
        voices: FALLBACK_VOICES.map(normalizeVoice),
        source: 'fallback',
        fetchedAt: new Date().toISOString(),
        error: error.message
      };
    } finally {
      voiceCache.loading = null;
      voiceCache.fetchedAt = Date.now();
    }
    return voiceCache.voices;
  })();

  return voiceCache.loading;
}

function ensureAudioDir(bookId) {
  const dir = path.join(AUDIO_DIR, bookId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readManifest() {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeManifest(entries) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

function publicEntry(entry) {
  return {
    id: entry.id,
    bookId: entry.bookId,
    bookTitle: entry.bookTitle,
    chapterNumber: entry.chapterNumber,
    chapterTitle: entry.chapterTitle,
    voice: entry.voice,
    rate: entry.rate,
    volume: entry.volume,
    pitch: entry.pitch,
    outputFormat: entry.outputFormat,
    textLength: entry.textLength,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    audioUrl: `/api/tts/audio/${entry.id}`
  };
}

function findEntryById(id) {
  return readManifest().find((entry) => entry.id === id) || null;
}

function isValidBookId(bookId) {
  return /^[0-9a-fA-F-]{8,64}$/.test(String(bookId || ''));
}

/**
 * 清理文件名中的非法字符（Windows 保留字符 + 控制字符），并限制长度。
 */
function sanitizeFileName(value = '', maxLength = 80) {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return Array.from(cleaned).slice(0, maxLength).join('');
}

/**
 * 生成有声书文件默认命名：小说名-第N章 章节名.mp3。
 * 缺少书名/章节名时退回原 UUID 命名，保证 custom 模式可用。
 */
function buildAudioFileName({ bookTitle, chapterTitle, chapterNumber, fallbackId }) {
  const bookName = sanitizeFileName(bookTitle);
  const chapterName = sanitizeFileName(chapterTitle);
  const chapterNum = Number(chapterNumber || 0);
  if (bookName && chapterName) {
    const chapterLabel = Number.isFinite(chapterNum) && chapterNum > 0
      ? `第${chapterNum}章 ${chapterName}`
      : chapterName;
    return `${bookName}-${chapterLabel}.mp3`;
  }
  if (bookName) {
    return `${bookName}-第${chapterNum || 0}章.mp3`;
  }
  return `${fallbackId || 'audio'}.mp3`;
}

/**
 * 合成一段文本为 MP3（长文本自动分片拼接）。
 */
async function synthesizeText(
  text,
  { voice, rate = 0, volume = 0, pitch = 0, outputFormat = OUTPUT_FORMAT_DEFAULT } = {}
) {
  const rateValue = Math.max(RATE_MIN, Math.min(RATE_MAX, Number(rate) || 0));
  const rateArg = `${rateValue >= 0 ? '+' : ''}${rateValue}%`;
  const volumeValue = Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, Number(volume) || 0));
  const volumeArg = `${volumeValue >= 0 ? '+' : ''}${volumeValue}%`;
  const pitchValue = Math.max(PITCH_MIN, Math.min(PITCH_MAX, Number(pitch) || 0));
  const pitchArg = `${pitchValue >= 0 ? '+' : ''}${pitchValue}Hz`;
  const formatArg = SUPPORTED_OUTPUT_FORMATS.has(outputFormat)
    ? outputFormat
    : OUTPUT_FORMAT_DEFAULT;
  const chunks = splitText(text);
  if (!chunks.length) {
    throw new Error('没有可合成的文本');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alipro-tts-'));
  try {
    const parts = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunkFile = path.join(tempDir, `chunk-${index}.mp3`);
      // eslint-disable-next-line no-await-in-loop
      await runPythonHelper(
        ['synthesize', chunkFile],
        JSON.stringify({
          text: chunks[index],
          voice,
          rate: rateArg,
          volume: volumeArg,
          pitch: pitchArg,
          outputFormat: formatArg
        })
      );
      const buffer = fs.readFileSync(chunkFile);
      parts.push(index === 0 ? buffer : stripId3Tag(buffer));
    }
    return {
      audio: Buffer.concat(parts),
      settings: { rate: rateValue, volume: volumeValue, pitch: pitchValue, outputFormat: formatArg }
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * 生成单章有声书并写入 manifest。
 * 同一本书同一章节再次生成会覆盖旧文件。
 */
async function createChapterAudio({
  bookId,
  chapterNumber,
  chapterTitle,
  bookTitle,
  text,
  voice,
  rate = 0,
  volume = 0,
  pitch = 0,
  outputFormat = OUTPUT_FORMAT_DEFAULT
}) {
  // 'custom' 是「直接传文本」模式的固定书籍 ID（不落库，仅用于归档目录）。
  if (bookId !== 'custom' && !isValidBookId(bookId)) {
    throw Object.assign(new Error('书籍 ID 无效'), { status: 400 });
  }

  const { audio, settings } = await synthesizeText(text, {
    voice,
    rate,
    volume,
    pitch,
    outputFormat
  });
  const entries = readManifest();
  const existingIndex = entries.findIndex(
    (entry) =>
      entry.bookId === bookId &&
      Number(entry.chapterNumber) === Number(chapterNumber)
  );

  let entry;
  const now = new Date().toISOString();
  if (existingIndex >= 0) {
    entry = { ...entries[existingIndex] };
    const oldFile = path.join(AUDIO_DIR, entry.file);
    if (fs.existsSync(oldFile)) {
      try {
        fs.unlinkSync(oldFile);
      } catch (_) {
        // 旧文件清理失败不影响重新生成
      }
    }
    entry.voice = voice;
    entry.rate = settings.rate;
    entry.volume = settings.volume;
    entry.pitch = settings.pitch;
    entry.outputFormat = settings.outputFormat;
    entry.textLength = String(text).length;
    entry.updatedAt = now;
    entries[existingIndex] = entry;
  } else {
    const id = uuidv4();
    entry = {
      id,
      bookId,
      bookTitle,
      chapterNumber: Number(chapterNumber),
      chapterTitle,
      voice,
      rate: settings.rate,
      volume: settings.volume,
      pitch: settings.pitch,
      outputFormat: settings.outputFormat,
      textLength: String(text).length,
      file: '',
      createdAt: now,
      updatedAt: now
    };
    entries.push(entry);
  }

  const fileName = buildAudioFileName({
    bookTitle: entry.bookTitle,
    chapterTitle: entry.chapterTitle,
    chapterNumber: entry.chapterNumber,
    fallbackId: entry.id
  });
  const newFile = path.join(bookId, fileName).replace(/\\/g, '/');
  if (newFile !== entry.file) {
    entry.file = newFile;
    if (existingIndex >= 0) entries[existingIndex] = entry;
  }
  const bookDir = ensureAudioDir(bookId);
  fs.writeFileSync(path.join(bookDir, fileName), audio);
  writeManifest(entries);
  return publicEntry(entry);
}

function listBookAudio(bookId) {
  if (!isValidBookId(bookId)) return [];
  return readManifest()
    .filter((entry) => entry.bookId === bookId)
    .sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber))
    .map(publicEntry);
}

function resolveAudioFile(id) {
  const entry = findEntryById(id);
  if (!entry) return null;
  const file = path.join(AUDIO_DIR, entry.file);
  if (!file.startsWith(AUDIO_DIR) || !fs.existsSync(file)) return null;
  return { entry, file };
}

function deleteAudio(id) {
  const resolved = resolveAudioFile(id);
  if (!resolved) return false;
  const entries = readManifest().filter((entry) => entry.id !== id);
  writeManifest(entries);
  try {
    fs.unlinkSync(resolved.file);
  } catch (_) {
    // 文件已不存在时仅清理 manifest
  }
  return true;
}

// ============ 批量下载（无压缩 store ZIP，mp3 本身已压缩） ============

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32Buffer(buffer) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dateBits = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xFFFF, date: dateBits & 0xFFFF };
}

/**
 * 用 ZIP store（无压缩）方式打包文件列表，文件名按 UTF-8 写入（bit 11）。
 */
function buildStoreZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();
  files.forEach((file) => {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const crc = crc32Buffer(file.buffer);
    const size = file.buffer.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(stamp.time, 10);
    localHeader.writeUInt16LE(stamp.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, file.buffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(stamp.time, 12);
    centralHeader.writeUInt16LE(stamp.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);
    offset += 30 + nameBuffer.length + size;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

/**
 * 把一本书已生成的有声书打包为 zip：zip 内为「书名/章节名.mp3」。
 * 返回 { buffer, zipName }；没有可下载音频时返回 null。
 */
function buildBookAudioZip(bookId) {
  if (!isValidBookId(bookId)) return null;
  const entries = listBookAudio(bookId);
  if (entries.length === 0) return null;
  const folderName = sanitizeFileName(entries[0].bookTitle || '有声书') || '有声书';
  const files = [];
  entries.forEach((entry) => {
    const resolved = resolveAudioFile(entry.id);
    if (!resolved) return;
    const baseName = path.basename(resolved.file);
    files.push({
      name: `${folderName}/${baseName}`,
      buffer: fs.readFileSync(resolved.file)
    });
  });
  if (files.length === 0) return null;
  return {
    buffer: buildStoreZip(files),
    zipName: `${folderName}-有声书.zip`
  };
}

module.exports = {
  AUDIO_DIR,
  buildBookAudioZip,
  createChapterAudio,
  deleteAudio,
  getZhVoices,
  isValidBookId,
  listBookAudio,
  resolveAudioFile,
  splitText,
  synthesizeText
};
