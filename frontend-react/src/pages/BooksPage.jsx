import { useEffect, useMemo, useState } from 'react';
import {
  createBook,
  fetchBookList,
  generateChapterName,
  generateChapterOutline,
  generateFullOutlineDraft,
  generateVolumePlansFromBookPlan,
  getStoredCurrentBookId,
  persistCurrentBookId,
  saveChapterPlan,
  saveOutlineSummary,
  updateBook
} from '../workbenchApi.js';
import IndentedTextBlock from '../components/IndentedTextBlock.jsx';
import { getRoleTierShortLabel, roleTierOptions } from '../lib/roleTiers.js';
import { formatChapterLabel, normalizeChapterName } from '../lib/chapterName.js';
import '../styles.css';
import '../app-shell.css';

const APP_BASE_PATH = String(import.meta.env.BASE_URL || '/');
const API_BASE = import.meta.env.VITE_API_BASE || `${APP_BASE_PATH.replace(/\/+$/, '')}/api`;

function buildAppPath(pathname = '/') {
  const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const cleanBase = APP_BASE_PATH.endsWith('/') ? APP_BASE_PATH : `${APP_BASE_PATH}/`;
  return cleanPath ? `${cleanBase}${cleanPath}` : cleanBase;
}

function getCurrentAppPathname() {
  const rawPath = window.location.pathname || '/';
  const cleanBase = APP_BASE_PATH.replace(/\/+$/, '');
  if (cleanBase && cleanBase !== '/' && rawPath.startsWith(cleanBase)) {
    return rawPath.slice(cleanBase.length) || '/';
  }
  return rawPath;
}

function formatLibraryChapterTitle(chapterNumber, chapterName = '') {
  return formatChapterLabel(chapterNumber, chapterName, ' ');
}

function extractRepeatedChapterPhrases(titles = []) {
  const phraseCounts = new Map();
  const normalizedTitles = Array.isArray(titles)
    ? titles
      .map((title) => String(title || '').replace(/\s+/g, '').trim())
      .filter(Boolean)
    : [];

  normalizedTitles.forEach((title) => {
    const seen = new Set();
    for (let length = 2; length <= 4; length += 1) {
      for (let index = 0; index <= title.length - length; index += 1) {
        const phrase = title.slice(index, index + length);
        if (!/^[\u4e00-\u9fa5A-Za-z]{2,4}$/.test(phrase)) continue;
        if (seen.has(phrase)) continue;
        seen.add(phrase);
        phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      }
    }
  });

  return Array.from(phraseCounts.entries())
    .filter(([, count]) => count >= 3)
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return right[0].length - left[0].length;
    })
    .map(([phrase]) => phrase)
    .filter((phrase, index, list) => !list.some((other, otherIndex) => otherIndex < index && other.includes(phrase)))
    .slice(0, 8);
}

const genreCategoryMap = {
  urban: {
    label: '都市异能',
    subgenres: [
      ['urban_superpower', '超能力'],
      ['urban_rebirth', '重生流'],
      ['urban_system', '系统流'],
      ['urban_medical', '医圣流'],
      ['urban_business', '商战流']
    ]
  },
  fantasy: {
    label: '玄幻修真',
    subgenres: [
      ['fantasy_cultivation', '传统修真'],
      ['fantasy_martial', '高武世界'],
      ['fantasy_magic', '魔法大陆'],
      ['fantasy_bloodline', '血脉流']
    ]
  },
  xianxia: {
    label: '仙侠修真',
    subgenres: [
      ['xianxia_classic', '凡人流'],
      ['xianxia_genius', '天才流'],
      ['xianxia_sect', '宗门流']
    ]
  },
  scifi: {
    label: '科幻末世',
    subgenres: [
      ['scifi_apocalypse', '末世流'],
      ['scifi_interstellar', '星际文明'],
      ['scifi_cyberpunk', '赛博朋克'],
      ['scifi_time', '时空穿梭']
    ]
  },
  history: {
    label: '历史穿越',
    subgenres: [
      ['history_threekingdoms', '三国流'],
      ['history_tang', '大唐流'],
      ['history_ming', '大明流'],
      ['history_alternate', '架空历史']
    ]
  },
  game: {
    label: '游戏竞技',
    subgenres: [
      ['game_vrmmo', '虚拟网游'],
      ['game_esports', '电子竞技'],
      ['game_streamer', '主播流']
    ]
  },
  mystery: {
    label: '悬疑惊悚',
    subgenres: [
      ['mystery_horror', '恐怖灵异'],
      ['mystery_detective', '侦探推理'],
      ['mystery_survival', '求生无限']
    ]
  },
  sports: {
    label: '体育竞技',
    subgenres: [
      ['sports_basketball', '篮球'],
      ['sports_football', '足球'],
      ['sports_comprehensive', '综合体育']
    ]
  },
  lightnovel: {
    label: '轻小说动漫',
    subgenres: [
      ['light_acg', '二次元'],
      ['light_isekai', '异世界'],
      ['light_school', '校园恋爱']
    ]
  },
  fanfic: {
    label: '同人衍生',
    subgenres: [
      ['fanfic_anime', '动漫同人'],
      ['fanfic_novel', '小说同人'],
      ['fanfic_movie', '影视同人']
    ]
  },
  military: {
    label: '军事战争',
    subgenres: [
      ['military_modern', '现代军旅'],
      ['military_ancient', '古代战争'],
      ['military_mercenary', '雇佣兵']
    ]
  },
  western_fantasy: {
    label: '西幻魔幻',
    subgenres: [
      ['western_dnd', 'DND风格'],
      ['western_lord', '领主建设'],
      ['western_god', '封神流']
    ]
  },
  wuxia: {
    label: '传统武侠',
    subgenres: [
      ['wuxia_classic', '金庸风格'],
      ['wuxia_gulong', '古龙风格'],
      ['wuxia_unconventional', '新派武侠']
    ]
  },
  supernatural: {
    label: '灵异鬼怪',
    subgenres: [
      ['supernatural_fengshui', '风水相术'],
      ['supernatural_exorcism', '道士捉鬼'],
      ['supernatural_folklore', '民间传说']
    ]
  },
  system: {
    label: '系统流',
    subgenres: [
      ['system_signin', '签到流'],
      ['system_growth', '成长流'],
      ['system_shop', '商城流']
    ]
  }
};
const genreLabels = Object.fromEntries(Object.entries(genreCategoryMap).map(([key, value]) => [key, value.label]));
const subgenreLabels = Object.fromEntries(
  Object.values(genreCategoryMap).flatMap((item) => item.subgenres.map(([id, label]) => [id, label]))
);

const statusLabels = {
  writing: '连载中',
  completed: '已完结',
  paused: '暂停中'
};

const genreOptions = Object.entries(genreLabels);
const statusOptions = Object.entries(statusLabels);
function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function parseJsonObjectFromText(value) {
  const raw = String(value || '').trim();
  if (!raw) return {};
  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const direct = parseJsonObject(withoutFence);
  if (Object.keys(direct).length > 0) return direct;
  const matched = withoutFence.match(/\{[\s\S]*\}/);
  return matched ? parseJsonObject(matched[0]) : {};
}

function formatOutlineDraftValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (typeof item === 'string') return item.trim();
        if (!item || typeof item !== 'object') return '';
        const title = item.volume_title || item.title || item.name || item.stage || '';
        const number = item.volume_number || item.number || '';
        const summary = item.volume_summary || item.summary || item.description || item.content || '';
        const goal = item.stage_goal || item.goal || '';
        const conflict = item.core_conflict || item.conflict || '';
        return [
          title || number ? `第${number || index + 1}卷：${title || '未命名'}` : `第${index + 1}项`,
          summary,
          goal ? `阶段目标：${goal}` : '',
          conflict ? `核心冲突：${conflict}` : ''
        ].filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => {
        if (typeof item === 'string') return `${key}：${item}`;
        if (Array.isArray(item)) return `${key}：\n${formatOutlineDraftValue(item)}`;
        if (item && typeof item === 'object') return `${key}：\n${formatOutlineDraftValue([item])}`;
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  return String(value || '').trim();
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function buildChapterLibraryDraft(entry = null, chapterNumber = 1) {
  const plan = entry?.plan || {};
  const structuredContent = parseJsonObject(plan.structured_content || plan.structuredContent);
  const sceneOutline = parseJsonArray(plan.scene_outline);
  const generationSettings = parseJsonObject(structuredContent.generation_settings);
  return {
    volume_number: Number(plan.volume_number || 1),
    chapter_number: Number(entry?.chapterNumber || chapterNumber || 1),
    chapter_name: normalizeChapterName(plan.chapter_name || entry?.chapter?.chapter_name || entry?.chapter?.title || ''),
    summary: plan.summary || '',
    chapter_mission: plan.chapter_mission || '',
    emotion_target: plan.emotion_target || '',
    previous_hook: plan.previous_hook || '',
    outline_text: String(plan.outline_text || '').trim(),
    ending_hook: plan.ending_hook || '',
    scene_outline: sceneOutline,
    appearing_roles: parseJsonArray(plan.appearing_roles),
    role_execution: parseJsonArray(structuredContent.role_execution),
    main_storyline_id: plan.main_storyline_id || '',
    target_storylines: parseJsonArray(plan.target_storylines),
    source: plan.source || 'manual',
    structured_content: structuredContent,
    chapter_structure: {},
    generation_settings: {
      ...generationSettings,
      word_count: Number(generationSettings.word_count || 3000)
    }
  };
}

function requestJson(path, options = {}) {
  const token = localStorage.getItem('auth_token') || '';
  return fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    return payload.data;
  });
}

function formatWords(num) {
  const value = Number(num || 0);
  if (value >= 10000) return `${(value / 10000).toFixed(2)}万字`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k字`;
  return `${value}字`;
}

function formatDate(value) {
  if (!value) return '未知';
  return new Date(value).toLocaleString('zh-CN');
}

function getTextWordCount(text) {
  const value = String(text || '').replace(/\s+/g, '');
  return value.length;
}

function getChapterTitle(entry) {
  if (!entry) return '未命名章节';
  return normalizeChapterName(entry.plan?.chapter_name || entry.chapter?.chapter_name || entry.chapter?.title || '') || '未命名章节';
}

function splitReadableParagraphs(text) {
  return String(text || '')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getBookCoverInitials(book = {}) {
  const title = String(book.title || '书籍').trim() || '书籍';
  return Array.from(title).slice(0, 2).join('');
}

function getBookCoverGenreLabel(book = {}) {
  return genreLabels[book.genre] || book.genre || 'Novel';
}

function getPlatformLabel(value) {
  if (!value) return '未设置';
  if (value === 'qidian') return '起点中文网';
  if (value === 'fanqie') return '番茄小说';
  return value;
}

function buildDefaultRoleCounts() {
  return Object.fromEntries(roleTierOptions.map((item) => [item.value, item.defaultCount]));
}

function buildEmptyVolumePlanDraft() {
  return {
    volume_name: '',
    stage_goal: '',
    core_conflict: '',
    notes: '',
    cover_image: ''
  };
}

function getSubgenreOptions(genre) {
  return genreCategoryMap[genre]?.subgenres || [];
}

function confirmBulkClear(bookTitle, resourceName, count) {
  const safeBookTitle = String(bookTitle || '当前书籍').trim() || '当前书籍';
  if (!window.confirm(`确认清空《${safeBookTitle}》的全部${resourceName}吗？此操作不可恢复。`)) {
    return false;
  }

  const typedTitle = window.prompt(`为避免误操作，请输入书名“${safeBookTitle}”确认清空 ${count} 条${resourceName}。`, '');
  return typedTitle?.trim() === safeBookTitle;
}

function openWorkbench(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.sessionStorage.setItem('alipro-open-current-workbench', '1');
  window.location.href = buildAppPath('/workbench');
}

function openPromptManager(bookId) {
  if (!bookId) return;
  persistCurrentBookId(bookId);
  window.location.href = buildAppPath('/prompts');
}

function openBooksSummaryPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = buildAppPath(bookId ? `/books/${encodeURIComponent(bookId)}` : '/books');
}

function openBooksOutlinePage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = buildAppPath('/books/outlines');
}

function openBooksStorylinePage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = buildAppPath('/books/storylines');
}

function openBooksCharacterPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = buildAppPath('/books/characters');
}

function openBooksChapterPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = buildAppPath('/books/chapters');
}

function createEmptyForm() {
  return {
    title: '',
    genre: 'urban',
    subgenre: '',
    status: 'writing',
    author: '',
    description: '',
    cover_image: ''
  };
}

function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function loadImageMeta(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        reject(new Error('图片尺寸读取失败'));
        return;
      }
      resolve({ image, width, height });
    };
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = dataUrl;
  });
}

function buildSvgDataUrl(markup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
}

function createCharacterBadgeDataUrl(name = '角色') {
  const safeName = String(name || '角色').trim().slice(0, 4) || '角色';
  return buildSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1b2e47"/>
          <stop offset="100%" stop-color="#d7b071"/>
        </linearGradient>
        <radialGradient id="face" cx="50%" cy="38%" r="56%">
          <stop offset="0%" stop-color="#fff4d6"/>
          <stop offset="100%" stop-color="#dbc18e"/>
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="104" fill="url(#ring)"/>
      <circle cx="110" cy="110" r="92" fill="#f7f2e8"/>
      <circle cx="110" cy="110" r="84" fill="#24374f"/>
      <circle cx="110" cy="100" r="46" fill="url(#face)"/>
      <path d="M54 176C68 144 88 128 110 128C132 128 152 144 166 176Z" fill="#ead6a8"/>
      <text x="110" y="196" text-anchor="middle" font-size="28" font-weight="700" fill="#f8e8bb" font-family="'Microsoft YaHei', sans-serif">${safeName}</text>
    </svg>
  `);
}

