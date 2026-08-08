import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteTtsAudio,
  fetchBookChapters,
  fetchBookList,
  fetchBookTtsAudio,
  fetchTtsVoices,
  getStoredCurrentBookId,
  persistCurrentBookId,
  previewTts,
  synthesizeTtsChapter
} from '../workbenchApi.js';
import {
  countPlatformEffectiveWords,
  formatExactWordCount
} from '../lib/textMetrics.js';

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
const OUTPUT_FORMAT_DEFAULT = 'audio-24khz-48kbitrate-mono-mp3';
const OUTPUT_FORMAT_HIGH = 'audio-24khz-96kbitrate-mono-mp3';
const APP_BASE_PATH = String(import.meta.env.BASE_URL || '/');
const API_BASE = import.meta.env.VITE_API_BASE || `${APP_BASE_PATH.replace(/\/+$/, '')}/api`;

const REGION_LABELS = {
  'zh-CN': '普通话',
  'zh-TW': '台湾',
  'zh-HK': '粤语'
};

// 参考市面有声书通用语速档位（Edge TTS 百分比与倍速近似对应）。
const SPEED_PRESETS = [
  { label: '舒缓', value: -15, speed: '0.85x' },
  { label: '标准', value: 0, speed: '1.0x' },
  { label: '稍快', value: 15, speed: '1.15x' },
  { label: '快速', value: 25, speed: '1.25x' }
];

const VOLUME_PRESETS = [
  { label: '柔和', value: -20 },
  { label: '标准', value: 0 },
  { label: '洪亮', value: 20 }
];