export default function BooksPage() {
  const currentPath = getCurrentAppPathname();
  const routeBookIdMatch = currentPath.match(/^\/books\/(?!outlines$|storylines$|characters$|chapters$)([^/?#]+)$/);
  const routeBookId = routeBookIdMatch ? decodeURIComponent(routeBookIdMatch[1]) : '';
  const routeChapterReaderMatch = currentPath.match(/^\/books\/chapters\/(\d+)$/);
  const routeChapterNumber = routeChapterReaderMatch ? Number(routeChapterReaderMatch[1]) : 0;
  const initialSearchParams = new URLSearchParams(window.location.search);
  const initialRouteAction = initialSearchParams.get('action') || '';
  const initialRouteBookId = initialSearchParams.get('bookId') || routeBookId;
  const isOutlinePage = currentPath === '/books/outlines';
  const isCharacterPage = currentPath === '/books/characters';
  const isChapterPage = currentPath === '/books/chapters';
  const isChapterReaderPage = Boolean(routeChapterReaderMatch);
  const isChapterSectionPage = isChapterPage || isChapterReaderPage;
  const isSubPage = isOutlinePage || isCharacterPage || isChapterSectionPage;
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentBookId, setCurrentBookId] = useState(getStoredCurrentBookId());
  const [view, setView] = useState('list');
  const [detailBook, setDetailBook] = useState(null);
  const [detailOutline, setDetailOutline] = useState(null);
  const [detailVolumePlans, setDetailVolumePlans] = useState([]);
  const [detailStorylines, setDetailStorylines] = useState([]);
  const [detailCharacters, setDetailCharacters] = useState([]);
  const [detailChapters, setDetailChapters] = useState([]);
  const [detailChapterPlans, setDetailChapterPlans] = useState([]);
  const [readerChapterNumber, setReaderChapterNumber] = useState(Number.isFinite(routeChapterNumber) ? routeChapterNumber : 0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_desc');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [editorForm, setEditorForm] = useState(createEmptyForm());
  const [editorError, setEditorError] = useState('');
  const [outlineEditing, setOutlineEditing] = useState(false);
  const [outlineDraft, setOutlineDraft] = useState({ main_outline: '', volume_outline: '', detailed_outline: '' });
  const [outlineError, setOutlineError] = useState('');
  const [outlineNotice, setOutlineNotice] = useState('');
  const [outlineSaving, setOutlineSaving] = useState(false);
  const [outlineGenerating, setOutlineGenerating] = useState(false);
  const [targetVolumeCount, setTargetVolumeCount] = useState(0);
  const [volumePlanDrafts, setVolumePlanDrafts] = useState({});
  const [volumePlanSavingKey, setVolumePlanSavingKey] = useState('');
  const [editingVolumeKey, setEditingVolumeKey] = useState('');
  const [draggingVolumeKey, setDraggingVolumeKey] = useState('');
  const [characterDrafts, setCharacterDrafts] = useState({});
  const [editingCharacterKey, setEditingCharacterKey] = useState('');
  const [characterSavingKey, setCharacterSavingKey] = useState('');
  const [characterDeletingKey, setCharacterDeletingKey] = useState('');
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  const [newCharacterDraft, setNewCharacterDraft] = useState({
    name: '',
    personality: '',
    background: '',
    appearance: '',
    avatar_image: '',
    notes: '',
    character_type: 'main_character',
    role_tier: 'supporting_major'
  });
  const [characterNotice, setCharacterNotice] = useState('');
  const [characterError, setCharacterError] = useState('');
  const [aiCharacterOpen, setAiCharacterOpen] = useState(false);
  const [aiCharacterHint, setAiCharacterHint] = useState('');
  const [aiRoleCounts, setAiRoleCounts] = useState(() => buildDefaultRoleCounts());
  const [aiCharacterLoading, setAiCharacterLoading] = useState(false);
  const [avatarCropState, setAvatarCropState] = useState(null);
  const [chapterEditorOpen, setChapterEditorOpen] = useState(false);
  const [chapterDraft, setChapterDraft] = useState(() => buildChapterLibraryDraft(null, 1));
  const [chapterPlanSaving, setChapterPlanSaving] = useState(false);
  const [chapterPlanGenerating, setChapterPlanGenerating] = useState(false);
  const [chapterDeletingKey, setChapterDeletingKey] = useState('');
  const [chapterClearLoading, setChapterClearLoading] = useState(false);
  const [chapterPlanNotice, setChapterPlanNotice] = useState('');
  const [chapterPlanError, setChapterPlanError] = useState('');
  const [pendingRouteAction, setPendingRouteAction] = useState(initialRouteAction);
  const [pendingRouteBookId, setPendingRouteBookId] = useState(initialRouteBookId);
  const sidebarCollapsed = false;
  const sidebarPeek = false;

  const currentBook = useMemo(
    () => books.find((book) => book.id === currentBookId) || null,
    [books, currentBookId]
  );
  const isBookDetailPage = Boolean(routeBookId) || (view === 'detail' && detailBook && !isSubPage);
  const pageName = isOutlinePage
    ? '资料库 · 大纲链'
    : isCharacterPage
      ? '资料库 · 角色资料'
      : isChapterReaderPage
        ? '正文阅读'
        : isChapterPage
          ? '资料库 · 章节与正文'
        : isBookDetailPage
          ? '资料库 · 书籍详情'
          : '资料库 · 书籍列表';
  const pageDescription = isOutlinePage
    ? `当前大纲链：${detailBook?.title || currentBook?.title || '未命名书籍'}`
    : isCharacterPage
      ? `当前角色档案：${detailBook?.title || currentBook?.title || '未命名书籍'}`
      : isChapterReaderPage
        ? `当前正文阅读：${detailBook?.title || currentBook?.title || '未命名书籍'}`
        : isChapterPage
          ? `当前章节与正文：${detailBook?.title || currentBook?.title || '未命名书籍'}`
        : isBookDetailPage
          ? `当前书籍详情：${detailBook?.title || currentBook?.title || '未命名书籍'}`
          : '选择一本书进入详情，或使用筛选条件快速定位作品。';
  const shellBook = detailBook || currentBook;
  const shellBookId = shellBook?.id || currentBookId;

  useEffect(() => {
    if (pendingRouteBookId) {
      persistCurrentBookId(pendingRouteBookId);
      setCurrentBookId(pendingRouteBookId);
    }
  }, [pendingRouteBookId]);

  useEffect(() => {
    if (loading) return;
    if (!pendingRouteBookId || pendingRouteAction) return;
    if (detailBook?.id === pendingRouteBookId) {
      setPendingRouteBookId('');
      window.history.replaceState({}, '', currentPath);
      return;
    }
    loadDetail(pendingRouteBookId).finally(() => {
      setPendingRouteBookId('');
      window.history.replaceState({}, '', currentPath);
    });
  }, [loading, pendingRouteBookId, pendingRouteAction, detailBook, currentPath]);

  useEffect(() => {
    if (loading) return;
    if (!pendingRouteAction) return;
    if (pendingRouteAction === 'create') {
      openCreateEditor();
    } else if (pendingRouteAction === 'edit') {
      const targetBookId = pendingRouteBookId || currentBookId;
      if (!targetBookId) return;
      if (!detailBook || detailBook.id !== targetBookId) {
        loadDetail(targetBookId);
        return;
      }
      openEditEditor();
    } else {
      return;
    }
    setPendingRouteAction('');
    setPendingRouteBookId('');
    window.history.replaceState({}, '', currentPath);
  }, [loading, pendingRouteAction, pendingRouteBookId, currentBookId, detailBook]);

  const chapterEntries = useMemo(() => {
    const chapterMap = new Map();
    detailChapters.forEach((chapter) => {
      chapterMap.set(Number(chapter.chapter_number || 0), chapter);
    });
    const planMap = new Map();
    detailChapterPlans.forEach((plan) => {
      planMap.set(Number(plan.chapter_number || 0), plan);
    });
    const numbers = [...new Set([...chapterMap.keys(), ...planMap.keys()])]
      .filter((num) => Number.isFinite(num) && num > 0)
      .sort((a, b) => a - b);
    return numbers.map((chapterNumber) => ({
      chapterNumber,
      chapter: chapterMap.get(chapterNumber) || null,
      plan: planMap.get(chapterNumber) || null
    }));
  }, [detailChapters, detailChapterPlans]);
  const chapterTitleHistory = useMemo(
    () => chapterEntries.map((entry) => getChapterTitle(entry)).filter(Boolean),
    [chapterEntries]
  );
  const repeatedChapterPhrases = useMemo(
    () => extractRepeatedChapterPhrases(chapterTitleHistory),
    [chapterTitleHistory]
  );

  const readerChapterIndex = chapterEntries.findIndex((entry) => entry.chapterNumber === readerChapterNumber);
  const readerEntry = readerChapterIndex >= 0 ? chapterEntries[readerChapterIndex] : null;
  const previousReaderEntry = readerChapterIndex > 0 ? chapterEntries[readerChapterIndex - 1] : null;
  const nextReaderEntry = readerChapterIndex >= 0 && readerChapterIndex < chapterEntries.length - 1 ? chapterEntries[readerChapterIndex + 1] : null;

  useEffect(() => {
    const handlePopState = () => {
      const nextReaderMatch = getCurrentAppPathname().match(/^\/books\/chapters\/(\d+)$/);
      const nextChapter = nextReaderMatch ? Number(nextReaderMatch[1]) : 0;
      setReaderChapterNumber(Number.isFinite(nextChapter) ? nextChapter : 0);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function openChapterReader(chapterNumber) {
    setReaderChapterNumber(chapterNumber);
    window.history.pushState({}, '', buildAppPath(`/books/chapters/${encodeURIComponent(chapterNumber)}`));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeChapterReader() {
    setReaderChapterNumber(0);
    window.history.pushState({}, '', buildAppPath('/books/chapters'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    const nextDrafts = {};
    detailVolumePlans.forEach((plan) => {
      const key = String(Number(plan.volume_number || 1));
      nextDrafts[key] = {
        volume_name: plan.volume_name || '',
        stage_goal: plan.stage_goal || '',
        core_conflict: plan.core_conflict || '',
        notes: plan.notes || '',
        cover_image: plan.cover_image || ''
      };
    });
    setVolumePlanDrafts(nextDrafts);
  }, [detailVolumePlans]);

  useEffect(() => {
    const nextDrafts = {};
    detailCharacters.forEach((character) => {
      nextDrafts[String(character.id)] = {
        name: character.name || '',
        personality: character.personality || '',
        background: character.background || '',
        appearance: character.appearance || '',
        avatar_image: character.avatar_image || '',
        notes: character.notes || '',
        character_type: character.character_type || 'main_character',
        role_tier: character.role_tier || 'supporting_major'
      };
    });
    setCharacterDrafts(nextDrafts);
  }, [detailCharacters]);

  const filteredBooks = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    const matched = books.filter((book) => {
      const haystack = [book.title, book.author, book.description, book.genre].filter(Boolean).join(' ').toLowerCase();
      const matchesKeyword = !keyword || haystack.includes(keyword);
      const matchesStatus = statusFilter === 'all' || book.status === statusFilter;
      const matchesGenre = genreFilter === 'all' || book.genre === genreFilter;
      return matchesKeyword && matchesStatus && matchesGenre;
    });

    return [...matched].sort((a, b) => {
      if (sortBy === 'title_asc') {
        return String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN');
      }
      const aCreated = new Date(a.created_at || 0).getTime();
      const bCreated = new Date(b.created_at || 0).getTime();
      const aUpdated = new Date(a.updated_at || a.created_at || 0).getTime();
      const bUpdated = new Date(b.updated_at || b.created_at || 0).getTime();
      if (sortBy === 'updated_asc') return aUpdated - bUpdated;
      if (sortBy === 'created_desc') return bCreated - aCreated;
      if (sortBy === 'created_asc') return aCreated - bCreated;
      return bUpdated - aUpdated;
    });
  }, [books, searchText, statusFilter, genreFilter, sortBy]);

  const activeFilterCount = [
    searchText.trim(),
    statusFilter !== 'all',
    genreFilter !== 'all',
    sortBy !== 'updated_desc'
  ].filter(Boolean).length;

  async function loadLibrary() {
    setLoading(true);
    setError('');
    try {
      const [list, statsData] = await Promise.all([
        fetchBookList(),
        requestJson('/books/stats')
      ]);
      setBooks(list);
      setStats(statsData);

      const storedId = getStoredCurrentBookId();
      const nextId = list.some((book) => book.id === storedId) ? storedId : (list[0]?.id || '');
      if (nextId !== storedId) {
        persistCurrentBookId(nextId);
      }
      setCurrentBookId(nextId);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  useEffect(() => {
    if (!isSubPage || !currentBookId) return;
    if (detailBook?.id === currentBookId) return;
    loadDetail(currentBookId);
  }, [isSubPage, currentBookId]);

  async function loadDetail(bookId) {
    setView('detail');
    setDetailLoading(true);
    setError('');
    try {
      const [bookData, bookPlanRes, outlineRes, volumePlans, storylines, characterData, chapterData, chapterPlanData] = await Promise.all([
        requestJson(`/books/${bookId}`),
        requestJson(`/books/${bookId}/book-plan`).catch(() => null),
        requestJson(`/books/${bookId}/outline`).catch(() => null),
        requestJson(`/books/${bookId}/volume-plans`).catch(() => []),
        requestJson(`/storyline-workbench/${bookId}/storylines`).catch(() => []),
        requestJson(`/books/${bookId}/characters`).catch(() => []),
        requestJson(`/books/${bookId}/chapters`).catch(() => []),
        requestJson(`/books/${bookId}/chapter-plans`).catch(() => [])
      ]);
      const mergedPlan = bookPlanRes || outlineRes || null;
      setDetailBook(bookData);
      setDetailOutline(mergedPlan);
      setDetailVolumePlans(Array.isArray(volumePlans) ? volumePlans : []);
      setDetailStorylines(Array.isArray(storylines) ? storylines : []);
      setDetailCharacters(Array.isArray(characterData) ? characterData : []);
      setDetailChapters(Array.isArray(chapterData) ? chapterData : []);
      setDetailChapterPlans(Array.isArray(chapterPlanData) ? chapterPlanData : []);
    } catch (detailError) {
      setError(detailError.message);
      setView('list');
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreateEditor() {
    setEditorMode('create');
    setEditorForm(createEmptyForm());
    setEditorError('');
    setEditorOpen(true);
  }

  function openEditEditor() {
    if (!detailBook) return;
    setEditorMode('edit');
    setEditorForm({
      title: detailBook.title || '',
      genre: detailBook.genre || 'urban',
      subgenre: detailBook.subgenre || '',
      status: detailBook.status || 'writing',
      author: detailBook.author || '',
      description: detailBook.description || '',
      cover_image: detailBook.cover_image || ''
    });
    setEditorError('');
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
  }

  function startOutlineEditing() {
    setOutlineDraft({
      main_outline: detailOutline?.main_outline || '',
      volume_outline: '',
      detailed_outline: ''
    });
    setTargetVolumeCount(Math.max(0, detailVolumePlans.length || 0));
    setOutlineError('');
    setOutlineNotice('');
    setOutlineEditing(true);
  }

  function stopOutlineEditing() {
    if (outlineSaving) return;
    setOutlineEditing(false);
  }

  function goBackToList() {
    setView('list');
    setDetailBook(null);
    setDetailOutline(null);
    setDetailVolumePlans([]);
    setDetailStorylines([]);
    setDetailCharacters([]);
    setDetailChapters([]);
    setDetailChapterPlans([]);
    setCharacterNotice('');
    setCharacterError('');
    window.history.pushState({}, '', buildAppPath('/books'));
  }

  function setCurrentBook(bookId) {
    persistCurrentBookId(bookId);
    setCurrentBookId(bookId);
  }

  function switchCurrentBook(bookId) {
    if (!bookId || bookId === currentBookId) return;
    setCurrentBook(bookId);
    if (isSubPage) {
      window.location.href = buildAppPath(currentPath);
    } else if (isBookDetailPage) {
      openBooksSummaryPage(bookId);
    }
  }

  function openBookDetail(bookId) {
    if (!bookId) return;
    setCurrentBook(bookId);
    window.history.pushState({}, '', buildAppPath(`/books/${encodeURIComponent(bookId)}`));
    loadDetail(bookId);
  }

  function resetNewCharacterDraft(nextValues = {}) {
    setNewCharacterDraft({
      name: nextValues.name || '',
      personality: nextValues.personality || '',
      background: nextValues.background || '',
      appearance: nextValues.appearance || '',
      avatar_image: nextValues.avatar_image || '',
      notes: nextValues.notes || '',
      character_type: nextValues.character_type || 'main_character',
      role_tier: nextValues.role_tier || 'supporting_major'
    });
  }

  async function refreshDetail(bookId) {
    await Promise.all([loadLibrary(), loadDetail(bookId)]);
  }

  function updateCharacterDraft(characterId, field, value) {
    setCharacterDrafts((prev) => ({
      ...prev,
      [String(characterId)]: {
        ...(prev[String(characterId)] || {}),
        [field]: value
      }
    }));
  }

  async function openAvatarCropper(file, target) {
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      const meta = await loadImageMeta(dataUrl);
      const cropSize = 320;
      const baseScale = Math.max(cropSize / meta.width, cropSize / meta.height);
      const displayWidth = meta.width * baseScale;
      const displayHeight = meta.height * baseScale;
      setAvatarCropState({
        target,
        dataUrl,
        imageWidth: meta.width,
        imageHeight: meta.height,
        cropSize,
        scale: baseScale,
        offsetX: (cropSize - displayWidth) / 2,
        offsetY: (cropSize - displayHeight) / 2,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        startOffsetX: 0,
        startOffsetY: 0
      });
    } catch (cropError) {
      setCharacterError(cropError.message);
    }
  }

  function closeAvatarCropper() {
    setAvatarCropState(null);
  }

  function updateAvatarCropPosition(clientX, clientY) {
    setAvatarCropState((prev) => {
      if (!prev?.dragging) return prev;
      return {
        ...prev,
        offsetX: prev.startOffsetX + (clientX - prev.dragStartX),
        offsetY: prev.startOffsetY + (clientY - prev.dragStartY)
      };
    });
  }

  async function confirmAvatarCrop() {
    if (!avatarCropState) return;
    try {
      const meta = await loadImageMeta(avatarCropState.dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 640;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('裁剪画布初始化失败');

      const sourceScale = avatarCropState.scale;
      const sourceX = Math.max(0, -avatarCropState.offsetX / sourceScale);
      const sourceY = Math.max(0, -avatarCropState.offsetY / sourceScale);
      const sourceSize = avatarCropState.cropSize / sourceScale;

      context.drawImage(
        meta.image,
        sourceX,
        sourceY,
        Math.min(sourceSize, meta.width - sourceX),
        Math.min(sourceSize, meta.height - sourceY),
        0,
        0,
        640,
        640
      );

      const croppedDataUrl = canvas.toDataURL('image/png');

      if (avatarCropState.target?.type === 'new') {
        resetNewCharacterDraft({ ...newCharacterDraft, avatar_image: croppedDataUrl });
      } else if (avatarCropState.target?.type === 'edit' && avatarCropState.target.characterId) {
        updateCharacterDraft(avatarCropState.target.characterId, 'avatar_image', croppedDataUrl);
      }

      closeAvatarCropper();
    } catch (cropError) {
      setCharacterError(cropError.message);
    }
  }

  async function handleSaveCharacter(characterId) {
    if (!detailBook?.id) return;
    const draft = characterDrafts[String(characterId)];
    if (!draft?.name?.trim()) {
      setCharacterError('角色名不能为空。');
      return;
    }

    setCharacterSavingKey(String(characterId));
    setCharacterError('');
    setCharacterNotice('');
    try {
      await requestJson(`/books/${detailBook.id}/characters/${characterId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: draft.name.trim(),
          personality: draft.personality || '',
          background: draft.background || '',
          appearance: draft.appearance || '',
          avatar_image: draft.avatar_image || '',
          notes: draft.notes || '',
          character_type: draft.character_type || 'main_character',
          role_tier: draft.role_tier || 'supporting_major'
        })
      });
      await refreshDetail(detailBook.id);
      setEditingCharacterKey('');
      setCharacterNotice('角色档案已保存。');
    } catch (saveError) {
      setCharacterError(saveError.message);
    } finally {
      setCharacterSavingKey('');
    }
  }

  async function handleDeleteCharacter(characterId, characterName) {
    if (!detailBook?.id) return;
    const normalizedName = String(characterName || '').trim() || '该角色';
    if (!window.confirm(`确定删除角色“${normalizedName}”吗？`)) {
      return;
    }

    setCharacterDeletingKey(String(characterId));
    setCharacterError('');
    setCharacterNotice('');
    try {
      await requestJson(`/books/${detailBook.id}/characters/${characterId}`, {
        method: 'DELETE'
      });
      await refreshDetail(detailBook.id);
      if (editingCharacterKey === String(characterId)) {
        setEditingCharacterKey('');
      }
      setCharacterNotice(`角色“${normalizedName}”已删除。`);
    } catch (deleteError) {
      setCharacterError(deleteError.message);
    } finally {
      setCharacterDeletingKey('');
    }
  }

  async function handleCreateCharacter() {
    if (!detailBook?.id) return;
    if (!newCharacterDraft.name.trim()) {
      setCharacterError('角色名不能为空。');
      return;
    }

    setCharacterSavingKey('new');
    setCharacterError('');
    setCharacterNotice('');
    try {
      await requestJson(`/books/${detailBook.id}/characters`, {
        method: 'POST',
        body: JSON.stringify({
          name: newCharacterDraft.name.trim(),
          personality: newCharacterDraft.personality || '',
          background: newCharacterDraft.background || '',
          appearance: newCharacterDraft.appearance || '',
          avatar_image: newCharacterDraft.avatar_image || '',
          notes: newCharacterDraft.notes || '',
          character_type: newCharacterDraft.character_type || 'main_character',
          role_tier: newCharacterDraft.role_tier || 'supporting_major'
        })
      });
      await refreshDetail(detailBook.id);
      setCreatingCharacter(false);
      resetNewCharacterDraft();
      setAiCharacterOpen(false);
      setAiCharacterHint('');
      setCharacterNotice('角色档案已新增。');
    } catch (saveError) {
      setCharacterError(saveError.message);
    } finally {
      setCharacterSavingKey('');
    }
  }

  async function handleGenerateCharacterCard() {
    if (!detailBook?.id) return;

    setAiCharacterLoading(true);
    setCharacterError('');
    setCharacterNotice('');
    try {
      const generatedList = await requestJson(`/books/${detailBook.id}/characters/generate-batch`, {
        method: 'POST',
        body: JSON.stringify({
          role_counts: aiRoleCounts,
          hint: aiCharacterHint
        })
      });
      const generated = Array.isArray(generatedList) ? generatedList : [];
      if (generated.length === 0) {
        throw new Error('模型没有返回可用角色卡');
      }
      for (const item of generated) {
        await requestJson(`/books/${detailBook.id}/characters`, {
          method: 'POST',
          body: JSON.stringify({
            name: item.name || '未命名角色',
            personality: item.personality || '',
                            background: item.background || '',
                            appearance: item.appearance || '',
                            avatar_image: '',
                            notes: '',
                            character_type: 'main_character',
                            role_tier: item.role_tier || 'supporting_major'
          })
        });
      }
      await refreshDetail(detailBook.id);
      setCharacterNotice(`AI 已生成 ${generated.length} 张角色卡。`);
    } catch (generateError) {
      setCharacterError(generateError.message);
    } finally {
      setAiCharacterLoading(false);
    }
  }

  async function handleClearCharacters() {
    if (!detailBook?.id) return;
    if (!confirmBulkClear(detailBook.title, '角色档案', detailCharacters.length)) {
      return;
    }

    setDeleteLoading(true);
    setCharacterError('');
    setCharacterNotice('');
    try {
      const result = await requestJson(`/books/${detailBook.id}/characters`, {
        method: 'DELETE'
      });
      await refreshDetail(detailBook.id);
      setEditingCharacterKey('');
      setCreatingCharacter(false);
      setAiCharacterOpen(false);
      setCharacterNotice(`已清空 ${Number(result?.deletedCount || 0)} 条角色档案。`);
    } catch (deleteError) {
      setCharacterError(deleteError.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function submitEditor(event) {
    event.preventDefault();
    const title = editorForm.title.trim();
    const genre = editorForm.genre.trim();
    const subgenre = editorForm.subgenre.trim();
    if (!title) return setEditorError('书名不能为空。');
    if (!genre) return setEditorError('题材不能为空。');

    setSaving(true);
    setEditorError('');
    try {
      const payload = {
        title,
        genre,
        subgenre,
        status: editorForm.status,
        author: editorForm.author.trim(),
        description: editorForm.description.trim(),
        cover_image: editorForm.cover_image || ''
      };

      if (editorMode === 'create') {
        const created = await createBook(payload);
        if (created?.id) {
          setCurrentBook(created.id);
          await refreshDetail(created.id);
        }
      } else if (detailBook?.id) {
        await updateBook(detailBook.id, payload);
        await refreshDetail(detailBook.id);
      }
      setEditorOpen(false);
    } catch (saveError) {
      setEditorError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBook(bookId) {
    if (!window.confirm('确定要删除这本书吗？')) return;
    setDeleteLoading(true);
    try {
      await requestJson(`/books/${bookId}`, { method: 'DELETE' });
      if (detailBook?.id === bookId) {
        goBackToList();
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
      await loadLibrary();
    } catch (deleteError) {
      alert(`删除失败：${deleteError.message}`);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function batchDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确定删除已选的 ${selectedIds.size} 本书吗？`)) return;
    setDeleteLoading(true);
    try {
      await requestJson('/books/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: [...selectedIds] })
      });
      setSelectedIds(new Set());
      await loadLibrary();
    } catch (deleteError) {
      alert(`删除失败：${deleteError.message}`);
    } finally {
      setDeleteLoading(false);
    }
  }

  function focusCurrentBook() {
    if (!currentBookId) return;
    setView('list');
    const node = document.querySelector(`[data-book-id="${currentBookId}"]`);
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredBooks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBooks.map((book) => book.id)));
    }
  }

  function toggleBookSelected(bookId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }

  async function handleSaveOutline() {
    if (!detailBook?.id) return;
    setOutlineSaving(true);
    setOutlineError('');
    setOutlineNotice('');
    try {
      await saveOutlineSummary(detailBook.id, {
        main_outline: outlineDraft.main_outline || ''
      });
      await refreshDetail(detailBook.id);
      setOutlineNotice('大纲摘要已保存。');
      setOutlineEditing(false);
    } catch (saveError) {
      setOutlineError(saveError.message);
    } finally {
      setOutlineSaving(false);
    }
  }

  async function handleGenerateFullOutlineDraft() {
    if (!detailBook?.id) return;
    setOutlineGenerating(true);
    setOutlineError('');
    setOutlineNotice('');
    try {
      const characters = detailCharacters
        .filter((item) => String(item.name || '').trim() && String(item.name || '').trim() !== '全书角色设定')
        .map((item) => [
          `角色：${item.name || ''}`,
          item.role_tier ? `定位：${getRoleTierShortLabel(item.role_tier)}` : '',
          item.personality ? `性格：${item.personality}` : '',
          item.background ? `背景：${item.background}` : '',
          item.appearance ? `外形：${item.appearance}` : ''
        ].filter(Boolean).join('；'))
        .join('\n');
      const result = await generateFullOutlineDraft({
        genre: detailBook.genre || 'urban',
        subgenre: detailBook.subgenre || '',
        bookTitle: detailBook.title || '',
        description: detailBook.description || '',
        characters
      });
      const parsed = parseJsonObjectFromText(result?.content || '');
      const nextDraft = {
        main_outline: formatOutlineDraftValue(parsed.main_outline || parsed.mainOutline || ''),
        volume_outline: '',
        detailed_outline: ''
      };
      if (!nextDraft.main_outline) {
        throw new Error('AI 返回的大纲草案无法解析，请稍后重试。');
      }
      setOutlineDraft(nextDraft);
      setOutlineEditing(true);
      setOutlineNotice('已生成完整大纲草案，请检查后保存。');
    } catch (generateError) {
      setOutlineError(generateError.message);
    } finally {
      setOutlineGenerating(false);
    }
  }

  async function handleGenerateVolumePlans() {
    if (!detailBook?.id) return;
    setOutlineSaving(true);
    setOutlineError('');
    setOutlineNotice('');
    try {
      const result = await generateVolumePlansFromBookPlan(detailBook.id, {
        overwrite: true,
        targetVolumeCount
      });
      await refreshDetail(detailBook.id);
      const count = Number(result?.generatedCount || result?.plans?.length || 0);
      setOutlineNotice(count > 0 ? `已刷新 ${count} 条分卷大纲。` : '已执行自动拆分，请检查分卷结果。');
    } catch (generateError) {
      setOutlineError(generateError.message);
    } finally {
      setOutlineSaving(false);
    }
  }

  function updateVolumePlanDraft(volumeNumber, field, value) {
    const key = String(Number(volumeNumber || 1));
    setVolumePlanDrafts((prev) => ({
      ...prev,
      [key]: {
        ...buildEmptyVolumePlanDraft(),
        ...(prev[key] || {}),
        [field]: value
      }
    }));
  }

  async function handleCreateVolumePlan() {
    if (!detailBook?.id) return;
    const nextVolumeNumber = Math.max(0, ...detailVolumePlans.map((plan) => Number(plan.volume_number || 0))) + 1;
    setVolumePlanSavingKey(`create-${nextVolumeNumber}`);
    setOutlineError('');
    setOutlineNotice('');
    try {
      await requestJson(`/books/${detailBook.id}/volume-plans/${nextVolumeNumber}`, {
        method: 'POST',
        body: JSON.stringify({
          volume_number: nextVolumeNumber,
          volume_name: '',
          stage_goal: '',
          core_conflict: '',
          notes: '',
          cover_image: '',
          source: 'manual',
          status: 'draft'
        })
      });
      await refreshDetail(detailBook.id);
      setTargetVolumeCount(nextVolumeNumber);
      setEditingVolumeKey(String(nextVolumeNumber));
      setOutlineNotice(`已新增第 ${nextVolumeNumber} 卷。`);
    } catch (saveError) {
      setOutlineError(saveError.message);
    } finally {
      setVolumePlanSavingKey('');
    }
  }

  async function handleSaveVolumePlan(volumeNumber) {
    if (!detailBook?.id) return;
    const key = String(Number(volumeNumber || 1));
    const draft = volumePlanDrafts[key];
    if (!draft) return;
    setVolumePlanSavingKey(key);
    setOutlineError('');
    setOutlineNotice('');
    try {
      await requestJson(`/books/${detailBook.id}/volume-plans/${key}`, {
        method: 'POST',
        body: JSON.stringify({
          volume_number: Number(key),
          volume_name: draft.volume_name || '',
          stage_goal: draft.stage_goal || '',
          core_conflict: draft.core_conflict || '',
          notes: draft.notes || '',
          cover_image: draft.cover_image || '',
          source: 'manual',
          status: 'draft'
        })
      });
      await refreshDetail(detailBook.id);
      setOutlineNotice(`第 ${key} 卷已保存。`);
      setEditingVolumeKey('');
    } catch (saveError) {
      setOutlineError(saveError.message);
    } finally {
      setVolumePlanSavingKey('');
    }
  }

  async function handleDeleteVolumePlan(volumeNumber) {
    if (!detailBook?.id) return;
    if (!window.confirm(`确认删除第 ${volumeNumber} 卷吗？后续卷号会自动前移。`)) {
      return;
    }

    setVolumePlanSavingKey(`delete-${volumeNumber}`);
    setOutlineError('');
    setOutlineNotice('');
    try {
      await requestJson(`/books/${detailBook.id}/volume-plans/${volumeNumber}`, {
        method: 'DELETE'
      });
      await refreshDetail(detailBook.id);
      setTargetVolumeCount((current) => Math.max(0, current - 1));
      setEditingVolumeKey('');
      setOutlineNotice(`第 ${volumeNumber} 卷已删除。`);
    } catch (deleteError) {
      setOutlineError(deleteError.message);
    } finally {
      setVolumePlanSavingKey('');
    }
  }

  async function reorderVolumePlans(nextVolumeNumbers) {
    if (!detailBook?.id) return;
    setOutlineSaving(true);
    setOutlineError('');
    setOutlineNotice('');
    try {
      await requestJson(`/books/${detailBook.id}/volume-plans/reorder`, {
        method: 'POST',
        body: JSON.stringify({
          volume_numbers: nextVolumeNumbers
        })
      });
      await refreshDetail(detailBook.id);
      setOutlineNotice('分卷顺序已更新。');
    } catch (reorderError) {
      setOutlineError(reorderError.message);
    } finally {
      setDraggingVolumeKey('');
      setOutlineSaving(false);
    }
  }

  function handleVolumeDragStart(volumeNumber) {
    setDraggingVolumeKey(String(volumeNumber));
  }

  async function handleVolumeDrop(targetVolumeNumber) {
    const sourceVolumeNumber = Number(draggingVolumeKey || 0);
    if (!sourceVolumeNumber || sourceVolumeNumber === targetVolumeNumber) {
      setDraggingVolumeKey('');
      return;
    }

    const currentOrder = detailVolumePlans
      .slice()
      .sort((left, right) => Number(left.volume_number || 0) - Number(right.volume_number || 0))
      .map((plan) => Number(plan.volume_number || 0))
      .filter((item) => Number.isFinite(item) && item > 0);
    const sourceIndex = currentOrder.indexOf(sourceVolumeNumber);
    const targetIndex = currentOrder.indexOf(targetVolumeNumber);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingVolumeKey('');
      return;
    }

    const nextOrder = currentOrder.slice();
    const [movedVolumeNumber] = nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, movedVolumeNumber);
    await reorderVolumePlans(nextOrder);
  }

  function getDefaultStorylineSelection(volumeNumber) {
    const volumeStorylines = detailStorylines.filter((item) => Number(item.volume_number || 1) === Number(volumeNumber || 1));
    const mainStoryline = volumeStorylines.find((item) => ['main', '主线'].includes(String(item.storyline_type || '').trim().toLowerCase()))
      || volumeStorylines[0]
      || null;
    return {
      main_storyline_id: mainStoryline?.id || '',
      target_storylines: volumeStorylines.map((item) => item.id).filter(Boolean)
    };
  }

  function openChapterPlanEditor(entry = null) {
    const nextChapterNumber = entry?.chapterNumber
      || Math.max(1, ...chapterEntries.map((item) => Number(item.chapterNumber || 0))) + (chapterEntries.length > 0 ? 1 : 0);
    const nextDraft = buildChapterLibraryDraft(entry, nextChapterNumber);
    const defaultStorylineSelection = getDefaultStorylineSelection(nextDraft.volume_number);
    setChapterDraft({
      ...nextDraft,
      main_storyline_id: nextDraft.main_storyline_id || defaultStorylineSelection.main_storyline_id,
      target_storylines: nextDraft.target_storylines.length > 0
        ? nextDraft.target_storylines
        : defaultStorylineSelection.target_storylines
    });
    setChapterPlanNotice('');
    setChapterPlanError('');
    setChapterEditorOpen(true);
  }

  function updateChapterDraftField(field, value) {
    setChapterDraft((current) => {
      if (field === 'volume_number') {
        return {
          ...current,
          volume_number: value,
          ...getDefaultStorylineSelection(value)
        };
      }
      return { ...current, [field]: value };
    });
  }

  function resizeChapterOutlineTextarea(textarea) {
    if (!textarea) return;
    const minHeight = 120;
    const maxHeight = 420;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  function buildLibraryChapterSaveDraft(sourceDraft = chapterDraft) {
    const {
      chapter_outline_structure: _legacyStructure,
      chapter_outline_snapshot: _legacySnapshot,
      ...remainingStructuredContent
    } = sourceDraft.structured_content || {};
    return {
      ...sourceDraft,
      outline_text: String(sourceDraft.outline_text || '').trim(),
      ending_hook: '',
      scene_outline: [],
      chapter_structure: {},
      structured_content: {
        ...remainingStructuredContent,
        chapter_outline_mode: 'single_latest',
        generation_settings: {
          ...(remainingStructuredContent.generation_settings || {}),
          ...(sourceDraft.generation_settings || {})
        }
      }
    };
  }

  async function handleSaveLibraryChapterPlan() {
    if (!detailBook?.id) return;
    const nextDraft = buildLibraryChapterSaveDraft();
    setChapterPlanSaving(true);
    setChapterPlanError('');
    setChapterPlanNotice('');
    try {
      await saveChapterPlan(detailBook.id, nextDraft.chapter_number, nextDraft);
      await refreshDetail(detailBook.id);
      setChapterDraft(nextDraft);
      setChapterPlanNotice(`第 ${nextDraft.chapter_number} 章细纲已保存。`);
    } catch (saveError) {
      setChapterPlanError(saveError.message || '章节细纲保存失败');
    } finally {
      setChapterPlanSaving(false);
    }
  }

  async function handleGenerateLibraryChapterPlan() {
    if (!detailBook?.id) return;
    const sourceDraft = buildLibraryChapterSaveDraft();
    setChapterPlanGenerating(true);
    setChapterPlanError('');
    setChapterPlanNotice('');
    try {
      await saveChapterPlan(detailBook.id, sourceDraft.chapter_number, sourceDraft);
      const generated = await generateChapterOutline({
        bookId: detailBook.id,
        chapterNumber: sourceDraft.chapter_number,
        genre: detailBook.genre || 'urban',
        subgenre: detailBook.subgenre || '',
        bookTitle: detailBook.title || '',
        chapterTitle: formatLibraryChapterTitle(sourceDraft.chapter_number, sourceDraft.chapter_name),
        characters: detailCharacters.map((item) => item.name).filter(Boolean).join(' / ')
      });
      const generatedText = String(generated?.content || generated || '').trim();
      if (!generatedText) throw new Error('AI 没有返回可用章节细纲');
      const shouldGenerateChapterName = !normalizeChapterName(sourceDraft.chapter_name);
      const generatedChapterName = shouldGenerateChapterName
        ? await generateChapterName({
          genre: detailBook.genre || 'urban',
          subgenre: detailBook.subgenre || '',
          chapterNumber: sourceDraft.chapter_number,
          outlineText: generatedText,
          bookTitle: detailBook.title || '',
          recentTitles: chapterTitleHistory,
          avoidPhrases: repeatedChapterPhrases
        })
        : null;
      const resolvedChapterName = shouldGenerateChapterName
        ? String(generatedChapterName?.content || generatedChapterName || '').trim()
        : normalizeChapterName(sourceDraft.chapter_name || '');
      const nextDraft = buildLibraryChapterSaveDraft({
        ...sourceDraft,
        source: 'ai',
        chapter_name: resolvedChapterName,
        outline_text: generatedText
      });
      await saveChapterPlan(detailBook.id, nextDraft.chapter_number, nextDraft);
      await refreshDetail(detailBook.id);
      setChapterDraft(nextDraft);
      setChapterPlanNotice(`第 ${nextDraft.chapter_number} 章细纲已由 AI 生成并保存。`);
    } catch (generateError) {
      setChapterPlanError(generateError.message || 'AI 生成章节细纲失败');
    } finally {
      setChapterPlanGenerating(false);
    }
  }

  async function handleDeleteLibraryChapter(entry) {
    if (!detailBook?.id || !entry?.chapterNumber) return;
    const chapterNumber = Number(entry.chapterNumber || 0);
    const chapterTitle = getChapterTitle(entry);
    if (!window.confirm(`确定删除第 ${chapterNumber} 章${chapterTitle ? `《${chapterTitle}》` : ''}吗？这会一并删除细纲和正文。`)) {
      return;
    }

    setChapterDeletingKey(String(chapterNumber));
    setChapterPlanError('');
    setChapterPlanNotice('');
    try {
      await requestJson(`/books/${detailBook.id}/chapters/${chapterNumber}`, {
        method: 'DELETE'
      });
      await refreshDetail(detailBook.id);
      if (readerChapterNumber === chapterNumber) {
        closeChapterReader();
      }
      if (chapterEditorOpen && Number(chapterDraft.chapter_number || 0) === chapterNumber) {
        setChapterEditorOpen(false);
      }
      setChapterPlanNotice(`第 ${chapterNumber} 章已删除。`);
    } catch (deleteError) {
      setChapterPlanError(deleteError.message);
    } finally {
      setChapterDeletingKey('');
    }
  }

  async function handleClearLibraryChapters() {
    if (!detailBook?.id || chapterEntries.length === 0) return;
    if (!confirmBulkClear(detailBook.title, '章节（含正文与细纲）', chapterEntries.length)) {
      return;
    }

    setChapterClearLoading(true);
    setChapterPlanError('');
    setChapterPlanNotice('');
    try {
      const result = await requestJson(`/books/${detailBook.id}/chapters`, { method: 'DELETE' });
      closeChapterReader();
      setChapterEditorOpen(false);
      await refreshDetail(detailBook.id);
      const deletedCount = Math.max(
        Number(result?.deletedChapterCount || 0),
        Number(result?.deletedPlanCount || 0)
      );
      setChapterPlanNotice(`已清空 ${deletedCount} 章，书籍及其他资料已保留。`);
    } catch (clearError) {
      setChapterPlanError(clearError.message || '清空章节失败');
    } finally {
      setChapterClearLoading(false);
    }
  }

  const readerTitle = getChapterTitle(readerEntry);
  const readerContent = readerEntry?.chapter?.content || '';
  const readerParagraphs = splitReadableParagraphs(readerContent);
  const readerWordCount = readerEntry?.chapter?.word_count || getTextWordCount(readerContent);
  const readerStructuredContent = parseJsonObject(readerEntry?.plan?.structured_content);
  const readerFeedback = readerStructuredContent.chapter_feedback || null;

  return (
    <>
    <style>{`
      .books-page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 1.75rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--line); }
      .books-page-header h1 { margin: 0; font-family: var(--font-serif); font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: 900; line-height: 1.15; letter-spacing: -0.03em; color: var(--text); }
      .books-page-header-sub { margin: 0.35rem 0 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
      .books-page-prompt-entry { flex: 0 0 auto; height: 30px; padding: 0 11px; border: 1px solid color-mix(in srgb, var(--brand) 28%, var(--line)); border-radius: 999px; background: color-mix(in srgb, var(--brand-soft) 28%, transparent); color: var(--brand-deep); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
      .books-page-prompt-entry:hover:not(:disabled) { border-color: var(--brand); background: color-mix(in srgb, var(--brand-soft) 58%, transparent); }
      .books-page-prompt-entry:disabled { cursor: not-allowed; opacity: 0.45; }
      .library-book-switcher { display: grid; gap: 5px; color: var(--muted); font-size: 12px; font-weight: 700; }
      .library-book-switcher select { width: 100%; min-width: 0; border: 1px solid var(--line); border-radius: var(--radius-panel-sm); background: var(--panel-strong); color: var(--text); padding: 7px 8px; font: inherit; font-size: 13px; }
      .books-page-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 1.5rem; }
      .books-page-stat-card { border: 1px solid var(--line); border-radius: var(--radius-panel-lg); background: var(--panel); padding: 16px 20px; }
      .books-page-stat-value { display: block; font-size: 1.5rem; font-weight: 900; line-height: 1; color: var(--brand); letter-spacing: -0.03em; }
      .books-page-stat-label { display: block; margin-top: 6px; font-size: 12px; font-weight: 600; color: var(--muted); }
      @media (max-width: 980px) { .books-page-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 560px) { .books-page-stats { grid-template-columns: 1fr; } }
      .books-page-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 1.5rem; padding: 12px 16px; border: 1px solid var(--line); border-radius: var(--radius-panel-md); background: var(--panel); }
      .books-page-toolbar-input, .books-page-toolbar-select { height: 36px; border: 1px solid var(--line); border-radius: var(--radius-panel-md); background: var(--panel-strong); color: var(--text); padding: 0 12px; font: inherit; font-size: 13px; outline: none; transition: border-color 160ms ease; min-width: 0; }
      .books-page-toolbar-input { flex: 1 1 220px; }
      .books-page-toolbar-select { flex: 0 1 140px; cursor: pointer; }
      .books-page-toolbar-input:focus, .books-page-toolbar-select:focus { border-color: var(--brand); }
      .books-page-toolbar-sep { width: 1px; height: 24px; background: var(--line); flex: 0 0 auto; }
      .books-page-toolbar-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 16px; border: 1px solid var(--line); border-radius: var(--radius-panel-md); background: transparent; color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: border-color 140ms ease, background 140ms ease; }
      .books-page-toolbar-btn:hover { border-color: color-mix(in srgb, var(--brand) 36%, var(--line)); background: color-mix(in srgb, var(--brand-soft) 48%, transparent); }
      .books-page-toolbar-btn-primary { background: var(--btn-solid-bg); color: var(--btn-solid-text); border-color: var(--btn-solid-border); }
      .books-page-toolbar-btn-primary:hover { opacity: 0.92; }
      .books-page-toolbar-info { margin-left: auto; font-size: 12px; color: var(--muted); white-space: nowrap; }
      @media (max-width: 720px) { .books-page-toolbar-input { flex: 1 1 100%; } .books-page-toolbar-select { flex: 1 1 calc(50% - 5px); } .books-page-toolbar-sep { display: none; } .books-page-toolbar-info { width: 100%; margin-left: 0; } }
      .books-page-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
      @media (max-width: 1200px) { .books-page-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 720px) { .books-page-grid { grid-template-columns: 1fr; } }
      .books-page-card { position: relative; border: 1px solid var(--line); border-radius: var(--radius-panel-lg); background: var(--panel); padding: 20px; cursor: pointer; transition: border-color 180ms ease, box-shadow 180ms ease; }
      .books-page-card:hover { border-color: var(--brand); box-shadow: 0 8px 24px -6px color-mix(in srgb, var(--brand) 10%, transparent); }
      .books-page-card-select { position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel-strong); color: var(--brand); font-size: 13px; font-weight: 900; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 140ms ease, border-color 140ms ease; }
      .books-page-card-select:hover, .books-page-card-select.is-selected { border-color: var(--brand); background: color-mix(in srgb, var(--brand-soft) 72%, white); }
      .books-page-card-title { margin: 0 0 8px; font-family: var(--font-serif); font-size: 1.2rem; font-weight: 900; line-height: 1.25; letter-spacing: -0.025em; color: var(--text); }
      .books-page-card-author { margin: 0 0 10px; font-size: 13px; color: var(--muted); }
      .books-page-card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
      .books-page-card-genre { display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px; border-radius: 999px; background: color-mix(in srgb, var(--brand-soft) 58%, var(--panel-strong)); color: var(--brand-deep); font-size: 11px; font-weight: 700; }
      .books-page-card-status { display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
      .books-page-card-status-writing { background: var(--status-success-bg); border: 1px solid var(--status-success-border); color: #3d6b45; }
      .books-page-card-status-completed { background: var(--status-warning-bg); border: 1px solid var(--status-warning-border); color: #8b6914; }
      .books-page-card-status-paused { background: color-mix(in srgb, var(--muted) 8%, var(--panel-strong)); border: 1px solid color-mix(in srgb, var(--line) 60%, transparent); color: var(--muted); }
      .books-page-card-stats { display: flex; flex-wrap: wrap; gap: 12px; padding-top: 12px; border-top: 1px dashed var(--line); font-size: 12px; color: var(--muted); }
      .books-page-card-stat-item { display: flex; align-items: center; gap: 4px; }
      .books-page-card-stat-label { color: var(--muted); }
      .books-page-card-stat-value { color: var(--text); font-weight: 700; }
      .books-page-card-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
      .books-page-card-action-btn { height: 28px; padding: 0 10px; border: 1px solid var(--line); border-radius: var(--radius-panel-sm); background: transparent; color: var(--muted); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: border-color 140ms ease, color 140ms ease, background 140ms ease; }
      .books-page-card-action-btn:hover { border-color: var(--brand); color: var(--brand-deep); background: color-mix(in srgb, var(--brand-soft) 36%, transparent); }
      .books-page-card-current { display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px; border-radius: 999px; background: color-mix(in srgb, var(--brand-soft) 72%, var(--panel)); color: var(--brand-deep); font-size: 11px; font-weight: 700; white-space: nowrap; }
    `}</style>
    <div className={joinClasses('books-admin-page library-app-shell', sidebarCollapsed ? 'is-sidebar-collapsed' : '', sidebarCollapsed && sidebarPeek ? 'is-sidebar-peek' : '', isChapterReaderPage ? 'is-chapter-reader-page' : '')}>
      {!isChapterReaderPage ? (
        <>
          <aside
            className="library-sidebar"
            aria-label="资料库导航"
          >
        <div className="library-sidebar-head">
          <div className="library-surface-switcher">
            <button
              type="button"
              className="library-surface-entry is-primary"
              onClick={goBackToList}
              title="返回资料库列表"
              aria-current="page"
            >
              <span className="library-sidebar-kicker">书籍管理</span>
              <strong>资料库</strong>
            </button>
            <button
              type="button"
              className="library-surface-entry is-secondary"
              onClick={() => openWorkbench(shellBookId)}
              title="切换到创作台"
            >
              <span className="library-sidebar-kicker">章节创作</span>
              <strong>创作台</strong>
            </button>
          </div>
        </div>

        <nav className="library-sidebar-nav" aria-label="资料库页面">
          <button type="button" data-short="列" className={joinClasses('library-nav-item', view === 'list' && !isSubPage ? 'is-active' : '')} onClick={goBackToList} title="书籍列表">
            书籍列表
          </button>
          <button type="button" data-short="总" className={joinClasses('library-nav-item', isBookDetailPage && !isSubPage ? 'is-active' : '')} onClick={() => openBooksSummaryPage(shellBookId)} disabled={!shellBookId} title="全书汇总">
            全书汇总
          </button>
          <button type="button" data-short="纲" className={joinClasses('library-nav-item', isOutlinePage ? 'is-active' : '')} onClick={() => openBooksOutlinePage(shellBookId)} disabled={!shellBookId} title="大纲链">
            大纲链
          </button>
          <button type="button" data-short="脉" className="library-nav-item" onClick={() => openBooksStorylinePage(shellBookId)} disabled={!shellBookId} title="叙事脉络">
            叙事脉络
          </button>
          <button type="button" data-short="角" className={joinClasses('library-nav-item', isCharacterPage ? 'is-active' : '')} onClick={() => openBooksCharacterPage(shellBookId)} disabled={!shellBookId} title="角色资料">
            角色资料
          </button>
          <button type="button" data-short="章" className={joinClasses('library-nav-item', isChapterPage ? 'is-active' : '')} onClick={() => openBooksChapterPage(shellBookId)} disabled={!shellBookId} title="章节与正文">
            章节与正文
          </button>
        </nav>
        <div className="library-sidebar-section">
          <div className="library-sidebar-context">
            <span>当前操作书籍</span>
            <strong>{shellBook?.title || '请先选择书籍'}</strong>
          </div>
          {books.length > 1 ? (
            <label className="library-book-switcher">
              <span>切换书籍</span>
              <select value={currentBookId} onChange={(event) => switchCurrentBook(event.target.value)}>
                {books.map((book) => <option key={book.id} value={book.id}>{book.title || '未命名书籍'}</option>)}
              </select>
            </label>
          ) : null}
          {!shellBookId ? <p className="library-sidebar-note">先在书籍列表选择或新建一本书，才能进入资料库分页面。</p> : null}
        </div>

          </aside>
        </>
      ) : null}

      <main className="library-main">
        <div className="books-page-header">
          <div>
            <h1>{pageName}</h1>
            <p className="books-page-header-sub">{pageDescription}</p>
          </div>
          {view === 'list' && !isSubPage ? (
            <button
              type="button"
              className="books-page-prompt-entry"
              onClick={() => openPromptManager(shellBookId)}
              disabled={!shellBookId}
              title={shellBookId ? '配置当前书籍 AI 生成时使用的提示词' : '请先选择一本当前书籍'}
              aria-label="配置当前书籍的 AI 生成提示词"
            >
              提示词配置
            </button>
          ) : null}
        </div>
        {error ? <div className="global-banner is-error">{error}</div> : null}

      {view === 'list' && !isCharacterPage ? (
        <>
          {stats ? (
            <div className="books-page-stats">
              {[
                ['书籍总数', stats.totalBooks || 0],
                ['章节总数', stats.totalChapters || 0],
                ['累计字数', formatWords(stats.totalWords || 0)],
                ['角色总数', stats.totalCharacters || 0],
                ['7天内更新', stats.recent7Days || 0]
              ].map(([label, value]) => (
                <div key={label} className="books-page-stat-card">
                  <strong className="books-page-stat-value">{value}</strong>
                  <span className="books-page-stat-label">{label}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="books-page-toolbar">
            <input
              className="books-page-toolbar-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="书名 / 作者 / 简介"
            />
            <select
              className="books-page-toolbar-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">全部状态</option>
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select
              className="books-page-toolbar-select"
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
            >
              <option value="all">全部题材</option>
              {genreOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select
              className="books-page-toolbar-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="updated_desc">最近更新</option>
              <option value="updated_asc">最早更新</option>
              <option value="created_desc">最近创建</option>
              <option value="created_asc">最早创建</option>
              <option value="title_asc">书名 A-Z</option>
            </select>
            <span className="books-page-toolbar-sep" />
            <button type="button" className="books-page-toolbar-btn books-page-toolbar-btn-primary" onClick={openCreateEditor}>新建书籍</button>
            <button type="button" className="books-page-toolbar-btn" onClick={loadLibrary}>刷新列表</button>
            <span className="books-page-toolbar-info">{loading ? '正在读取书籍资料...' : `显示 ${filteredBooks.length}/${books.length} 本 · 筛选 ${activeFilterCount} 项`}</span>
          </div>

          {loading ? (
            <div className="global-banner">正在加载书籍列表...</div>
          ) : (
            <div className="books-page-grid">
              {filteredBooks.length === 0 ? (
                <div className="global-banner">
                  {books.length === 0 ? '还没有书籍，先新建一本吧。' : '没有符合当前筛选条件的书籍。'}
                </div>
              ) : (
                filteredBooks.map((book) => {
                  const isCurrent = book.id === currentBookId;
                  const isSelected = selectedIds.has(book.id);
                  const statusClass = book.status === 'writing' ? 'books-page-card-status-writing'
                    : book.status === 'completed' ? 'books-page-card-status-completed'
                    : 'books-page-card-status-paused';
                  return (
                    <div
                      key={book.id}
                      data-book-id={book.id}
                      className="books-page-card"
                      onClick={() => openBookDetail(book.id)}
                    >
                      <button
                        type="button"
                        className={joinClasses('books-page-card-select', isSelected ? 'is-selected' : '')}
                        aria-pressed={isSelected}
                        aria-label={isSelected ? `取消选择《${book.title || '未命名书籍'}》` : `选择《${book.title || '未命名书籍'}》`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookSelected(book.id);
                        }}
                      >
                        {isSelected ? '✓' : ''}
                      </button>
                      <h3 className="books-page-card-title">{book.title || '未命名书籍'}</h3>
                      {book.author ? <p className="books-page-card-author">{book.author}</p> : null}
                      <div className="books-page-card-meta">
                        <span className="books-page-card-genre">
                          {genreLabels[book.genre] || book.genre}
                          {book.subgenre ? ` · ${subgenreLabels[book.subgenre] || book.subgenre}` : ''}
                        </span>
                        <span className={joinClasses('books-page-card-status', statusClass)}>
                          {statusLabels[book.status] || book.status}
                        </span>
                      </div>
                      <div className="books-page-card-stats">
                        <span className="books-page-card-stat-item">
                          <span className="books-page-card-stat-label">字数</span>
                          <span className="books-page-card-stat-value">{(book.word_count || 0) > 0 ? formatWords(book.word_count || 0) : '暂无'}</span>
                        </span>
                        <span className="books-page-card-stat-item">
                          <span className="books-page-card-stat-label">更新</span>
                          <span className="books-page-card-stat-value">{book.updated_at || book.created_at ? formatDate(book.updated_at || book.created_at) : '刚创建'}</span>
                        </span>
                      </div>
                      <div className="books-page-card-actions">
                        {!isCurrent ? (
                          <button
                            type="button"
                            className="books-page-card-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentBook(book.id);
                            }}
                          >
                            设为当前
                          </button>
                        ) : (
                          <span className="books-page-card-current">当前使用中</span>
                        )}
                        <button
                          type="button"
                          className="books-page-card-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBook(book.id);
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      ) : null}

      {isCharacterPage && detailBook ? (
        <section className="mt-8">
          <div className="detail-header">
            <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksSummaryPage(detailBook.id)}>返回汇总页</button>
            <div className="detail-header-main">
              <h2>{detailBook.title}</h2>
              <div className="detail-header-meta">
                <span className="detail-meta-chip">角色资料页</span>
                {detailBook.id === currentBookId ? <span className="detail-meta-chip">当前使用中</span> : null}
              </div>
            </div>
          </div>

          {detailLoading ? (
            <div className="global-banner">正在加载角色资料...</div>
          ) : (
            <div className="detail-grid detail-grid-character">
              <div className="detail-main">
                <div className="detail-panel">
                  <div className="detail-panel-actions">
                    <h3>角色档案（{detailCharacters.length}）</h3>
                    <div className="detail-inline-actions">
                      <button type="button" className="ghost-btn" onClick={() => {
                        setAiCharacterOpen((prev) => !prev);
                        setCharacterError('');
                        setCharacterNotice('');
                        setAiRoleCounts(buildDefaultRoleCounts());
                      }}>
                        {aiCharacterOpen ? '收起 AI 生成' : 'AI 生成角色卡'}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn detail-danger-btn"
                        onClick={handleClearCharacters}
                        disabled={deleteLoading || detailCharacters.length === 0}
                      >
                        {deleteLoading ? '清空中...' : '清空全部角色（不可恢复）'}
                      </button>
                      <button type="button" className="solid-btn" onClick={() => {
                        setCreatingCharacter((prev) => !prev);
                        setCharacterError('');
                        setCharacterNotice('');
                        if (!creatingCharacter) {
                          resetNewCharacterDraft();
                        }
                      }}>
                        {creatingCharacter ? '收起新建' : '新建角色'}
                      </button>
                    </div>
                  </div>
                  {characterError ? <div className="global-banner is-error">{characterError}</div> : null}
                  {characterNotice ? <div className="global-banner">{characterNotice}</div> : null}
                  {aiCharacterOpen ? (
                    <div className="detail-inline-editor detail-character-ai-box">
                      <div className="detail-character-role-grid">
                        {roleTierOptions.map((option) => {
                          const current = Number(aiRoleCounts[option.value] || 0);
                          const exceeded = current > option.max;
                          return (
                            <label key={option.value} className={`detail-inline-field detail-role-count-field${exceeded ? ' is-warning' : ''}`}>
                              <span>{option.shortLabel}</span>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={current}
                                onChange={(e) => setAiRoleCounts((prev) => ({
                                  ...prev,
                                  [option.value]: Math.max(0, Math.min(10, Number(e.target.value) || 0))
                                }))}
                              />
                              <em>{option.softLimit}</em>
                            </label>
                          );
                        })}
                      </div>
                      <label className="detail-inline-field">
                        <span>补充提示</span>
                        <textarea
                          rows={4}
                          value={aiCharacterHint}
                          onChange={(e) => setAiCharacterHint(e.target.value)}
                          placeholder="例如：希望主角偏隐忍成长型，主要配角里有一位理性同伴和一位立场暧昧的压迫型对手。"
                        />
                      </label>
                      <div className="detail-character-metric-strip">
                        <span>输出指标：核心性格</span>
                        <span>身份背景</span>
                        <span>外形标记</span>
                      </div>
                      <div className="detail-inline-actions">
                        <button type="button" className="solid-btn" onClick={handleGenerateCharacterCard} disabled={aiCharacterLoading}>
                          {aiCharacterLoading ? '生成中...' : '生成角色卡'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {creatingCharacter ? (
                    <article className="detail-character-item detail-character-item-editing">
                      <div className="detail-section-head">
                        <strong>新角色</strong>
                        <div className="detail-inline-actions">
                          <button type="button" className="ghost-btn" onClick={() => {
                            setCreatingCharacter(false);
                            resetNewCharacterDraft();
                          }} disabled={characterSavingKey === 'new'}>
                            取消
                          </button>
                          <button type="button" className="ghost-btn" onClick={handleCreateCharacter} disabled={characterSavingKey === 'new'}>
                            {characterSavingKey === 'new' ? '保存中...' : '保存角色'}
                          </button>
                        </div>
                      </div>
                      <div className="detail-inline-editor">
                        <label className="detail-inline-field">
                          <span>角色头像</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                await openAvatarCropper(file, { type: 'new' });
                              } catch (fileError) {
                                setCharacterError(fileError.message);
                              } finally {
                                e.target.value = '';
                              }
                            }}
                          />
                          <em>上传后可拖动裁剪区域，再确认保存。</em>
                        </label>
                        {newCharacterDraft.avatar_image ? (
                          <div className="detail-cover-preview">
                            <img src={newCharacterDraft.avatar_image} alt="角色头像预览" className="detail-character-avatar-preview" />
                          </div>
                        ) : null}
                        <label className="detail-inline-field">
                          <span>角色名</span>
                          <input value={newCharacterDraft.name} onChange={(e) => resetNewCharacterDraft({ ...newCharacterDraft, name: e.target.value })} placeholder="输入角色名" />
                        </label>
                        <label className="detail-inline-field">
                          <span>核心性格</span>
                          <textarea rows={3} value={newCharacterDraft.personality} onChange={(e) => resetNewCharacterDraft({ ...newCharacterDraft, personality: e.target.value })} placeholder="长期稳定的性格底色" />
                        </label>
                        <label className="detail-inline-field">
                          <span>身份背景</span>
                          <textarea rows={3} value={newCharacterDraft.background} onChange={(e) => resetNewCharacterDraft({ ...newCharacterDraft, background: e.target.value })} placeholder="出身、阵营、身份位置" />
                        </label>
                        <label className="detail-inline-field">
                          <span>外形标记</span>
                          <textarea rows={2} value={newCharacterDraft.appearance} onChange={(e) => resetNewCharacterDraft({ ...newCharacterDraft, appearance: e.target.value })} placeholder="最有辨识度的外观特征" />
                        </label>
                        <label className="detail-inline-field">
                          <span>角色定位</span>
                          <select value={newCharacterDraft.role_tier} onChange={(e) => resetNewCharacterDraft({ ...newCharacterDraft, role_tier: e.target.value })}>
                            {roleTierOptions.map((option) => <option key={option.value} value={option.value}>{option.shortLabel}</option>)}
                          </select>
                        </label>
                      </div>
                    </article>
                  ) : null}
                  {detailCharacters.length > 0 ? (
                    <div className="detail-character-list">
                      {detailCharacters.map((character) => (
                        (() => {
                          const characterKey = String(character.id);
                          const draft = characterDrafts[characterKey] || {
                            name: character.name || '',
                            personality: character.personality || '',
                            background: character.background || '',
                            appearance: character.appearance || '',
                            avatar_image: character.avatar_image || '',
                            notes: character.notes || '',
                            character_type: character.character_type || 'main_character',
                            role_tier: character.role_tier || 'supporting_major'
                          };
                          const isEditingCurrent = editingCharacterKey === characterKey;
                          const isSavingCurrent = characterSavingKey === characterKey;

                          return (
                            <article key={character.id} className={`detail-character-item detail-character-item-${draft.role_tier || character.role_tier || 'supporting_major'}`}>
                              <div className="detail-section-head">
                                <div className="detail-character-title">
                                  <img
                                    className="detail-character-avatar"
                                    src={draft.avatar_image || character.avatar_image || createCharacterBadgeDataUrl(draft.name || character.name || '角色')}
                                    alt={`${draft.name || character.name || '角色'}头像`}
                                  />
                                  <strong>{draft.name || character.name || '未命名角色'}</strong>
                                  <span className={`detail-role-tier-badge detail-role-tier-badge-${draft.role_tier || character.role_tier || 'supporting_major'}`}>
                                    {getRoleTierShortLabel(draft.role_tier || character.role_tier || 'supporting_major')}
                                  </span>
                                </div>
                                <div className="detail-inline-actions">
                                  {isEditingCurrent ? (
                                    <>
                                      <button type="button" className="ghost-btn" onClick={() => setEditingCharacterKey('')} disabled={isSavingCurrent}>
                                        取消
                                      </button>
                                      <button type="button" className="ghost-btn" onClick={() => handleSaveCharacter(character.id)} disabled={isSavingCurrent}>
                                        {isSavingCurrent ? '保存中...' : '保存角色'}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button type="button" className="ghost-btn" onClick={() => setEditingCharacterKey(characterKey)} disabled={characterDeletingKey === characterKey}>
                                        编辑
                                      </button>
                                      <button
                                        type="button"
                                        className="ghost-btn"
                                        onClick={() => handleDeleteCharacter(character.id, draft.name || character.name)}
                                        disabled={characterDeletingKey === characterKey}
                                      >
                                        {characterDeletingKey === characterKey ? '删除中...' : '删除'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {isEditingCurrent ? (
                                <div className="detail-inline-editor">
                                  <label className="detail-inline-field">
                                    <span>角色头像</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                          await openAvatarCropper(file, { type: 'edit', characterId: character.id });
                                        } catch (fileError) {
                                          setCharacterError(fileError.message);
                                        } finally {
                                          e.target.value = '';
                                        }
                                      }}
                                    />
                                    <em>上传后可拖动裁剪区域，再确认保存。</em>
                                  </label>
                                  {(draft.avatar_image || character.avatar_image) ? (
                                    <div className="detail-cover-preview">
                                      <img src={draft.avatar_image || character.avatar_image} alt={`${draft.name || character.name || '角色'}头像预览`} className="detail-character-avatar-preview" />
                                    </div>
                                  ) : null}
                                  <label className="detail-inline-field">
                                    <span>角色名</span>
                                    <input value={draft.name} onChange={(e) => updateCharacterDraft(character.id, 'name', e.target.value)} placeholder="输入角色名" />
                                  </label>
                                  <label className="detail-inline-field">
                                    <span>核心性格</span>
                                    <textarea rows={3} value={draft.personality} onChange={(e) => updateCharacterDraft(character.id, 'personality', e.target.value)} placeholder="长期稳定的性格底色" />
                                  </label>
                                  <label className="detail-inline-field">
                                    <span>身份背景</span>
                                    <textarea rows={3} value={draft.background} onChange={(e) => updateCharacterDraft(character.id, 'background', e.target.value)} placeholder="出身、阵营、身份位置" />
                                  </label>
                                  <label className="detail-inline-field">
                                    <span>外形标记</span>
                                    <textarea rows={2} value={draft.appearance} onChange={(e) => updateCharacterDraft(character.id, 'appearance', e.target.value)} placeholder="最有辨识度的外观特征" />
                                  </label>
                                  <label className="detail-inline-field">
                                    <span>角色定位</span>
                                    <select value={draft.role_tier || 'supporting_major'} onChange={(e) => updateCharacterDraft(character.id, 'role_tier', e.target.value)}>
                                      {roleTierOptions.map((option) => <option key={option.value} value={option.value}>{option.shortLabel}</option>)}
                                    </select>
                                  </label>
                                </div>
                              ) : (
                                <div className="detail-character-metric-list">
                                  {character.personality ? <p className="excerpt-text"><b>核心性格：</b>{character.personality}</p> : null}
                                  {character.background ? <p className="excerpt-text"><b>身份背景：</b>{character.background}</p> : null}
                                  {character.appearance ? <p className="excerpt-text"><b>外形标记：</b>{character.appearance}</p> : null}
                                </div>
                              )}
                            </article>
                          );
                        })()
                      ))}
                    </div>
                  ) : (
                    <p className="excerpt-text">暂无角色档案。</p>
                  )}
                </div>
              </div>

            </div>
          )}
        </section>
      ) : null}

      {view === 'detail' && detailBook && isOutlinePage ? (
        <section className="mt-8">
          <div className="detail-header">
            <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksSummaryPage(detailBook.id)}>返回汇总页</button>
            <div className="detail-header-main">
              <h2>{detailBook.title}</h2>
              <div className="detail-header-meta">
                <span className="detail-meta-chip">大纲链页面</span>
                {detailBook.id === currentBookId ? <span className="detail-meta-chip">当前使用中</span> : null}
              </div>
            </div>
          </div>

          {detailLoading ? (
            <div className="global-banner">正在加载大纲链...</div>
          ) : (
            <div className="detail-grid">
              <div className="detail-main">
                <div className="detail-panel">
                  {outlineError ? <div className="global-banner is-error">{outlineError}</div> : null}
                  {outlineNotice ? <div className="global-banner">{outlineNotice}</div> : null}
                  <div className="detail-outline-grid">
                    <div className="detail-outline-section">
                      <div className="detail-section-head">
                        <strong>全书大纲</strong>
                        <div className="detail-inline-actions">
                          {outlineEditing ? (
                            <>
                              <button type="button" className="ghost-btn" onClick={stopOutlineEditing} disabled={outlineSaving || outlineGenerating}>
                                取消
                              </button>
                              <button type="button" className="ghost-btn" onClick={handleSaveOutline} disabled={outlineSaving || outlineGenerating}>
                                {outlineSaving ? '保存中...' : '保存'}
                              </button>
                            </>
                          ) : (
                            <button type="button" className="ghost-btn" onClick={startOutlineEditing} disabled={outlineGenerating}>
                              编辑
                            </button>
                          )}
                          <button type="button" className="ghost-btn detail-inline-primary-action" onClick={handleGenerateFullOutlineDraft} disabled={outlineSaving || outlineGenerating}>
                            {outlineGenerating ? '生成中...' : 'AI 生成完整大纲'}
                          </button>
                        </div>
                      </div>
                      {outlineEditing ? (
                        <div className="detail-inline-editor">
                          <label className="detail-inline-field is-wide">
                            <span>全书大纲</span>
                            <textarea
                              rows={8}
                              value={outlineDraft.main_outline}
                              onChange={(e) => setOutlineDraft((prev) => ({ ...prev, main_outline: e.target.value }))}
                              placeholder="写这本书整体在讲什么。"
                            />
                          </label>
                        </div>
                      ) : detailOutline?.main_outline ? (
                        <IndentedTextBlock
                          text={detailOutline.main_outline}
                          className="detail-pre"
                          paragraphClassName="detail-pre-paragraph"
                        />
                      ) : (
                        <p className="excerpt-text">暂无全书大纲。</p>
                      )}
                    </div>
                    <div className="detail-outline-section">
                      <div className="detail-section-head">
                        <strong>分卷大纲</strong>
                        <div className="detail-inline-toolbar">
                          <label className="detail-inline-count-group">
                            <span className="detail-inline-count-label">目标卷数</span>
                            <input className="detail-inline-count-input" type="number" min="0" max="12" value={targetVolumeCount} onChange={(e) => setTargetVolumeCount(Math.max(0, Math.min(12, Number(e.target.value) || 0)))} />
                          </label>
                          <button type="button" className="ghost-btn" onClick={handleCreateVolumePlan} disabled={outlineSaving}>
                            新增一卷
                          </button>
                          <button type="button" className="ghost-btn detail-inline-primary-action" onClick={handleGenerateVolumePlans} disabled={outlineSaving}>
                            {outlineSaving ? '处理中...' : '自动拆分分卷'}
                          </button>
                          <span className="detail-inline-toolbar-hint">填 0 让模型自定卷数。</span>
                        </div>
                      </div>
                      {detailVolumePlans.length > 0 ? (
                        <div className="detail-volume-plan-list">
                          {detailVolumePlans
                            .slice()
                            .sort((left, right) => Number(left.volume_number || 0) - Number(right.volume_number || 0))
                            .map((plan) => {
                              const volumeNumber = Number(plan.volume_number || 0) || 1;
                              const draft = volumePlanDrafts[String(volumeNumber)] || {
                                ...buildEmptyVolumePlanDraft(),
                                volume_name: plan.volume_name || '',
                                stage_goal: plan.stage_goal || '',
                                core_conflict: plan.core_conflict || '',
                                notes: plan.notes || '',
                                cover_image: plan.cover_image || ''
                              };
                              const volumeKey = String(volumeNumber);
                              const isSavingCurrent = volumePlanSavingKey === volumeKey;
                              const isDeletingCurrent = volumePlanSavingKey === `delete-${volumeNumber}`;
                              const isEditingCurrent = editingVolumeKey === volumeKey;
                              const volumeCoverImage = isEditingCurrent ? draft.cover_image : plan.cover_image;
                              return (
                                <article
                                  key={plan.id || `${plan.book_id}-${plan.volume_number}`}
                                  className={`detail-outline-volume detail-volume-card${volumeCoverImage ? ' has-volume-cover' : ''}${draggingVolumeKey === volumeKey ? ' is-dragging' : ''}`}
                                  draggable={!outlineSaving}
                                  onDragStart={() => handleVolumeDragStart(volumeNumber)}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={() => handleVolumeDrop(volumeNumber)}
                                >
                                  {volumeCoverImage ? (
                                    <aside className="detail-volume-cover-rail" aria-label={`第${volumeNumber}卷封面`}>
                                      <img src={volumeCoverImage} alt={`第${volumeNumber}卷封面`} className="detail-volume-cover-side" />
                                    </aside>
                                  ) : null}
                                  <div className="detail-volume-content">
                                    <div className="detail-section-head">
                                      <div className="detail-volume-title-line">
                                        <span className="detail-volume-drag-handle" title="拖拽排序">⋮⋮</span>
                                        <span className="detail-volume-index">VOL.{String(volumeNumber).padStart(2, '0')}</span>
                                        <strong>第 {volumeNumber} 卷 · {draft.volume_name || plan.volume_name || '未命名分卷'}</strong>
                                      </div>
                                      <div className="detail-inline-actions">
                                        {isEditingCurrent ? (
                                          <>
                                            <button type="button" className="ghost-btn" onClick={() => setEditingVolumeKey('')} disabled={isSavingCurrent}>
                                              取消
                                            </button>
                                            <button type="button" className="ghost-btn" onClick={() => handleSaveVolumePlan(volumeNumber)} disabled={isSavingCurrent || outlineSaving}>
                                              {isSavingCurrent ? '保存中...' : '保存本卷'}
                                            </button>
                                            <button type="button" className="ghost-btn" onClick={() => handleDeleteVolumePlan(volumeNumber)} disabled={isSavingCurrent || isDeletingCurrent || outlineSaving}>
                                              {isDeletingCurrent ? '删除中...' : '删除本卷'}
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button type="button" className="ghost-btn" onClick={() => setEditingVolumeKey(volumeKey)} disabled={outlineSaving}>
                                              编辑
                                            </button>
                                            <button type="button" className="ghost-btn" onClick={() => handleDeleteVolumePlan(volumeNumber)} disabled={isDeletingCurrent || outlineSaving}>
                                              {isDeletingCurrent ? '删除中...' : '删除'}
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="detail-volume-copy">
                                      {isEditingCurrent ? (
                                        <div className="detail-inline-editor">
                                          <label className="detail-inline-field">
                                            <span>分卷封面</span>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                try {
                                                  const dataUrl = await readImageFileAsDataUrl(file);
                                                  updateVolumePlanDraft(volumeNumber, 'cover_image', dataUrl);
                                                } catch (fileError) {
                                                  setOutlineError(fileError.message);
                                                } finally {
                                                  e.target.value = '';
                                                }
                                              }}
                                            />
                                          </label>
                                          <label className="detail-inline-field">
                                            <span>卷名</span>
                                            <input value={draft.volume_name} onChange={(e) => updateVolumePlanDraft(volumeNumber, 'volume_name', e.target.value)} placeholder="输入分卷名" />
                                          </label>
                                          <label className="detail-inline-field">
                                            <span>阶段目标</span>
                                            <textarea rows={3} value={draft.stage_goal} onChange={(e) => updateVolumePlanDraft(volumeNumber, 'stage_goal', e.target.value)} placeholder="这一卷要完成什么推进" />
                                          </label>
                                          <label className="detail-inline-field">
                                            <span>核心冲突</span>
                                            <textarea rows={3} value={draft.core_conflict} onChange={(e) => updateVolumePlanDraft(volumeNumber, 'core_conflict', e.target.value)} placeholder="这一卷最核心的冲突" />
                                          </label>
                                          <label className="detail-inline-field">
                                            <span>卷内说明</span>
                                            <textarea rows={4} value={draft.notes} onChange={(e) => updateVolumePlanDraft(volumeNumber, 'notes', e.target.value)} placeholder="写卷内推进、关键转折和收束方向" />
                                          </label>
                                        </div>
                                      ) : (
                                        <div className="detail-inline-display">
                                          {plan.stage_goal ? <p className="excerpt-text"><b>阶段目标：</b>{plan.stage_goal}</p> : null}
                                          {plan.core_conflict ? <p className="excerpt-text"><b>核心冲突：</b>{plan.core_conflict}</p> : null}
                                          {plan.notes ? <p className="excerpt-text"><b>卷内说明：</b>{plan.notes}</p> : null}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="excerpt-text">暂无分卷卡片，请先自动拆分分卷。</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </section>
      ) : null}

      {view === 'detail' && detailBook && isChapterSectionPage ? (
        <section className="chapter-library-page mt-8">
          {detailLoading ? (
            <div className="global-banner">正在加载章节与正文...</div>
          ) : isChapterReaderPage ? (
            readerEntry ? (
            <article className="chapter-reader-shell">
              <div className="chapter-reader-toolbar">
                <button type="button" className="ghost-btn nav-btn" onClick={closeChapterReader}>返回目录</button>
                <div className="chapter-reader-switch">
                  <button type="button" className="ghost-btn nav-btn" onClick={() => previousReaderEntry && openChapterReader(previousReaderEntry.chapterNumber)} disabled={!previousReaderEntry}>上一章</button>
                  <button type="button" className="ghost-btn nav-btn" onClick={() => nextReaderEntry && openChapterReader(nextReaderEntry.chapterNumber)} disabled={!nextReaderEntry}>下一章</button>
                </div>
              </div>

              <header className="chapter-reader-head">
                <span className="chapter-reader-kicker">CHAPTER {String(readerEntry.chapterNumber).padStart(2, '0')}</span>
                <h2>第 {readerEntry.chapterNumber} 章 · {readerTitle}</h2>
                <div className="chapter-reader-meta">
                  <span>{formatWords(readerWordCount)}</span>
                  <span>{formatDate(readerEntry.chapter?.updated_at || readerEntry.plan?.updated_at || readerEntry.chapter?.created_at || readerEntry.plan?.created_at)}</span>
                  {readerEntry.chapter?.content ? <span>正文已保存</span> : <span>仅有章节资料</span>}
                </div>
              </header>

              {readerFeedback ? (
                <details className="chapter-reader-audit">
                  <summary>生成记录</summary>
                  <div>
                    {readerFeedback.chapter_summary ? <p><b>章节摘要：</b>{readerFeedback.chapter_summary}</p> : null}
                    {readerFeedback.character_progress ? <p><b>人物推进：</b>{readerFeedback.character_progress}</p> : null}
                    {readerFeedback.story_progress ? <p><b>剧情推进：</b>{readerFeedback.story_progress}</p> : null}
                    {readerFeedback.next_chapter_focus ? <p><b>后续承接：</b>{readerFeedback.next_chapter_focus}</p> : null}
                  </div>
                </details>
              ) : null}

              {readerEntry.plan?.outline_text ? (
                <aside className="chapter-reader-note">
                  <p><b>章节细纲：</b>{readerEntry.plan.outline_text}</p>
                </aside>
              ) : null}

              {readerParagraphs.length > 0 ? (
                <div className="chapter-reader-prose">
                  {readerParagraphs.map((paragraph, index) => (
                    <p key={`reader-paragraph-${readerEntry.chapterNumber}-${index}`}>{paragraph}</p>
                  ))}
                </div>
              ) : (
                <div className="chapter-reader-empty">
                  <strong>正文尚未生成</strong>
                  <p>这一章目前只有细纲或摘要，可以回到创作台继续生成正文。</p>
                  <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(detailBook.id)}>去创作台继续写</button>
                </div>
              )}

              <footer className="chapter-reader-footer">
                <button type="button" className="ghost-btn nav-btn" onClick={() => previousReaderEntry && openChapterReader(previousReaderEntry.chapterNumber)} disabled={!previousReaderEntry}>
                  {previousReaderEntry ? `上一章：${getChapterTitle(previousReaderEntry)}` : '已是第一章'}
                </button>
                <button type="button" className="ghost-btn nav-btn" onClick={closeChapterReader}>目录</button>
                <button type="button" className="ghost-btn nav-btn" onClick={() => nextReaderEntry && openChapterReader(nextReaderEntry.chapterNumber)} disabled={!nextReaderEntry}>
                  {nextReaderEntry ? `下一章：${getChapterTitle(nextReaderEntry)}` : '已是最后一章'}
                </button>
              </footer>
            </article>
            ) : (
              <div className="chapter-reader-empty">
                <strong>没有找到这一章</strong>
                <p>当前作品里还没有对应章节，或者章节编号已经变化。</p>
                <button type="button" className="ghost-btn nav-btn" onClick={closeChapterReader}>返回章节目录</button>
              </div>
            )
          ) : (
            <div className="chapter-flow-board">
              <div className="chapter-flow-head">
                <div>
                  <span className="chapter-reader-kicker">Chapter Index</span>
                  <h2>{detailBook.title}</h2>
                  <p>按章节浏览资料，点击章节名称进入正文阅读。</p>
                </div>
                <div className="detail-inline-actions">
                  <button type="button" className="ghost-btn nav-btn detail-danger-btn" onClick={handleClearLibraryChapters} disabled={chapterClearLoading || chapterEntries.length === 0} title="会删除正文和细纲，且不可恢复">{chapterClearLoading ? '清空中...' : '清空全部章节（不可恢复）'}</button>
                  <button type="button" className="ghost-btn nav-btn" onClick={() => openChapterPlanEditor(null)} disabled={chapterClearLoading}>新增章节细纲</button>
                  <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(detailBook.id)}>去创作台继续写</button>
                </div>
              </div>

              {chapterEditorOpen ? (
                <section className="chapter-plan-full-editor">
                  <div className="detail-panel-actions">
                    <div>
                      <span className="chapter-reader-kicker">CHAPTER PLAN</span>
                      <h3>第 {chapterDraft.chapter_number} 章细纲设置</h3>
                    </div>
                    <div className="detail-inline-actions">
                      <button type="button" className="ghost-btn" onClick={() => setChapterEditorOpen(false)} disabled={chapterPlanSaving || chapterPlanGenerating}>收起</button>
                      <button type="button" className="ghost-btn" onClick={handleSaveLibraryChapterPlan} disabled={chapterPlanSaving || chapterPlanGenerating}>{chapterPlanSaving ? '保存中...' : '保存细纲'}</button>
                      <button type="button" className="solid-btn" onClick={handleGenerateLibraryChapterPlan} disabled={chapterPlanSaving || chapterPlanGenerating}>{chapterPlanGenerating ? 'AI 生成中...' : 'AI 生成并保存细纲'}</button>
                    </div>
                  </div>
                  {chapterPlanError ? <div className="global-banner is-error">{chapterPlanError}</div> : null}
                  {chapterPlanNotice ? <div className="global-banner">{chapterPlanNotice}</div> : null}
                  <div className="chapter-plan-editor-grid">
                    <label className="detail-inline-field"><span>章节编号</span><input type="number" min="1" value={chapterDraft.chapter_number} onChange={(event) => updateChapterDraftField('chapter_number', Math.max(1, Number(event.target.value || 1)))} /></label>
                    <label className="detail-inline-field"><span>分卷编号</span><input type="number" min="1" value={chapterDraft.volume_number} onChange={(event) => updateChapterDraftField('volume_number', Math.max(1, Number(event.target.value || 1)))} /></label>
                    <label className="detail-inline-field is-wide"><span>章节名</span><input value={normalizeChapterName(chapterDraft.chapter_name)} onChange={(event) => updateChapterDraftField('chapter_name', event.target.value)} placeholder="输入章节名" /></label>
                    <label className="detail-inline-field is-wide"><span>章节细纲</span><textarea rows={4} ref={resizeChapterOutlineTextarea} value={chapterDraft.outline_text || ''} onInput={(event) => resizeChapterOutlineTextarea(event.currentTarget)} onChange={(event) => updateChapterDraftField('outline_text', event.target.value)} placeholder="按剧情发生顺序概括本章：如何承接前文、发生哪些关键事件、人物如何行动、局面如何变化，以及本章最终停在哪里。" /></label>
                  </div>
                </section>
              ) : null}

              {chapterEntries.length > 0 ? (
                <div className="chapter-waterfall">
                  {chapterEntries.map((entry) => {
                    const chapterWordCount = entry.chapter?.word_count || getTextWordCount(entry.chapter?.content);
                    return (
                      <article
                        key={`chapter-entry-${entry.chapterNumber}`}
                        className="chapter-flow-card"
                      >
                        <span className="chapter-flow-number">CH.{String(entry.chapterNumber).padStart(2, '0')}</span>
                        <button type="button" className="chapter-title-link" onClick={() => openChapterReader(entry.chapterNumber)}>
                          第 {entry.chapterNumber} 章 · {getChapterTitle(entry)}
                        </button>
                        <span className="chapter-flow-meta">
                          {chapterWordCount ? `${formatWords(chapterWordCount)} · ` : ''}
                          {entry.chapter?.content ? '正文已保存' : '待生成正文'}
                        </span>
                        {entry.plan?.outline_text ? (
                          <p className="chapter-flow-outline">
                            <b>章节细纲：</b>
                            {String(entry.plan.outline_text).replace(/\s+/g, ' ').trim()}
                          </p>
                        ) : null}
                        <div className="chapter-flow-actions">
                          <button type="button" className="ghost-btn" onClick={() => openChapterPlanEditor(entry)}>编辑细纲</button>
                          <button type="button" className="ghost-btn" onClick={() => openChapterReader(entry.chapterNumber)}>阅读正文</button>
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => handleDeleteLibraryChapter(entry)}
                            disabled={chapterDeletingKey === String(entry.chapterNumber)}
                          >
                            {chapterDeletingKey === String(entry.chapterNumber) ? '删除中...' : '删除章节'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="chapter-reader-empty">
                  <strong>暂无章节细纲和正文记录</strong>
                  <p>可以在这里手动建立章节细纲，或让 AI 根据分卷、剧情线和角色资料生成。</p>
                  <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openChapterPlanEditor(null)}>建立第一章细纲</button>
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}

      {view === 'detail' && detailBook && !isSubPage ? (
        <section className="mt-8">
          <div className="detail-header">
            <div className="detail-header-main">
              <h2>{detailBook.title}</h2>
              <div className="detail-header-meta">
                <span className="detail-meta-chip">{genreLabels[detailBook.genre] || detailBook.genre}</span>
                {detailBook.subgenre ? <span className="detail-meta-chip">{subgenreLabels[detailBook.subgenre] || detailBook.subgenre}</span> : null}
                <span className="detail-meta-chip">{statusLabels[detailBook.status] || detailBook.status}</span>
                {detailBook.author ? <span className="detail-meta-chip">作者：{detailBook.author}</span> : null}
                <span className="detail-meta-chip">创建于 {formatDate(detailBook.created_at)}</span>
                {detailBook.id === currentBookId ? <span className="detail-meta-chip">当前使用中</span> : null}
              </div>
            </div>
          </div>

          {detailLoading ? (
            <div className="global-banner">正在加载书籍汇总...</div>
          ) : (
            <div className="summary-hub">
              <div className="summary-hub-top">
                <div className="summary-hub-main">
                  <div className="detail-panel book-info-panel">
                    <div className="book-info-main">
                      <div className="detail-panel-actions">
                        <h3>书籍信息</h3>
                        <button type="button" className="ghost-btn" onClick={openEditEditor}>编辑书籍信息</button>
                      </div>
                      <ul className="meta-list">
                        <li>题材：{genreLabels[detailBook.genre] || detailBook.genre}</li>
                        <li>子分类：{subgenreLabels[detailBook.subgenre] || detailBook.subgenre || '未设置'}</li>
                        <li>平台：{getPlatformLabel(detailBook.target_platform)}</li>
                        <li>状态：{statusLabels[detailBook.status] || detailBook.status}</li>
                        <li>作者：{detailBook.author || '未知'}</li>
                        <li>简介：{detailBook.description || '暂无简介'}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="detail-panel summary-overview-panel">
                    <div className="summary-overview-head">
                      <div>
                        <h3>全书汇总</h3>
                        <p>先看整体，再进分页面。</p>
                      </div>
                    </div>
                    <div className="summary-metric-grid">
                      <div className="summary-metric-card">
                        <strong>{detailVolumePlans.length}</strong>
                        <span>分卷</span>
                      </div>
                      <div className="summary-metric-card">
                        <strong>{detailStorylines.length}</strong>
                        <span>叙事脉络</span>
                      </div>
                      <div className="summary-metric-card">
                        <strong>{detailCharacters.length}</strong>
                        <span>角色</span>
                      </div>
                      <div className="summary-metric-card">
                        <strong>{detailChapters.length}</strong>
                        <span>章节</span>
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="detail-panel book-cover-card" aria-label="书籍封面">
                  <div className="book-cover-card-head">
                    <span className="summary-nav-kicker">Book Cover</span>
                    <h3>书籍封面</h3>
                  </div>
                  {detailBook.cover_image ? (
                    <img src={detailBook.cover_image} alt={`${detailBook.title || '书籍'}封面`} />
                  ) : (
                    <div className="book-cover-placeholder book-cover-placeholder-large" aria-hidden="true">
                      <span>{getBookCoverInitials(detailBook)}</span>
                      <strong>{detailBook.title || '未命名书籍'}</strong>
                      <em>{getBookCoverGenreLabel(detailBook)}</em>
                    </div>
                  )}
                </aside>
              </div>

              <div className="detail-panel">
                <h3>进入分页面</h3>
                <div className="summary-nav-grid summary-nav-grid-hub">
                  <button type="button" className="summary-nav-card summary-nav-button summary-nav-card-outline" onClick={() => openBooksOutlinePage(detailBook.id)}>
                    <span className="summary-nav-kicker">Story Structure</span>
                    <strong>大纲链页</strong>
                    <span>全书大纲、自动拆分分卷</span>
                    <em>进入结构规划</em>
                  </button>
                  <button type="button" className="summary-nav-card summary-nav-button summary-nav-card-storyline" onClick={() => openBooksStorylinePage(detailBook.id)}>
                    <span className="summary-nav-kicker">Storyline Board</span>
                    <strong>叙事脉络页</strong>
                    <span>按卷查看主线、支线与阶段目标</span>
                    <em>进入叙事脉络</em>
                  </button>
                  <button type="button" className="summary-nav-card summary-nav-button summary-nav-card-character" onClick={() => openBooksCharacterPage(detailBook.id)}>
                    <span className="summary-nav-kicker">Character Core</span>
                    <strong>角色页</strong>
                    <span>角色档案、关系与一致性</span>
                    <em>进入人物档案</em>
                  </button>
                  <button type="button" className="summary-nav-card summary-nav-button summary-nav-card-chapter" onClick={() => openBooksChapterPage(detailBook.id)}>
                    <span className="summary-nav-kicker">Chapter Flow</span>
                    <strong>章节与正文页</strong>
                    <span>章节细纲、章节记录、正文预览</span>
                    <em>进入章节创作</em>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}
      {avatarCropState ? (
        <div className="modal-backdrop" onClick={closeAvatarCropper}>
          <div className="modal-panel avatar-crop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-head-text">
                <h3>裁剪角色头像</h3>
                <p>拖动图片位置，方框内就是最终头像。</p>
              </div>
              <button type="button" className="ghost-btn" onClick={closeAvatarCropper}>关闭</button>
            </div>
            <div className="avatar-crop-body">
              <div
                className="avatar-crop-stage"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  setAvatarCropState((prev) => prev ? ({
                    ...prev,
                    dragging: true,
                    dragStartX: event.clientX,
                    dragStartY: event.clientY,
                    startOffsetX: prev.offsetX,
                    startOffsetY: prev.offsetY
                  }) : prev);
                }}
                onPointerMove={(event) => updateAvatarCropPosition(event.clientX, event.clientY)}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture?.(event.pointerId);
                  setAvatarCropState((prev) => prev ? ({ ...prev, dragging: false }) : prev);
                }}
                onPointerLeave={() => setAvatarCropState((prev) => prev?.dragging ? { ...prev, dragging: false } : prev)}
              >
                <img
                  className={`avatar-crop-image${avatarCropState.dragging ? ' is-dragging' : ''}`}
                  src={avatarCropState.dataUrl}
                  alt="待裁剪头像"
                  style={{
                    width: `${avatarCropState.imageWidth * avatarCropState.scale}px`,
                    height: `${avatarCropState.imageHeight * avatarCropState.scale}px`,
                    transform: `translate(${avatarCropState.offsetX}px, ${avatarCropState.offsetY}px)`
                  }}
                />
                <div className="avatar-crop-mask" />
                <div className="avatar-crop-frame" />
              </div>
            </div>
            <div className="modal-actions avatar-crop-actions">
              <button type="button" className="ghost-btn" onClick={closeAvatarCropper}>取消</button>
              <button type="button" className="solid-btn" onClick={confirmAvatarCrop}>确认裁剪</button>
            </div>
          </div>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="modal-backdrop" onClick={closeEditor}>
          <div className="modal-panel book-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-head-text">
                <h3>{editorMode === 'create' ? '新建书籍' : '编辑书籍'}</h3>
                <p>{editorMode === 'create' ? '填完基础信息就能保存。' : '直接修改常用字段后保存。'}</p>
              </div>
              <button type="button" className="ghost-btn" onClick={closeEditor}>关闭</button>
            </div>

            {editorError ? <div className="global-banner is-error">{editorError}</div> : null}

            <form className="book-editor-form" onSubmit={submitEditor}>
              <label className="field field-full">
                <span>书名</span>
                <input value={editorForm.title} onChange={(e) => setEditorForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="输入书名" />
              </label>
              <div className="form-grid-two">
                <label className="field">
                  <span>题材</span>
                  <select value={editorForm.genre} onChange={(e) => setEditorForm((prev) => ({ ...prev, genre: e.target.value, subgenre: '' }))}>
                    {genreOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>子分类</span>
                  <select value={editorForm.subgenre} onChange={(e) => setEditorForm((prev) => ({ ...prev, subgenre: e.target.value }))}>
                    <option value="">未细分</option>
                    {getSubgenreOptions(editorForm.genre).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-grid-two">
                <label className="field">
                  <span>状态</span>
                  <select value={editorForm.status} onChange={(e) => setEditorForm((prev) => ({ ...prev, status: e.target.value }))}>
                    {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>作者</span>
                  <input value={editorForm.author} onChange={(e) => setEditorForm((prev) => ({ ...prev, author: e.target.value }))} placeholder="可选" />
                </label>
              </div>
              <label className="field field-full">
                <span>书籍封面</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await readImageFileAsDataUrl(file);
                      setEditorForm((prev) => ({ ...prev, cover_image: dataUrl }));
                    } catch (fileError) {
                      setEditorError(fileError.message);
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
              </label>
              {editorForm.cover_image ? (
                <div className="detail-cover-preview">
                  <img src={editorForm.cover_image} alt="书籍封面预览" className="detail-cover-preview-image" />
                </div>
              ) : null}
              <label className="field field-full">
                <span>简介</span>
                <textarea rows={6} value={editorForm.description} onChange={(e) => setEditorForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="简单写一下这本书的核心设定" />
              </label>
              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={closeEditor}>取消</button>
                <button type="submit" className="solid-btn" disabled={saving}>{saving ? '保存中...' : '保存'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      </main>

      <style>{`
        .books-admin-page {
          --books-admin-radius: 18px;
          --books-admin-radius-sm: 12px;
          --books-admin-gap: 12px;
          width: min(1480px, calc(100% - 1rem)) !important;
          padding-top: 14px !important;
          padding-bottom: 36px !important;
          font-size: 14px;
        }
        .library-app-shell {
          position: relative;
          display: grid;
          grid-template-columns: 268px minmax(0, 1fr);
          align-items: start;
          gap: 16px;
          transition: grid-template-columns 160ms ease;
        }
        .library-app-shell.is-sidebar-collapsed {
          grid-template-columns: 12px minmax(0, 1fr);
          gap: 10px;
        }
        .library-app-shell.is-sidebar-collapsed.is-sidebar-peek,
        .library-app-shell.is-sidebar-collapsed:has(.library-sidebar-hotzone:hover),
        .library-app-shell.is-sidebar-collapsed:has(.library-sidebar:hover),
        .library-app-shell.is-sidebar-collapsed:has(.library-sidebar:focus-within) {
          grid-template-columns: 268px minmax(0, 1fr);
          gap: 16px;
        }
        .library-sidebar-hotzone {
          display: none;
        }
        .library-app-shell.is-sidebar-collapsed .library-sidebar-hotzone {
          position: absolute;
          top: 14px;
          left: 0;
          z-index: 21;
          display: block;
          width: 24px;
          height: min(520px, calc(100vh - 120px));
          cursor: pointer;
        }
        .library-app-shell.is-sidebar-collapsed .library-sidebar-hotzone::after {
          content: '';
          position: absolute;
          top: 34px;
          left: 5px;
          width: 3px;
          height: 64px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand) 72%, transparent);
        }
        .library-app-shell.is-sidebar-peek .library-sidebar-hotzone {
          display: none;
        }
        .library-sidebar {
          position: sticky;
          top: 14px;
          display: grid;
          gap: 14px;
          max-height: none;
          overflow: visible;
          border-right: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
          padding: 6px 14px 18px 0;
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }
        .library-sidebar::-webkit-scrollbar {
          width: 6px;
        }
        .library-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }
        .library-sidebar::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand) 22%, transparent);
        }
        .library-sidebar-toggle {
          width: 34px;
          min-height: 30px;
          border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
          border-radius: 10px;
          background: color-mix(in srgb, var(--panel-strong) 90%, white);
          color: var(--brand-deep);
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
          cursor: pointer;
          justify-self: end;
        }
        .library-sidebar-toggle:hover {
          border-color: color-mix(in srgb, var(--brand) 30%, var(--line));
          background: color-mix(in srgb, var(--brand-soft) 48%, white);
        }
        .library-main {
          min-width: 0;
        }
        .library-page-title {
          margin: 2px 0 12px;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
          padding-bottom: 10px;
        }
        .library-page-title h2 {
          margin: 0;
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: clamp(1.18rem, 1.7vw, 1.45rem);
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.035em;
        }
        .library-stats-row {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        @media (max-width: 980px) {
          .library-stats-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .library-stats-row {
            grid-template-columns: 1fr;
          }
        }
        .library-sidebar-head {
          display: grid;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
        }
        .library-surface-switcher {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          align-items: stretch;
        }
        .library-surface-entry {
          appearance: none;
          display: grid;
          gap: 4px;
          min-width: 0;
          min-height: 58px;
          border: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
          border-radius: 12px;
          background: color-mix(in srgb, var(--surface) 74%, transparent);
          padding: 10px 12px;
          color: var(--text);
          cursor: pointer;
          text-align: left;
          transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
        }
        .library-surface-entry:hover,
        .library-surface-entry.is-primary {
          border-color: color-mix(in srgb, var(--brand) 36%, var(--line));
          background: color-mix(in srgb, var(--brand) 7%, var(--surface));
        }
        .library-surface-entry strong {
          margin: 0;
          color: var(--text);
          font-family: var(--font-serif);
          font-size: 22px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.04em;
        }
        .library-surface-entry:hover strong {
          color: var(--brand-deep);
        }
        .library-surface-entry:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }
        .library-sidebar-kicker,
        .library-sidebar-label {
          color: var(--brand);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .library-sidebar-context {
          display: grid;
          gap: 3px;
          padding-top: 2px;
        }
        .library-sidebar-context span {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.35;
        }
        .library-sidebar-context strong {
          color: var(--text);
          font-size: 14px;
          font-weight: 800;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .library-sidebar-section {
          display: grid;
          gap: 9px;
          padding: 12px 0;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
        }
        .library-sidebar-book {
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.14rem;
          font-weight: 900;
          line-height: 1.24;
        }
        .library-sidebar-note {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .library-sidebar-nav,
        .library-sidebar-actions {
          display: grid;
          gap: 7px;
        }
        .library-nav-item {
          min-height: 34px;
          border: 0;
          border-left: 2px solid transparent;
          border-radius: 0 10px 10px 0;
          background: transparent;
          padding: 0 10px;
          color: var(--muted);
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }
        .library-nav-item:hover:not(:disabled),
        .library-nav-item.is-active {
          border-left-color: var(--brand);
          background: color-mix(in srgb, var(--brand-soft) 42%, transparent);
          color: var(--brand-deep);
        }
        .library-nav-item:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .library-app-shell.is-sidebar-collapsed .library-sidebar {
          width: 260px;
          min-height: 240px;
          overflow: hidden;
          transform: translateX(-248px);
          z-index: 20;
          border-right-color: color-mix(in srgb, var(--brand) 28%, var(--line));
          border-radius: 0 16px 16px 0;
          background: color-mix(in srgb, var(--panel) 96%, white);
          box-shadow: none;
          padding: 8px 12px 14px 0;
        }
        .library-app-shell.is-sidebar-collapsed.is-sidebar-peek .library-sidebar,
        .library-app-shell.is-sidebar-collapsed:has(.library-sidebar-hotzone:hover) .library-sidebar,
        .library-app-shell.is-sidebar-collapsed .library-sidebar:hover,
        .library-app-shell.is-sidebar-collapsed .library-sidebar:focus-within {
          overflow: auto;
          transform: translateX(0);
          box-shadow: 18px 0 36px color-mix(in srgb, var(--text) 10%, transparent);
          padding-left: 12px;
        }
        .library-app-shell.is-sidebar-collapsed:not(.is-sidebar-peek):not(:has(.library-sidebar-hotzone:hover)) .library-sidebar:not(:hover):not(:focus-within) .library-sidebar-head,
        .library-app-shell.is-sidebar-collapsed:not(.is-sidebar-peek):not(:has(.library-sidebar-hotzone:hover)) .library-sidebar:not(:hover):not(:focus-within) .library-sidebar-section,
        .library-app-shell.is-sidebar-collapsed:not(.is-sidebar-peek):not(:has(.library-sidebar-hotzone:hover)) .library-sidebar:not(:hover):not(:focus-within) .library-sidebar-nav {
          display: none;
        }
        .library-app-shell.is-sidebar-collapsed:not(.is-sidebar-peek):not(:has(.library-sidebar-hotzone:hover)) .library-sidebar:not(:hover):not(:focus-within)::after {
          content: '';
          position: absolute;
          top: 46px;
          right: 2px;
          width: 3px;
          height: 56px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand) 72%, transparent);
        }
        .library-app-shell.is-sidebar-collapsed .library-sidebar-toggle {
          width: 24px;
          min-height: 44px;
          border-radius: 999px;
          padding: 0;
          transform: translateX(4px);
        }
        @media (max-width: 720px) {
          .library-app-shell,
          .library-app-shell.is-sidebar-collapsed,
          .library-app-shell.is-sidebar-collapsed.is-sidebar-peek {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 10px !important;
          }
          .library-app-shell.is-sidebar-collapsed .library-sidebar-hotzone {
            display: none;
          }
          .library-sidebar,
          .library-app-shell.is-sidebar-collapsed .library-sidebar {
            position: static;
            width: 100%;
            min-height: 0;
            overflow: visible;
            transform: none;
            border-right: 0;
            border-bottom: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
            border-radius: 0;
            box-shadow: none;
            padding: 0 0 10px;
          }
          .library-app-shell.is-sidebar-collapsed .library-sidebar-head,
          .library-app-shell.is-sidebar-collapsed .library-sidebar-nav {
            display: grid !important;
          }
          .library-sidebar-head {
            padding-bottom: 8px;
          }
          .library-sidebar-nav {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
          .library-nav-item {
            justify-content: center;
            border-left: 0;
            border-bottom: 2px solid transparent;
            padding: 6px 4px;
            text-align: center;
          }
          .library-nav-item:hover:not(:disabled),
          .library-nav-item.is-active {
            border-left-color: transparent;
            border-bottom-color: var(--brand);
          }
        }
        .library-list-filter {
          display: grid;
          gap: 12px;
          margin-top: 12px;
          border: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
          border-radius: var(--books-admin-radius);
          background: color-mix(in srgb, var(--panel) 86%, var(--panel-strong));
          padding: 14px;
        }
        .library-list-filter-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
        }
        .library-list-filter-fields {
          display: grid;
          grid-template-columns: minmax(180px, 1.45fr) repeat(3, minmax(120px, 0.8fr));
          gap: 10px;
          min-width: 0;
        }
        .library-list-filter-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 7px;
          min-width: 0;
        }
        .library-list-filter-actions button {
          min-height: 32px !important;
          padding-inline: 10px !important;
          font-size: 13px !important;
        }
        .library-filter-box label {
          display: grid;
          gap: 5px;
        }
        .library-filter-box label span {
          color: var(--muted);
          font-size: 13px !important;
          font-weight: 700;
          letter-spacing: 0 !important;
          text-transform: none;
        }
        .library-filter-box input,
        .library-filter-box select {
          width: 100%;
          min-height: 36px !important;
          border: 1px solid var(--line);
          border-radius: 10px !important;
          background: color-mix(in srgb, var(--panel-strong) 92%, white);
          color: var(--text);
          padding: 7px 9px !important;
          font: inherit;
          font-size: 14px !important;
        }
        @media (max-width: 1100px) {
          .library-list-filter-head {
            display: grid;
          }
          .library-list-filter-actions {
            justify-content: flex-start;
          }
          .library-list-filter-fields {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .library-list-filter-fields {
            grid-template-columns: 1fr;
          }
        }
        .books-admin-page .global-banner {
          margin: 10px 0 !important;
          border-radius: var(--books-admin-radius-sm) !important;
          padding: 10px 12px !important;
          font-size: 14px !important;
        }
        .books-admin-page .mt-6 {
          margin-top: 12px !important;
        }
        .books-admin-page .mt-4 {
          margin-top: 10px !important;
        }
        .books-admin-page .gap-4 {
          gap: 12px !important;
        }
        .books-admin-page .gap-3 {
          gap: 8px !important;
        }
        .books-admin-page .rounded-\\[36px\\],
        .books-admin-page .rounded-\\[30px\\],
        .books-admin-page .rounded-\\[28px\\],
        .books-admin-page .rounded-\\[24px\\],
        .books-admin-page .rounded-\\[22px\\] {
          border-radius: var(--books-admin-radius) !important;
        }
        .books-admin-page .shadow-\\[0_18px_52px_rgba\\(15\\,23\\,42\\,0\\.05\\)\\],
        .books-admin-page .shadow-\\[0_14px_38px_rgba\\(15\\,23\\,42\\,0\\.04\\)\\],
        .books-admin-page .shadow-\\[0_14px_34px_rgba\\(15\\,23\\,42\\,0\\.04\\)\\],
        .books-admin-page .shadow-\\[0_12px_30px_rgba\\(15\\,23\\,42\\,0\\.04\\)\\],
        .books-admin-page .shadow-\\[0_10px_26px_rgba\\(15\\,23\\,42\\,0\\.04\\)\\] {
          box-shadow: none !important;
        }
        .books-admin-page [class*="px-5"][class*="py-5"] {
          padding: 14px !important;
        }
        .books-admin-page [class*="px-5"][class*="py-4"],
        .books-admin-page [class*="px-4"][class*="py-4"] {
          padding: 12px !important;
        }
        .books-admin-page h3 {
          letter-spacing: -0.02em !important;
        }
        .books-admin-page .font-serif.text-\\[1\\.85rem\\] {
          margin-bottom: 10px !important;
          font-size: 1.25rem !important;
          line-height: 1.1 !important;
        }
        .books-admin-page strong.text-\\[2rem\\],
        .books-admin-page strong.text-\\[1\\.7rem\\] {
          font-size: 1.25rem !important;
        }
        .books-admin-page label span {
          margin-bottom: 5px !important;
          font-size: 11px !important;
          letter-spacing: 0.1em !important;
        }
        .books-admin-page input,
        .books-admin-page select,
        .books-admin-page textarea {
          min-height: 38px !important;
          border-radius: 10px !important;
          padding: 8px 10px !important;
          font-size: 14px !important;
        }
        .books-admin-page .solid-btn,
        .books-admin-page .ghost-btn {
          min-height: 34px !important;
          border-radius: 10px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
        }
        .books-admin-page .current-book-badge {
          min-height: 20px;
          padding: 0 8px;
          font-size: 11px;
        }
        .books-admin-page [data-book-id] {
          gap: 10px !important;
          grid-template-columns: minmax(96px, 3fr) minmax(0, 7fr) !important;
          border-radius: var(--books-admin-radius) !important;
          padding: 12px !important;
          padding-left: 54px !important;
          box-shadow: none !important;
          cursor: pointer;
          position: relative;
        }
        .book-card-select-zone {
          position: absolute;
          inset: 0 auto 0 0;
          width: 42px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 0;
          border-right: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
          border-radius: var(--books-admin-radius) 0 0 var(--books-admin-radius);
          background: color-mix(in srgb, var(--panel-strong) 72%, transparent);
          color: var(--muted);
          cursor: pointer;
          transition: background 140ms ease, color 140ms ease;
        }
        .book-card-select-zone:hover,
        .book-card-select-zone.is-selected {
          background: color-mix(in srgb, var(--brand-soft) 64%, var(--panel));
          color: var(--brand);
        }
        .book-card-select-box {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border: 1px solid color-mix(in srgb, var(--line-strong) 80%, var(--line));
          border-radius: 6px;
          background: var(--panel);
          color: var(--brand);
          font-size: 13px;
          font-weight: 900;
          line-height: 1;
        }
        .book-card-select-zone.is-selected .book-card-select-box {
          border-color: color-mix(in srgb, var(--brand) 72%, var(--line));
          background: color-mix(in srgb, var(--brand-soft) 82%, white);
        }
        .book-card-select-label {
          color: inherit;
          font-size: 13px;
          font-weight: 750;
          line-height: 1;
          writing-mode: vertical-rl;
          letter-spacing: 0.08em;
        }
        .book-list-cover {
          width: 100%;
          max-width: 148px;
          aspect-ratio: 9 / 14;
          align-self: start;
          justify-self: stretch;
          overflow: hidden;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 88%, white);
          box-shadow: 0 10px 22px color-mix(in srgb, var(--text) 9%, transparent);
        }
        .book-list-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .book-list-cover-placeholder {
          width: 100%;
          height: 100%;
        }
        .books-admin-page [data-book-id]:hover {
          box-shadow: 0 8px 18px color-mix(in srgb, var(--brand) 9%, transparent) !important;
        }
        .books-admin-page [data-book-id] h3 {
          font-size: 1.12rem !important;
          line-height: 1.25 !important;
        }
        .books-admin-page [data-book-id] .gap-3 {
          gap: 7px !important;
        }
        .books-admin-page [data-book-id] .pt-4 {
          padding-top: 10px !important;
        }
        .books-admin-page .detail-header {
          display: none !important;
        }
        .books-admin-page .detail-header h2 {
          margin-bottom: 6px !important;
          font-size: clamp(1.4rem, 2.2vw, 2rem) !important;
          line-height: 1.12 !important;
        }
        .books-admin-page .detail-meta-chip {
          min-height: 22px;
          padding: 0 8px;
          font-size: 11px;
        }
        .books-admin-page .summary-hub,
        .books-admin-page .summary-overview-panel,
        .books-admin-page .detail-main,
        .books-admin-page .detail-side {
          gap: 12px !important;
        }
        .books-admin-page .summary-bottom-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        .books-admin-page .detail-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        .books-admin-page .detail-panel {
          border-radius: var(--books-admin-radius) !important;
          padding: 14px !important;
        }
        .books-admin-page .detail-panel h3 {
          margin-bottom: 10px !important;
          font-size: 1.15rem !important;
        }
        .books-admin-page .summary-metric-card {
          border-radius: var(--books-admin-radius-sm) !important;
          padding: 12px !important;
        }
        .books-admin-page .summary-metric-card strong {
          font-size: 1.35rem !important;
        }
        .books-admin-page .summary-nav-grid {
          gap: 10px !important;
        }
        .books-admin-page .summary-nav-card {
          min-height: 132px !important;
          border-radius: var(--books-admin-radius) !important;
          gap: 7px !important;
          padding: 14px 14px 12px !important;
        }
        .books-admin-page .summary-nav-card strong {
          font-size: 1.18rem !important;
        }
        .books-admin-page .summary-nav-card span {
          font-size: 12px !important;
          line-height: 1.55 !important;
        }
        .books-admin-page .summary-nav-card em {
          font-size: 12px !important;
        }
        .danger-solid-btn {
          --btn-solid-bg: var(--btn-danger-solid-bg);
          --btn-solid-text: var(--btn-danger-solid-text);
        }
        .current-book-badge {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 10px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand-soft) 72%, var(--panel));
          color: var(--brand-deep);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .library-action-panel,
        .library-status-panel { display: grid; gap: 14px; }
        .library-action-panel h3,
        .library-status-panel h3 {
          margin: 0;
        }
        .library-action-panel .solid-btn,
        .library-action-panel .ghost-btn {
          min-height: 42px;
          padding-inline: 18px;
          font-size: 15px;
        }
        .filter-field { gap: 6px; }
        .filter-field span { font-size: 12px; color: var(--muted); }
        .filter-field input, .filter-field select {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 12px 14px;
          background: #fff;
          color: var(--text);
          font: inherit;
        }
        .detail-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
        .detail-header-main { min-width: 0; }
        .detail-header h2 { margin: 0 0 8px; }
        .detail-header-meta { display: flex; flex-wrap: wrap; gap: 8px; }
        .detail-meta-chip { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; background: var(--brand-soft); color: var(--brand); font-size: 12px; font-weight: 600; white-space: nowrap; }
        .detail-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); gap: 16px; align-items: start; }
        .detail-grid-character { grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.8fr); }
        .detail-main, .detail-side { display: grid; gap: 16px; }
        .summary-hub { display: grid; gap: 16px; }
        .summary-hub-top {
          display: grid;
          grid-template-columns: minmax(0, 7fr) minmax(220px, 3fr);
          gap: 16px;
          align-items: start;
        }
        .summary-hub-main { display: grid; gap: 16px; min-width: 0; }
        .book-info-main {
          min-width: 0;
        }
        .book-cover-card {
          display: grid;
          gap: 14px;
          justify-items: stretch;
        }
        .book-cover-card-head h3 { margin-bottom: 0; }
        .book-cover-card img {
          width: min(100%, 230px);
          aspect-ratio: 9 / 14;
          object-fit: cover;
          justify-self: center;
          border-radius: 18px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 86%, white);
          box-shadow: 0 14px 32px color-mix(in srgb, var(--text) 10%, transparent);
        }
        .book-cover-placeholder {
          display: grid;
          place-items: center;
          align-content: center;
          gap: 8px;
          background:
            radial-gradient(circle at 28% 18%, color-mix(in srgb, var(--brand-soft) 82%, white) 0 22%, transparent 23%),
            linear-gradient(145deg, color-mix(in srgb, var(--panel-note-bg) 74%, white), color-mix(in srgb, var(--brand-soft) 36%, var(--panel)));
          color: var(--text);
          text-align: center;
        }
        .book-cover-placeholder span {
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.25rem;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.05em;
          color: var(--brand-deep);
        }
        .book-cover-placeholder em {
          max-width: 88%;
          color: var(--muted);
          font-size: 13px;
          font-style: normal;
          font-weight: 750;
          line-height: 1.25;
        }
        .book-cover-placeholder-large {
          width: min(100%, 230px);
          aspect-ratio: 9 / 14;
          justify-self: center;
          border: 1px solid var(--line);
          border-radius: 18px;
          box-shadow: 0 14px 32px color-mix(in srgb, var(--text) 10%, transparent);
          padding: 18px;
        }
        .book-cover-placeholder-large span {
          font-size: clamp(2.25rem, 4vw, 3.6rem);
        }
        .book-cover-placeholder-large strong {
          max-width: 100%;
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.05rem;
          font-weight: 900;
          line-height: 1.25;
          letter-spacing: -0.04em;
        }
        .summary-overview-panel { display: grid; gap: 16px; }
        .summary-overview-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .summary-overview-head h3 { margin: 0 0 6px; }
        .summary-overview-head p { margin: 0; color: var(--muted); line-height: 1.6; }
        .summary-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .summary-metric-card { padding: 16px; border: 1px solid var(--line); border-radius: 14px; background: color-mix(in srgb, var(--panel-strong) 88%, white); box-shadow: none; }
        .summary-metric-card strong { display: block; font-size: var(--font-size-section-title); line-height: 1; color: var(--text); }
        .summary-metric-card span { display: block; margin-top: 8px; font-size: 13px; color: var(--muted); }
        .summary-bottom-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr); gap: 16px; }
        .detail-panel { box-shadow: none; }
        .detail-panel { padding: 18px; border: 1px solid var(--line); border-radius: 16px; background: color-mix(in srgb, var(--panel) 92%, white); }
        .detail-panel h3 { margin: 0 0 12px; font-size: var(--font-size-panel-title); }
        .detail-volume-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-content: start;
          gap: 0;
          min-height: 0;
          height: auto;
          padding: 0;
          overflow: hidden;
          background: color-mix(in srgb, var(--panel) 94%, white);
        }
        .detail-volume-card.has-volume-cover {
          grid-template-columns: minmax(205px, 0.58fr) minmax(0, 0.82fr);
        }
        .detail-volume-content {
          min-width: 0;
          padding: 16px;
        }
        .detail-volume-card.has-volume-cover .detail-volume-content {
          padding-right: 16px;
        }
        .detail-volume-title-line {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }
        .detail-volume-title-line strong {
          min-width: 0;
          margin-bottom: 0;
          color: var(--text);
        }
        .detail-volume-index {
          flex: 0 0 auto;
          color: var(--brand);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.12em;
        }
        .detail-volume-copy {
          min-width: 0;
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }
        .detail-volume-cover-rail {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100%;
          border-right: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
          background: transparent;
          padding: 18px 14px;
        }
        .detail-volume-cover-side {
          width: min(204px, 88%);
          aspect-ratio: 9 / 14;
          flex: 0 0 auto;
          object-fit: cover;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 84%, transparent);
          box-shadow: 0 12px 26px color-mix(in srgb, var(--text) 10%, transparent);
        }
        .detail-cover-preview {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 8px;
        }
        .detail-cover-preview-image {
          width: 132px;
          aspect-ratio: 9 / 16;
          object-fit: cover;
          border-radius: var(--radius-panel-sm);
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 84%, transparent);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--brand) 10%, transparent);
        }
        .detail-character-avatar-preview {
          width: 108px;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: var(--radius-panel-md);
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 84%, transparent);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--brand) 10%, transparent);
        }
        .detail-summary-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
        .detail-summary-row-quad { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .detail-summary-row div { padding: 12px; border-radius: var(--radius-panel-xs); background: color-mix(in srgb, var(--panel-strong) 88%, transparent); border: 1px solid var(--line); }
        .detail-summary-row strong { display: block; font-size: 18px; line-height: 1.2; color: var(--text); }
        .detail-summary-row span { display: block; margin-top: 2px; font-size: 12px; color: var(--muted); }
        .detail-action-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .detail-panel-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .detail-danger-btn {
          --btn-ghost-bg: var(--btn-danger-bg);
          --btn-ghost-border: var(--btn-danger-border);
          --btn-ghost-text: var(--btn-danger-text);
        }
        .detail-summary-stack { display: grid; gap: 12px; }
        .summary-nav-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .summary-nav-grid-hub { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .summary-nav-card {
          position: relative;
          display: grid;
          align-content: start;
          gap: 10px;
          min-height: 182px;
          padding: 20px 20px 18px;
          border: 1px solid var(--line);
          border-radius: 18px;
          overflow: hidden;
          background: color-mix(in srgb, var(--panel-strong) 90%, white);
        }
        .summary-nav-card::after {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(180deg, color-mix(in srgb, var(--brand) 68%, white), color-mix(in srgb, var(--brand-deep) 78%, white));
          pointer-events: none;
        }
        .summary-nav-kicker {
          display: inline-flex;
          width: fit-content;
          min-height: 24px;
          align-items: center;
          padding: 0 10px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--panel-strong) 88%, transparent);
          color: var(--brand-deep);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .summary-nav-card strong {
          color: var(--text);
          font-size: var(--font-size-section-title);
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .summary-nav-card span { font-size: 14px; color: var(--muted); line-height: 1.7; max-width: 26ch; }
        .summary-nav-card em {
          margin-top: auto;
          font-style: normal;
          font-size: 13px;
          font-weight: 700;
          color: var(--brand-deep);
        }
        .summary-nav-button {
          text-align: left;
          cursor: pointer;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }
        .summary-nav-button:hover {
          transform: translateY(-2px);
          border-color: var(--badge-border);
        }
        .summary-nav-card-outline,
        .summary-nav-card-storyline,
        .summary-nav-card-character,
        .summary-nav-card-chapter { background: color-mix(in srgb, var(--panel-strong) 90%, white); }
        .detail-outline-grid { display: grid; gap: 14px; }
        .detail-outline-section { display: grid; gap: 8px; }
        .detail-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .detail-inline-actions { display: flex; align-items: end; gap: 10px; flex-wrap: wrap; }
        .detail-inline-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; width: 100%; }
        .detail-inline-count-group { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .detail-inline-count-label { font-size: 12px; color: var(--muted); white-space: nowrap; }
        .detail-inline-count-input {
          width: 96px;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 9px 12px;
          background: color-mix(in srgb, var(--panel-strong) 90%, white);
          color: var(--text);
          font: inherit;
          transform: translateY(-3px);
        }
        .detail-inline-primary-action { min-height: 42px; padding-inline: 18px; }
        .detail-inline-toolbar-hint { margin-left: auto; font-size: 12px; color: var(--muted); line-height: 1.4; text-align: right; }
        .detail-inline-textarea {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 12px 14px;
          background: color-mix(in srgb, var(--panel-strong) 90%, white);
          color: var(--text);
          font: inherit;
          line-height: 1.7;
          resize: vertical;
        }
        .detail-inline-field { display: grid; gap: 6px; }
        .detail-inline-field span { font-size: 12px; color: var(--muted); }
        .detail-inline-field input,
        .detail-inline-field textarea,
        .detail-inline-field select {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 10px 12px;
          background: color-mix(in srgb, var(--panel-strong) 90%, white);
          color: var(--text);
          font: inherit;
          line-height: 1.6;
        }
        .detail-inline-field textarea { resize: vertical; }
        .detail-inline-field em { font-size: 12px; color: var(--muted); font-style: normal; }
        .detail-inline-editor { display: grid; gap: 10px; margin-top: 6px; }
        .detail-inline-display { display: grid; gap: 4px; }
        .detail-character-ai-box { margin-bottom: 14px; padding: 14px; border: 1px solid color-mix(in srgb, var(--brand) 14%, var(--line)); border-radius: 12px; background: color-mix(in srgb, var(--brand-soft) 42%, var(--panel)); }
        .detail-character-role-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
        .detail-role-count-field.is-warning input { border-color: color-mix(in srgb, var(--brand) 32%, var(--line)); background: color-mix(in srgb, var(--brand-soft) 46%, var(--panel)); }
        .detail-character-metric-strip { display: flex; flex-wrap: wrap; gap: 8px; }
        .detail-character-metric-strip span { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 999px; background: color-mix(in srgb, var(--panel-strong) 90%, white); color: var(--brand); font-size: 12px; font-weight: 600; }
        .detail-character-metric-list { display: grid; gap: 6px; margin-top: 6px; }
        .detail-volume-plan-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
        .detail-outline-volume { padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: color-mix(in srgb, var(--panel) 88%, var(--panel-note-bg)); }
        .detail-outline-volume.detail-volume-card {
          padding: 0;
          height: auto;
          min-height: 0;
          align-self: start;
          border-radius: 18px;
          background: color-mix(in srgb, var(--panel) 94%, white);
          cursor: grab;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
        }
        .detail-outline-volume.detail-volume-card:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--brand) 28%, var(--line));
          box-shadow: 0 14px 30px color-mix(in srgb, var(--text) 8%, transparent);
        }
        .detail-outline-volume.detail-volume-card.is-dragging {
          opacity: 0.62;
          transform: scale(0.985);
        }
        .detail-outline-volume strong { display: block; margin-bottom: 6px; color: var(--brand); }
        .detail-storyline-list { display: grid; gap: 8px; }
        .detail-storyline-item { padding-top: 8px; border-top: 1px dashed color-mix(in srgb, var(--line-strong) 72%, transparent); }
        .detail-storyline-item:first-child { padding-top: 0; border-top: 0; }
        .detail-pre { margin: 0; padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--panel-note-bg) 72%, var(--panel)); display: grid; gap: 10px; }
        .detail-pre-paragraph { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 14px; line-height: 1.7; color: var(--text); text-indent: 2em; }
        .detail-chapter-list, .detail-character-list { display: grid; gap: 8px; }
        .chapter-library-page { min-width: 0; }
        .chapter-flow-board {
          display: grid;
          gap: 18px;
        }
        .chapter-flow-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
          padding-bottom: 14px;
        }
        .chapter-flow-head h2 {
          margin: 4px 0 0;
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: clamp(1.35rem, 2vw, 1.95rem);
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.04em;
          color: var(--text);
        }
        .chapter-flow-head p {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.65;
        }
        .chapter-plan-full-editor {
          display: grid;
          gap: 14px;
          border-left: 3px solid color-mix(in srgb, var(--brand) 58%, var(--line));
          background: color-mix(in srgb, var(--panel) 86%, white);
          padding: 16px 18px;
        }
        .chapter-plan-full-editor h3 {
          margin: 3px 0 0;
          color: var(--text);
          font-family: var(--font-serif);
          font-size: 20px;
        }
        .chapter-plan-editor-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .chapter-plan-editor-grid .detail-inline-field {
          min-width: 0;
        }
        .chapter-plan-editor-grid .is-wide {
          grid-column: 1 / -1;
        }
        .chapter-plan-editor-grid .is-wide textarea {
          width: 100%;
          max-width: none;
          min-width: 0;
          box-sizing: border-box;
          display: block;
          min-height: 120px;
          max-height: 420px;
          resize: none;
        }
        .chapter-plan-editor-grid .chapter-key-scenes-textarea {
          width: 100%;
          max-width: none;
          min-width: 0;
          box-sizing: border-box;
          display: block;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: anywhere;
          text-indent: 0;
          line-height: 1.7;
        }
        .chapter-waterfall {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }
        .library-app-shell.is-chapter-reader-page {
          grid-template-columns: minmax(0, 1fr);
          width: min(1120px, calc(100% - 1.5rem));
        }
        .chapter-flow-card {
          width: 100%;
          margin: 0;
          border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
          border-radius: 16px;
          background: color-mix(in srgb, var(--panel-strong) 88%, white);
          padding: 15px;
          color: inherit;
          text-align: left;
          display: grid;
          gap: 8px;
          box-shadow: none;
          transition: border-color 140ms ease, transform 140ms ease, background 140ms ease;
        }
        .chapter-flow-card:hover {
          border-color: color-mix(in srgb, var(--brand) 34%, var(--line));
          background: color-mix(in srgb, var(--brand-soft) 22%, var(--panel-strong));
        }
        .chapter-flow-number,
        .chapter-reader-kicker {
          color: var(--brand);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }
        .chapter-title-link {
          appearance: none;
          border: 0;
          background: transparent;
          padding: 0;
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.05rem;
          font-weight: 900;
          line-height: 1.35;
          letter-spacing: -0.02em;
          text-align: left;
          cursor: pointer;
        }
        .chapter-title-link:hover {
          color: var(--brand-deep);
          text-decoration: underline;
          text-underline-offset: 4px;
        }
        .chapter-flow-meta {
          color: var(--muted);
          font-size: 13px;
          font-weight: 700;
          line-height: 1.45;
        }
        .chapter-flow-card em {
          color: color-mix(in srgb, var(--text) 76%, var(--muted));
          font-style: normal;
          font-size: 14px;
          line-height: 1.7;
        }
        .chapter-flow-card p {
          margin: 0;
          color: var(--muted);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 15px;
          line-height: 1.8;
        }
        .chapter-flow-outline {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }
        .chapter-flow-outline b {
          color: color-mix(in srgb, var(--text) 84%, var(--muted));
        }
        .chapter-flow-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 4px;
          border-top: 1px solid color-mix(in srgb, var(--line) 68%, transparent);
        }
        .chapter-reader-shell {
          width: min(940px, 100%);
          margin: 0 auto;
          display: grid;
          gap: 20px;
        }
        .chapter-reader-toolbar,
        .chapter-reader-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .chapter-reader-switch {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chapter-reader-head {
          text-align: center;
          padding: 16px 0 8px;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
        }
        .chapter-reader-head h2 {
          margin: 8px 0 10px;
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: clamp(1.65rem, 3vw, 2.45rem);
          font-weight: 900;
          line-height: 1.2;
          letter-spacing: -0.045em;
        }
        .chapter-reader-meta {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          color: var(--muted);
          font-size: 13px;
          font-weight: 700;
        }
        .chapter-reader-meta span {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          border: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
          border-radius: 999px;
          padding: 0 10px;
          background: color-mix(in srgb, var(--panel) 76%, transparent);
        }
        .chapter-reader-audit {
          justify-self: center;
          width: min(760px, 100%);
          border-left: 2px solid color-mix(in srgb, var(--brand) 44%, var(--line));
          padding-left: 12px;
          color: var(--muted);
          font-size: 13px;
        }
        .chapter-reader-audit summary {
          width: fit-content;
          cursor: pointer;
          color: var(--brand-deep);
          font-weight: 750;
        }
        .chapter-reader-audit > div {
          display: grid;
          gap: 6px;
          margin-top: 10px;
          padding: 10px 0;
        }
        .chapter-reader-audit p {
          margin: 0;
          line-height: 1.7;
        }
        .chapter-reader-note {
          border-left: 3px solid color-mix(in srgb, var(--brand) 58%, var(--line));
          background: color-mix(in srgb, var(--brand-soft) 20%, transparent);
          padding: 10px 14px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.75;
        }
        .chapter-reader-note p {
          margin: 0;
        }
        .chapter-reader-note p + p {
          margin-top: 6px;
        }
        .chapter-reader-prose {
          width: min(760px, 100%);
          margin: 0 auto;
          padding: 10px 0 18px;
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 17px;
          line-height: 2.05;
        }
        .chapter-reader-prose p {
          margin: 0 0 1.05em;
          text-indent: 2em;
        }
        .chapter-reader-empty {
          display: grid;
          justify-items: start;
          gap: 8px;
          border: 1px dashed color-mix(in srgb, var(--line-strong) 72%, transparent);
          border-radius: 16px;
          background: color-mix(in srgb, var(--panel) 82%, transparent);
          padding: 18px;
          color: var(--muted);
        }
        .chapter-reader-empty strong {
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.14rem;
          font-weight: 900;
        }
        .chapter-reader-empty p {
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        }
        .detail-chapter-item, .detail-character-item { padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: color-mix(in srgb, var(--panel) 82%, var(--panel-note-bg)); }
        .detail-character-item-editing { margin-bottom: 12px; background: color-mix(in srgb, var(--brand-soft) 26%, var(--panel)); }
        .detail-character-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .detail-role-tier-badge { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        .detail-role-tier-badge-protagonist,
        .detail-role-tier-badge-supporting_major,
        .detail-role-tier-badge-supporting_secondary,
        .detail-role-tier-badge-supporting_minor,
        .detail-role-tier-badge-antagonist_major,
        .detail-role-tier-badge-antagonist_minor {
          background: color-mix(in srgb, var(--brand-soft) 68%, var(--panel));
          color: var(--brand-deep);
        }
        .detail-character-item-protagonist,
        .detail-character-item-supporting_major,
        .detail-character-item-supporting_secondary,
        .detail-character-item-supporting_minor,
        .detail-character-item-antagonist_major,
        .detail-character-item-antagonist_minor {
          background: color-mix(in srgb, var(--panel) 82%, var(--panel-note-bg));
          border-color: color-mix(in srgb, var(--brand) 10%, var(--line));
        }
        .detail-volume-drag-handle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          color: var(--muted);
          font-size: 14px;
          letter-spacing: -0.1em;
          user-select: none;
        }
        .detail-character-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .detail-character-avatar {
          width: 56px;
          height: 56px;
          object-fit: cover;
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, var(--brand) 10%, var(--line));
          background: color-mix(in srgb, var(--panel-strong) 90%, white);
          box-shadow: 0 6px 18px color-mix(in srgb, var(--text) 8%, transparent);
          flex: 0 0 auto;
        }
        .avatar-crop-modal { width: min(560px, calc(100vw - 48px)); max-height: calc(100vh - 48px); border-radius: 20px; overflow: hidden; }
        .avatar-crop-body { padding: 24px 24px 12px; background: color-mix(in srgb, var(--panel) 94%, white); }
        .avatar-crop-stage {
          position: relative;
          width: 320px;
          height: 320px;
          margin: 0 auto;
          overflow: hidden;
          border-radius: 24px;
          background:
            linear-gradient(45deg, color-mix(in srgb, var(--brand-soft) 36%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--brand-soft) 36%, transparent) 75%),
            linear-gradient(45deg, color-mix(in srgb, var(--brand-soft) 36%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--brand-soft) 36%, transparent) 75%);
          background-size: 24px 24px;
          background-position: 0 0, 12px 12px;
          touch-action: none;
          cursor: grab;
          user-select: none;
        }
        .avatar-crop-stage:active { cursor: grabbing; }
        .avatar-crop-image {
          position: absolute;
          top: 0;
          left: 0;
          max-width: none;
          transform-origin: top left;
          user-select: none;
          pointer-events: none;
        }
        .avatar-crop-mask {
          position: absolute;
          inset: 0;
          box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--text) 18%, transparent);
          pointer-events: none;
        }
        .avatar-crop-frame {
          position: absolute;
          inset: 0;
          border: 2px solid color-mix(in srgb, white 92%, var(--panel));
          border-radius: 24px;
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 12%, transparent);
          pointer-events: none;
        }
        .avatar-crop-actions { padding-inline: 24px; padding-bottom: 20px; background: color-mix(in srgb, var(--panel) 96%, white); }
        .detail-chapter-item strong, .detail-character-item strong { display: block; margin-bottom: 4px; }
        .detail-chapter-meta { font-size: 12px; color: var(--muted); display: block; margin-bottom: 6px; }
        .detail-entry-meta { font-size: 12px; color: var(--muted); white-space: nowrap; }
        .modal-backdrop { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; padding: 32px; background: color-mix(in srgb, var(--text) 34%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); overflow: auto; }
        .book-editor-modal { width: min(580px, calc(100vw - 48px)); max-height: calc(100vh - 64px); margin: 0 auto; border: 1px solid color-mix(in srgb, var(--line) 84%, transparent); border-radius: 22px; background: linear-gradient(180deg, #fffaf2, #fdf7ee); box-shadow: 0 28px 70px color-mix(in srgb, var(--text) 24%, transparent), inset 0 1px 0 color-mix(in srgb, white 82%, transparent); overflow: hidden; display: flex; flex-direction: column; }
        .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 0; padding: 18px 28px 14px; border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, transparent); background: color-mix(in srgb, var(--panel-note-bg) 62%, var(--panel)); }
        .modal-head-text { display: grid; gap: 2px; }
        .modal-head h3 { margin: 0; color: var(--text); font-family: var(--font-serif); font-size: 19px; font-weight: 800; letter-spacing: -0.035em; }
        .modal-head p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 13px; }
        .book-editor-form { display: grid; gap: 10px; padding: 16px 28px 22px; background: color-mix(in srgb, var(--panel) 90%, white); overflow: auto; }
        .field { display: grid; gap: 6px; }
        .field-full { grid-column: 1 / -1; }
        .field span { font-size: 13px; font-weight: 700; color: var(--brand); }
        .field input, .field select, .field textarea { width: 100%; border: 1px solid color-mix(in srgb, var(--line) 88%, transparent); border-radius: 14px; padding: 11px 13px; background: rgba(251, 248, 241, 0.72); color: var(--text); font: inherit; outline: none; transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--brand); background: color-mix(in srgb, var(--surface) 92%, white); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 13%, transparent); }
        .field textarea { resize: vertical; min-height: 108px; }
        .form-grid-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 10px; position: sticky; bottom: 0; background: color-mix(in srgb, var(--panel) 96%, white); }
        @media (max-width: 900px) {
          .form-grid-two, .detail-grid, .detail-summary-row, .detail-summary-row-quad, .summary-nav-grid, .summary-metric-grid, .summary-bottom-grid, .summary-hub-top, .detail-character-role-grid { grid-template-columns: 1fr; }
          .detail-header, .modal-head, .summary-overview-head { align-items: stretch; flex-direction: column; }
          .book-cover-card img { width: min(160px, 70%); justify-self: flex-start; }
          .detail-volume-plan-list { grid-template-columns: 1fr; }
          .detail-volume-card.has-volume-cover { grid-template-columns: 1fr; }
          .detail-volume-card.has-volume-cover .detail-volume-content { padding-right: 16px; }
          .detail-volume-cover-rail { min-height: 220px; border-right: 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 78%, transparent); }
          .detail-volume-cover-side { width: min(150px, 60%); }
          .chapter-waterfall { grid-template-columns: minmax(0, 1fr); }
          .chapter-flow-head { align-items: stretch; flex-direction: column; }
          .chapter-plan-editor-grid { grid-template-columns: 1fr; }
          .chapter-reader-prose { font-size: 16px; line-height: 1.95; }
          .chapter-reader-footer { align-items: stretch; flex-direction: column; }
          .chapter-reader-footer .ghost-btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
    </>
  );
}