const VOICE_DISPLAY_NAMES = {
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

const CATEGORY_LABELS = {
  Novel: '小说',
  News: '新闻',
  Cartoon: '动漫',
  Dialect: '方言',
  Sports: '体育',
  General: '通用'
};

const PERSONALITY_LABELS = {
  Friendly: '友好',
  Positive: '积极',
  Warm: '温暖',
  Lively: '活泼',
  Passion: '热情',
  Sunshine: '阳光',
  Cute: '可爱',
  Professional: '专业',
  Reliable: '可靠',
  Humorous: '幽默',
  Bright: '明亮'
};

function voiceRegion(locale) {
  const base = String(locale || '').split('-').slice(0, 2).join('-');
  return REGION_LABELS[base] || '中文';
}

function formatSigned(value, suffix) {
  const num = Number(value) || 0;
  return `${num > 0 ? '+' : ''}${num}${suffix}`;
}

function qualityLabel(format) {
  return String(format || '').includes('96kbitrate') ? '高清 96k' : '标准 48k';
}

function displayVoiceName(shortName) {
  return VOICE_DISPLAY_NAMES[shortName] || shortName;
}

function voiceTags(item) {
  const parts = [];
  const category = (item.contentCategories || [])
    .map((value) => CATEGORY_LABELS[String(value).trim()])
    .filter(Boolean);
  const personality = (item.personalities || [])
    .map((value) => PERSONALITY_LABELS[String(value).trim()])
    .filter(Boolean);
  if (category.length) parts.push(category[0]);
  if (personality.length) parts.push(personality[0]);
  return parts;
}

function firstSentence(text, max = 120) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const match = clean.match(/^[^。！？!?；;…]*[。！？!?；;…]/);
  const head = match ? match[0] : clean;
  return head.length <= max ? head : head.slice(0, max);
}

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AudiobookPage() {
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [bookId, setBookId] = useState('');
  const [chapters, setChapters] = useState([]);
  const [entries, setEntries] = useState([]);
  const [voices, setVoices] = useState({ voices: [], source: '' });
  const [voice, setVoice] = useState(DEFAULT_VOICE);
  const [rate, setRate] = useState(0);
  const [volume, setVolume] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [outputFormat, setOutputFormat] = useState(OUTPUT_FORMAT_DEFAULT);
  const [previewing, setPreviewing] = useState(false);
  const [previewAudio, setPreviewAudio] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const cancelRef = useRef(false);

  const loadBooks = useCallback(async () => {
    setBooksLoading(true);
    try {
      const list = await fetchBookList();
      setBooks(list);
      const remembered = getStoredCurrentBookId();
      const initial = list.find((book) => book.id === remembered) || list[0];
      if (initial) {
        setBookId(initial.id);
        persistCurrentBookId(initial.id);
      }
    } catch (err) {
      setError(err.message || '读取书籍列表失败');
    } finally {
      setBooksLoading(false);
    }
  }, []);

  const loadVoices = useCallback(async () => {
    try {
      const data = await fetchTtsVoices();
      setVoices(data);
      if (data?.voices?.length && !data.voices.some((v) => v.shortName === DEFAULT_VOICE)) {
        setVoice(data.voices[0].shortName);
      }
    } catch (err) {
      setVoices({ voices: [], source: '', error: err.message });
    }
  }, []);

  const loadBookData = useCallback(async (targetBookId) => {
    if (!targetBookId) return;
    try {
      const [chapterList, audioList] = await Promise.all([
        fetchBookChapters(targetBookId),
        fetchBookTtsAudio(targetBookId)
      ]);
      setChapters(Array.isArray(chapterList) ? chapterList : []);
      setEntries(Array.isArray(audioList) ? audioList : []);
      setSelectedChapter((current) => {
        if (current && chapterList.some((ch) => Number(ch.chapter_number) === current.chapterNumber)) {
          return current;
        }
        const first = Array.isArray(chapterList) ? chapterList[0] : null;
        return first ? { chapterNumber: Number(first.chapter_number), chapterName: first.chapter_name || first.title || '' } : null;
      });
    } catch (err) {
      setError(err.message || '读取章节失败');
    }
  }, []);

  useEffect(() => {
    loadBooks();
    loadVoices();
  }, [loadBooks, loadVoices]);

  useEffect(() => {
    setError('');
    setEntries([]);
    setChapters([]);
    setPreviewAudio('');
    setPreviewError('');
    if (bookId) loadBookData(bookId);
  }, [bookId, loadBookData]);

  const entriesByChapter = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => map.set(Number(entry.chapterNumber), entry));
    return map;
  }, [entries]);

  const chaptersWithContent = chapters.filter((ch) => String(ch.content || '').trim());
  const selectedChapterHasContent = Boolean(
    selectedChapter && chapters.some(
      (ch) => Number(ch.chapter_number) === selectedChapter.chapterNumber && String(ch.content || '').trim()
    )
  );
  const busy = generating !== null || previewing;
  const selectedChapterContent = selectedChapter
    ? chapters.find(
      (ch) => Number(ch.chapter_number) === selectedChapter.chapterNumber && String(ch.content || '').trim()
    )?.content || ''
    : '';
  const previewText = firstSentence(selectedChapterContent);
  const selectedChapterParagraphs = useMemo(
    () => selectedChapterContent
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    [selectedChapterContent]
  );

  function selectBook(nextBookId) {
    if (busy) return;
    persistCurrentBookId(nextBookId);
    setBookId(nextBookId);
  }

  async function refreshEntries() {
    if (!bookId) return;
    try {
      setEntries(await fetchBookTtsAudio(bookId));
    } catch (err) {
      setError(err.message || '刷新音频列表失败');
    }
  }

  async function generateChapter(chapterNumber, chapterName) {
    if (!bookId || generating) return;
    setError('');
    setGenerating({ chapterNumber });
    try {
      await synthesizeTtsChapter({
        bookId,
        chapterNumber,
        voice,
        rate,
        volume,
        pitch,
        outputFormat
      });
      await refreshEntries();
    } catch (err) {
      setError(err.message || '生成失败，请稍后重试');
    } finally {
      setGenerating(null);
    }
  }

  async function generateAll() {
    if (!bookId || generating || !chaptersWithContent.length) return;
    setError('');
    cancelRef.current = false;
    setGenerating({ kind: 'all' });
    try {
      const total = chaptersWithContent.length;
      for (let index = 0; index < total; index += 1) {
        if (cancelRef.current) break;
        const chapter = chaptersWithContent[index];
        const chapterNumber = Number(chapter.chapter_number);
        const chapterName = chapter.chapter_name || chapter.title || '';
        setProgress({ done: index, total, chapterNumber, chapterName });
        // eslint-disable-next-line no-await-in-loop
        await synthesizeTtsChapter({
          bookId,
          chapterNumber,
          voice,
          rate,
          volume,
          pitch,
          outputFormat
        });
      }
      setProgress({ done: total, total, chapterNumber: null, chapterName: '' });
      await refreshEntries();
    } catch (err) {
      setError(err.message || '批量生成中断，请稍后重试');
    } finally {
      setProgress(null);
      setGenerating(null);
    }
  }

  function stopAll() {
    cancelRef.current = true;
  }

  async function removeAudio(id) {
    if (busy) return;
    try {
      await deleteTtsAudio(id);
      await refreshEntries();
    } catch (err) {
      setError(err.message || '删除失败');
    }
  }

  async function runPreview(previewVoice = voice) {
    if (!previewText || previewing || generating) return;
    setError('');
    setPreviewError('');
    setPreviewAudio('');
    setPreviewing(true);
    try {
      const data = await previewTts({
        text: previewText,
        voice: previewVoice,
        rate,
        volume,
        pitch,
        outputFormat
      });
      setPreviewAudio(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`);
    } catch (err) {
      setPreviewError(err.message || '试听生成失败，请稍后重试');
    } finally {
      setPreviewing(false);
    }
  }

  const selectedBook = books.find((book) => book.id === bookId);

  return (
    <>
      <style>{`
        /* 有声书页面（全部使用 --paper-* token） */
        .audiobook-layout {
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .audiobook-panel {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .audiobook-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid var(--paper-border);
        }

        .audiobook-panel-title {
          margin: 0;
          color: var(--paper-text);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .audiobook-panel-count {
          color: var(--paper-text-tertiary);
          font-size: 11px;
        }

        .audiobook-book-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--paper-border-strong);
          border-radius: var(--paper-radius-sm);
          background: var(--paper-surface-raised);
          color: var(--paper-text);
          font-family: var(--font-sans);
          font-size: 13px;
          outline: none;
        }

        .audiobook-book-select:focus {
          border-color: var(--paper-accent-border);
          box-shadow: 0 0 0 3px var(--paper-accent-soft);
        }

        .audiobook-chapter-list {
          max-height: 460px;
          overflow-y: auto;
          padding: 8px;
        }

        .audiobook-chapter-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 9px 10px;
          border: none;
          border-radius: var(--paper-radius-sm);
          background: transparent;
          color: var(--paper-text-soft);
          font-family: var(--font-sans);
          font-size: 12.5px;
          cursor: pointer;
          text-align: left;
          transition: background 150ms ease, color 150ms ease;
        }

        .audiobook-chapter-item:hover {
          background: var(--paper-accent-hover);
          color: var(--paper-text);
        }

        .audiobook-chapter-item.is-active {
          background: var(--paper-accent-soft);
          color: var(--paper-accent-deep);
        }

        .audiobook-chapter-dot {
          flex: 0 0 7px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--paper-border-strong);
        }

        .audiobook-chapter-dot.is-ready {
          background: var(--paper-success);
        }

        .audiobook-chapter-dot.is-empty {
          background: transparent;
          border: 1px dashed var(--paper-border-strong);
        }

        .audiobook-chapter-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .audiobook-chapter-meta {
          color: var(--paper-text-tertiary);
          font-size: 10.5px;
          flex-shrink: 0;
        }

        .audiobook-voice-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
        }

        .audiobook-voice-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 4px 10px;
          align-items: start;
          padding: 12px 14px;
          border: 1px solid var(--paper-border);
          border-radius: var(--paper-radius-md);
          background: var(--paper-surface-raised);
          color: var(--paper-text);
          font-family: var(--font-sans);
          cursor: pointer;
          text-align: left;
          transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
        }

        .audiobook-voice-card:hover {
          border-color: var(--paper-accent-border);
          background: var(--paper-accent-hover);
        }

        .audiobook-voice-card.is-active {
          border-color: var(--paper-accent-border);
          background: var(--paper-accent-soft);
          box-shadow: inset 0 0 0 1px var(--paper-accent-border);
        }

        .audiobook-voice-main {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .audiobook-voice-name {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--paper-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .audiobook-voice-sub {
          font-size: 11px;
          color: var(--paper-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .audiobook-voice-preview {
          padding: 3px 8px;
          border: 1px solid var(--paper-border-strong);
          border-radius: 999px;
          background: var(--paper-surface-raised);
          color: var(--paper-text-muted);
          font-family: var(--font-sans);
          font-size: 10.5px;
          cursor: pointer;
          transition: border-color 150ms ease, color 150ms ease;
        }

        .audiobook-voice-preview:hover:not(:disabled) {
          border-color: var(--paper-accent-border);
          color: var(--paper-accent-deep);
        }

        .audiobook-voice-preview:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .audiobook-param-row {
          display: grid;
          grid-template-columns: 54px 1fr 64px;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
        }

        .audiobook-param-row label {
          color: var(--paper-text-muted);
          font-size: 12px;
        }

        .audiobook-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .audiobook-preset-chip {
          display: inline-flex;
          align-items: baseline;
          gap: 5px;
          padding: 5px 12px;
          border: 1px solid var(--paper-border-strong);
          border-radius: 999px;
          background: var(--paper-surface-raised);
          color: var(--paper-text-muted);
          font-family: var(--font-sans);
          font-size: 12px;
          cursor: pointer;
          transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
        }

        .audiobook-preset-chip:hover:not(:disabled) {
          border-color: var(--paper-accent-border);
          color: var(--paper-accent-deep);
        }

        .audiobook-preset-chip.is-active {
          border-color: var(--paper-accent-border);
          background: var(--paper-accent-soft);
          color: var(--paper-accent-deep);
          font-weight: 700;
        }

        .audiobook-preset-chip:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .audiobook-preset-speed {
          color: var(--paper-text-tertiary);
          font-size: 10.5px;
          font-weight: 400;
        }

        .audiobook-param-range {
          width: 100%;
          accent-color: var(--paper-accent);
        }

        .audiobook-param-value {
          color: var(--paper-text-soft);
          font-size: 12px;
          font-weight: 650;
          text-align: right;
        }

        .audiobook-quality-select {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid var(--paper-border-strong);
          border-radius: var(--paper-radius-sm);
          background: var(--paper-surface-raised);
          color: var(--paper-text);
          font-family: var(--font-sans);
          font-size: 12px;
          outline: none;
        }

        .audiobook-quality-select:focus {
          border-color: var(--paper-accent-border);
          box-shadow: 0 0 0 3px var(--paper-accent-soft);
        }

        .audiobook-preview {
          display: grid;
          gap: 10px;
          margin-top: 18px;
          padding: 14px 16px;
          border: 1px dashed var(--paper-border-strong);
          border-radius: var(--paper-radius-md);
          background: var(--paper-surface);
        }

        .audiobook-preview-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .audiobook-preview-hint {
          color: var(--paper-text-tertiary);
          font-size: 11px;
        }

        .audiobook-preview-audio {
          width: 100%;
          height: 36px;
        }

        .audiobook-preview-error {
          color: var(--paper-danger);
          font-size: 12px;
          line-height: 1.5;
        }

        .audiobook-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid var(--paper-border);
        }

        .audiobook-section {
          margin-top: 18px;
        }

        .audiobook-progress {
          display: grid;
          gap: 8px;
          margin-top: 18px;
          padding: 14px 18px;
          border: 1px solid var(--paper-success-line);
          border-radius: var(--paper-radius-md);
          background: var(--paper-success-soft);
          color: var(--paper-text);
        }

        .audiobook-progress-track {
          height: 6px;
          border-radius: 999px;
          background: var(--paper-surface-deep);
          overflow: hidden;
        }

        .audiobook-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: var(--paper-success);
          transition: width 250ms ease;
        }

        .audiobook-progress-text {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: var(--paper-text-muted);
          font-size: 12px;
        }

        .audiobook-prose {
          padding: 16px 20px 18px;
          max-height: 330px;
          overflow-y: auto;
        }

        .audiobook-prose-title {
          margin: 0 0 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--paper-border);
          color: var(--paper-text);
          font-size: 13.5px;
          font-weight: 700;
        }

        .audiobook-prose-paragraph {
          margin: 0 0 12px;
          font-family: var(--font-serif);
          font-size: 14px;
          line-height: 1.95;
          color: var(--paper-text-soft);
          text-indent: 2em;
          white-space: pre-wrap;
        }

        .audiobook-error {
          margin-top: 18px;
          padding: 12px 16px;
          border: 1px solid var(--paper-danger-line);
          border-radius: var(--paper-radius-md);
          background: var(--paper-danger-soft);
          color: var(--paper-danger);
          font-size: 12.5px;
          line-height: 1.6;
        }

        .audiobook-empty {
          padding: 34px 18px;
          color: var(--paper-text-tertiary);
          font-size: 13px;
          text-align: center;
          line-height: 1.8;
        }

        .audiobook-result-list {
          display: grid;
          gap: 12px;
        }

        .audiobook-result {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px 18px;
          padding: 14px 16px;
          border: 1px solid var(--paper-border);
          border-radius: var(--paper-radius-md);
          background: var(--paper-surface-raised);
        }

        .audiobook-result-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 6px 12px;
          min-width: 0;
        }

        .audiobook-result-title {
          color: var(--paper-text);
          font-size: 13.5px;
          font-weight: 700;
        }

        .audiobook-result-sub {
          color: var(--paper-text-muted);
          font-size: 11.5px;
        }

        .audiobook-result-audio {
          grid-column: 1 / -1;
          width: 100%;
          height: 36px;
        }

        .audiobook-result-actions {
          display: flex;
          gap: 8px;
        }

        .audiobook-result-actions .ide-btn {
          min-height: 32px;
          padding: 0 12px;
          font-size: 12px;
        }

        .audiobook-sub {
          margin: 14px 18px 0;
          color: var(--paper-text-tertiary);
          font-size: 11.5px;
          line-height: 1.7;
        }

        @media (max-width: 980px) {
          .audiobook-layout {
            grid-template-columns: 1fr;
          }

          .audiobook-chapter-list {
            max-height: 260px;
          }
        }
      `}</style>

      <section className="ide-page audiobook-page">
        <header className="ide-page-header">
          <h1>有声书</h1>
          <p>把章节正文交给 Edge TTS 朗读，生成可随时播放的 MP3。适合通勤、散步时重听自己的作品。</p>
        </header>

        {error ? <div className="audiobook-error" role="alert">{error}</div> : null}

        <div className="audiobook-layout">
          <aside className="ide-card audiobook-panel">
            <div className="audiobook-panel-head">
              <h2 className="audiobook-panel-title">书籍与章节</h2>
              <span className="audiobook-panel-count">{chapters.length ? `${chapters.length} 章` : ''}</span>
            </div>

            {booksLoading ? (
              <div className="audiobook-empty">正在读取作品…</div>
            ) : books.length === 0 ? (
              <div className="audiobook-empty">
                还没有作品。请先到<strong>资料库</strong>创建书籍并创作章节正文。
              </div>
            ) : (
              <>
                <div style={{ padding: '14px 14px 4px' }}>
                  <select
                    className="audiobook-book-select"
                    value={bookId}
                    onChange={(event) => selectBook(event.target.value)}
                    disabled={busy}
                    aria-label="选择书籍"
                  >
                    {books.map((book) => (
                      <option key={book.id} value={book.id}>{book.title}</option>
                    ))}
                  </select>
                </div>

                <div className="audiobook-chapter-list">
                  {chapters.length === 0 ? (
                    <div className="audiobook-empty">这本书还没有章节，先去创作台写正文吧。</div>
                  ) : chapters.map((chapter) => {
                    const chapterNumber = Number(chapter.chapter_number);
                    const hasAudio = entriesByChapter.has(chapterNumber);
                    const hasContent = Boolean(String(chapter.content || '').trim());
                    const active = selectedChapter?.chapterNumber === chapterNumber;
                    const dotClass = hasAudio ? 'is-ready' : (hasContent ? '' : 'is-empty');
                    return (
                      <button
                        key={chapterNumber}
                        type="button"
                        className={`audiobook-chapter-item${active ? ' is-active' : ''}`}
                        onClick={() => setSelectedChapter({
                          chapterNumber,
                          chapterName: chapter.chapter_name || chapter.title || ''
                        })}
                      >
                        <span className={`audiobook-chapter-dot ${dotClass}`} aria-hidden="true" />
                        <span className="audiobook-chapter-title">
                          第{chapterNumber}章 {chapter.chapter_name || chapter.title || ''}
                        </span>
                        <span className="audiobook-chapter-meta">
                          {hasAudio ? '已生成' : (hasContent ? '' : '暂无正文')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </aside>

          <div className="audiobook-workspace">
            <section className="ide-card audiobook-panel">
              <div className="audiobook-panel-head">
                <h2 className="audiobook-panel-title">朗读设置</h2>
                <span className="audiobook-panel-count">
                  {voices.source === 'live' ? `${voices.voices.length} 个中文音色` : '音色列表来自离线回退'}
                </span>
              </div>

              <div style={{ padding: '18px' }}>
                <div className="audiobook-voice-grid">
                  {(voices.voices || []).map((item) => (
                    <div
                      key={item.shortName}
                      className={`audiobook-voice-card${voice === item.shortName ? ' is-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      title={item.friendlyName || item.displayName}
                      onClick={() => setVoice(item.shortName)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setVoice(item.shortName);
                        }
                      }}
                    >
                      <span className="audiobook-voice-main">
                        <span className="audiobook-voice-name">{item.displayName}</span>
                        <span className="audiobook-voice-sub">
                          {item.gender === 'male' ? '男声' : '女声'} · {voiceRegion(item.locale)}
                          {voiceTags(item).map((tag) => ` · ${tag}`).join('')}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="audiobook-voice-preview"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          runPreview(item.shortName);
                        }}
                      >
                        试听
                      </button>
                    </div>
                  ))}
                </div>

                <div className="audiobook-presets">
                  {SPEED_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`audiobook-preset-chip${rate === preset.value ? ' is-active' : ''}`}
                      disabled={busy}
                      onClick={() => setRate(preset.value)}
                    >
                      {preset.label}
                      <span className="audiobook-preset-speed">{preset.speed}</span>
                    </button>
                  ))}
                </div>

                <div className="audiobook-param-row">
                  <label htmlFor="audiobook-rate">语速</label>
                  <input
                    id="audiobook-rate"
                    className="audiobook-param-range"
                    type="range"
                    min="-30"
                    max="30"
                    step="5"
                    value={rate}
                    onChange={(event) => setRate(Number(event.target.value))}
                    disabled={busy}
                  />
                  <span className="audiobook-param-value">{formatSigned(rate, '%')}</span>
                </div>

                <div className="audiobook-presets">
                  {VOLUME_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`audiobook-preset-chip${volume === preset.value ? ' is-active' : ''}`}
                      disabled={busy}
                      onClick={() => setVolume(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="audiobook-param-row">
                  <label htmlFor="audiobook-volume">音量</label>
                  <input
                    id="audiobook-volume"
                    className="audiobook-param-range"
                    type="range"
                    min="-50"
                    max="50"
                    step="5"
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    disabled={busy}
                  />
                  <span className="audiobook-param-value">{formatSigned(volume, '%')}</span>
                </div>

                <div className="audiobook-param-row">
                  <label htmlFor="audiobook-pitch">音调</label>
                  <input
                    id="audiobook-pitch"
                    className="audiobook-param-range"
                    type="range"
                    min="-15"
                    max="15"
                    step="1"
                    value={pitch}
                    onChange={(event) => setPitch(Number(event.target.value))}
                    disabled={busy}
                  />
                  <span className="audiobook-param-value">{formatSigned(pitch, 'Hz')}</span>
                </div>

                <div className="audiobook-param-row">
                  <label htmlFor="audiobook-quality">音质</label>
                  <select
                    id="audiobook-quality"
                    className="audiobook-quality-select"
                    value={outputFormat}
                    onChange={(event) => setOutputFormat(event.target.value)}
                    disabled={busy}
                  >
                    <option value={OUTPUT_FORMAT_DEFAULT}>标准 · 48kbps</option>
                    <option value={OUTPUT_FORMAT_HIGH}>高清 · 96kbps</option>
                  </select>
                  <span className="audiobook-param-value">{qualityLabel(outputFormat)}</span>
                </div>

                <div className="audiobook-preview">
                  <div className="audiobook-preview-actions">
                    <button
                      type="button"
                      className="ide-btn"
                      disabled={busy || !previewText}
                      onClick={() => runPreview(voice)}
                    >
                      {previewing ? '正在生成试听…' : '试听当前设置'}
                    </button>
                    <span className="audiobook-preview-hint">
                      {previewText ? '取所选章节开头一句话，用当前参数试听' : '所选章节暂无正文，无法试听'}
                    </span>
                  </div>
                  {previewAudio ? (
                    <audio
                      className="audiobook-preview-audio"
                      controls
                      autoPlay
                      src={previewAudio}
                    >
                      你的浏览器不支持音频播放。
                    </audio>
                  ) : null}
                  {previewError ? (
                    <div className="audiobook-preview-error" role="alert">{previewError}</div>
                  ) : null}
                </div>

                <div className="audiobook-actions">
                  <button
                    type="button"
                    className="ide-btn ide-btn--primary"
                    disabled={busy || !selectedChapter || !selectedChapterHasContent}
                    onClick={() => selectedChapter && generateChapter(
                      selectedChapter.chapterNumber,
                      selectedChapter.chapterName
                    )}
                  >
                    {generating && generating.chapterNumber === selectedChapter?.chapterNumber
                      ? '正在生成…'
                      : selectedChapter
                        ? `生成第${selectedChapter.chapterNumber}章`
                        : '请先选择章节'}
                  </button>
                  <button
                    type="button"
                    className="ide-btn"
                    disabled={busy || !chaptersWithContent.length}
                    onClick={generateAll}
                  >
                    生成全书（{chaptersWithContent.length} 章）
                  </button>
                  {generating?.kind === 'all' ? (
                    <button type="button" className="ide-btn ide-btn--danger-ghost" onClick={stopAll}>
                      停止
                    </button>
                  ) : null}
                </div>

                <p className="audiobook-sub">
                  {selectedBook ? `正在为《${selectedBook.title}》生成` : ''}
                  {selectedChapterHasContent ? `第${selectedChapter.chapterNumber}章 ${selectedChapter.chapterName}` : ''}
                  {selectedChapter && !selectedChapterHasContent ? '（所选章节暂无正文）' : ''}
                </p>
              </div>
            </section>

            <section className="ide-card audiobook-panel audiobook-section">
              <div className="audiobook-panel-head">
                <h2 className="audiobook-panel-title">章节正文</h2>
                <span className="audiobook-panel-count">
                  {selectedChapterContent
                    ? formatExactWordCount(countPlatformEffectiveWords(selectedChapterContent))
                    : ''}
                </span>
              </div>

              {selectedChapterContent ? (
                <div className="audiobook-prose">
                  <h3 className="audiobook-prose-title">
                    {selectedChapter
                      ? `第${selectedChapter.chapterNumber}章 ${selectedChapter.chapterName || ''}`
                      : ''}
                  </h3>
                  {selectedChapterParagraphs.map((paragraph, index) => (
                    <p key={index} className="audiobook-prose-paragraph">{paragraph}</p>
                  ))}
                </div>
              ) : (
                <div className="audiobook-empty">
                  {selectedChapter
                    ? '所选章节还没有正文，先到创作台生成或编辑这一章吧。'
                    : '先在左侧选择章节，这里会展示对应正文。'}
                </div>
              )}
            </section>

            {progress && generating?.kind === 'all' ? (
              <div className="audiobook-progress">
                <div className="audiobook-progress-track">
                  <div
                    className="audiobook-progress-fill"
                    style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                  />
                </div>
                <div className="audiobook-progress-text">
                  <span>
                    正在生成{progress.chapterNumber ? `第${progress.chapterNumber}章 ${progress.chapterName}` : ''}…
                  </span>
                  <span>{progress.done} / {progress.total}</span>
                </div>
              </div>
            ) : null}

            <section className="ide-card audiobook-panel audiobook-section">
              <div className="audiobook-panel-head">
                <h2 className="audiobook-panel-title">已生成音频</h2>
                <span className="audiobook-panel-count">{entries.length ? `${entries.length} 段` : ''}</span>
                {entries.length > 0 ? (
                  <a
                    className="ide-btn"
                    href={`${API_BASE}/tts/books/${bookId}/download`}
                    download
                    title="打包为 zip：文件夹名为书名，内部为各章节 mp3"
                  >
                    批量下载 MP3
                  </a>
                ) : null}
              </div>

              {entries.length === 0 ? (
                <div className="audiobook-empty">
                  还没有生成音频。选择章节与音色，点击「生成」即可开始。
                </div>
              ) : (
                <div style={{ padding: '14px' }}>
                  <div className="audiobook-result-list">
                    {entries.map((entry) => (
                      <article key={entry.id} className="audiobook-result">
                        <div className="audiobook-result-meta">
                          <span className="audiobook-result-title">
                            第{entry.chapterNumber}章 {entry.chapterTitle}
                          </span>
                          <span className="audiobook-result-sub">
                            {displayVoiceName(entry.voice)} · {formatSigned(entry.rate, '%')}
                            {entry.volume ? ` · 音量 ${formatSigned(entry.volume, '%')}` : ''}
                            {entry.pitch ? ` · 音调 ${formatSigned(entry.pitch, 'Hz')}` : ''}
                            {` · ${qualityLabel(entry.outputFormat)}`}
                            {` · ${entry.textLength} 字 · ${formatTime(entry.updatedAt || entry.createdAt)}`}
                          </span>
                        </div>
                        <div className="audiobook-result-actions">
                          <button
                            type="button"
                            className="ide-btn"
                            disabled={busy}
                            onClick={() => generateChapter(Number(entry.chapterNumber), entry.chapterTitle)}
                          >
                            重新生成
                          </button>
                          <button
                            type="button"
                            className="ide-btn ide-btn--danger-ghost"
                            disabled={busy}
                            onClick={() => removeAudio(entry.id)}
                          >
                            删除
                          </button>
                        </div>
                        <audio
                          className="audiobook-result-audio"
                          controls
                          preload="none"
                          src={`${API_BASE}/tts/audio/${entry.id}`}
                        >
                          你的浏览器不支持音频播放。
                        </audio>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
