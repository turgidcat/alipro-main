import { useEffect, useMemo, useState } from 'react';
import {
  createBook,
  fetchBookList,
  generateVolumePlansFromBookPlan,
  getStoredCurrentBookId,
  persistCurrentBookId,
  saveOutlineSummary,
  updateBook
} from '../workbenchApi.js';
import '../styles.css';
import '../app-shell.css';

const API_BASE = '/api';

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
const roleTierOptions = [
  { value: 'protagonist', label: '主角', defaultCount: 1, softLimit: '建议 1 个', max: 1, tone: 'role-tier-protagonist' },
  { value: 'supporting_major', label: '主要配角', defaultCount: 2, softLimit: '建议 1-4 个', max: 4, tone: 'role-tier-supporting-major' },
  { value: 'supporting_minor', label: '普通配角', defaultCount: 3, softLimit: '建议 2-8 个', max: 8, tone: 'role-tier-supporting-minor' },
  { value: 'antagonist_major', label: '大反派', defaultCount: 1, softLimit: '建议 1-2 个', max: 2, tone: 'role-tier-antagonist-major' },
  { value: 'antagonist_minor', label: '普通反派', defaultCount: 2, softLimit: '建议 1-6 个', max: 6, tone: 'role-tier-antagonist-minor' }
];
const roleTierLabelMap = Object.fromEntries(roleTierOptions.map((item) => [item.value, item.label]));

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

function getPlatformLabel(value) {
  if (!value) return '未设置';
  if (value === 'qidian') return '起点中文网';
  if (value === 'fanqie') return '番茄小说';
  return value;
}

function buildDefaultRoleCounts() {
  return Object.fromEntries(roleTierOptions.map((item) => [item.value, item.defaultCount]));
}

function getSubgenreOptions(genre) {
  return genreCategoryMap[genre]?.subgenres || [];
}

function openWorkbench(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = '/workbench';
}

function openBooksSummaryPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = '/books';
}

function openBooksOutlinePage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = '/books/outlines';
}

function openBooksCharacterPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = '/books/characters';
}

function openBooksChapterPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = '/books/chapters';
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
  const currentPath = window.location.pathname;
  const initialSearchParams = new URLSearchParams(window.location.search);
  const initialRouteAction = initialSearchParams.get('action') || '';
  const initialRouteBookId = initialSearchParams.get('bookId') || '';
  const isOutlinePage = currentPath === '/books/outlines';
  const isCharacterPage = currentPath === '/books/characters';
  const isChapterPage = currentPath === '/books/chapters';
  const isSubPage = isOutlinePage || isCharacterPage || isChapterPage;
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
  const [targetVolumeCount, setTargetVolumeCount] = useState(0);
  const [volumePlanDrafts, setVolumePlanDrafts] = useState({});
  const [volumePlanSavingKey, setVolumePlanSavingKey] = useState('');
  const [editingVolumeKey, setEditingVolumeKey] = useState('');
  const [characterDrafts, setCharacterDrafts] = useState({});
  const [editingCharacterKey, setEditingCharacterKey] = useState('');
  const [characterSavingKey, setCharacterSavingKey] = useState('');
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
  const [pendingRouteAction, setPendingRouteAction] = useState(initialRouteAction);
  const [pendingRouteBookId, setPendingRouteBookId] = useState(initialRouteBookId);

  const currentBook = useMemo(
    () => books.find((book) => book.id === currentBookId) || null,
    [books, currentBookId]
  );

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

  const storylineGroups = useMemo(() => {
    const groups = new Map();
    detailStorylines.forEach((item) => {
      const volumeNumber = Number(item.volume_number || 1);
      if (!groups.has(volumeNumber)) groups.set(volumeNumber, []);
      groups.get(volumeNumber).push(item);
    });
    return Array.from(groups.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([volumeNumber, items]) => ({
        volumeNumber,
        items: items.sort((left, right) => Number(left.storyline_number || 0) - Number(right.storyline_number || 0))
      }));
  }, [detailStorylines]);

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
      volume_outline: detailOutline?.volume_outline || '',
      detailed_outline: detailOutline?.detailed_outline || ''
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
  }

  function setCurrentBook(bookId) {
    persistCurrentBookId(bookId);
    setCurrentBookId(bookId);
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
    if (!window.confirm('确认清空当前书籍的全部角色档案吗？此操作会删除现有角色卡，适合在重新生成前使用。')) {
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

  async function handleSaveOutline() {
    if (!detailBook?.id) return;
    setOutlineSaving(true);
    setOutlineError('');
    setOutlineNotice('');
    try {
      await saveOutlineSummary(detailBook.id, outlineDraft);
      await refreshDetail(detailBook.id);
      setOutlineNotice('大纲摘要已保存。');
      setOutlineEditing(false);
    } catch (saveError) {
      setOutlineError(saveError.message);
    } finally {
      setOutlineSaving(false);
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
        volume_name: prev[key]?.volume_name || '',
        stage_goal: prev[key]?.stage_goal || '',
        core_conflict: prev[key]?.core_conflict || '',
        notes: prev[key]?.notes || '',
        cover_image: prev[key]?.cover_image || '',
        [field]: value
      }
    }));
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

  return (
    <div className="page-shell">
      <header className="hero-section">
        <div>
          <span className="hero-eyebrow">Library</span>
          <h1>{isOutlinePage ? '大纲链页面' : isCharacterPage ? '角色资料页' : isChapterPage ? '章节与正文页' : '资料库管理台'}</h1>
          <p>
            {isOutlinePage
              ? `当前大纲链：${detailBook?.title || currentBook?.title || '未命名书籍'}`
              : isCharacterPage
              ? `当前角色档案：${detailBook?.title || currentBook?.title || '未命名书籍'}`
              : isChapterPage
              ? `当前章节与正文：${detailBook?.title || currentBook?.title || '未命名书籍'}`
              : (view === 'list' ? '先把书管理好，再回到主工作台继续创作。' : `当前档案：${detailBook?.title || '未命名书籍'}`)}
          </p>
        </div>
        <div className="hero-note-card hero-note-card-stack">
          <div>
            <strong>当前创作书籍</strong>
            <p>{currentBook ? currentBook.title : '尚未选择'}</p>
          </div>
          {view === 'list' && !isSubPage ? (
            <span className="current-book-badge">列表模式</span>
          ) : isSubPage ? (
            <div className="hero-note-card-actions">
              <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksSummaryPage(currentBookId)}>返回汇总页</button>
              <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(currentBookId)} disabled={!currentBookId}>进入创作台</button>
            </div>
          ) : (
            <span className="current-book-badge">详情模式</span>
          )}
        </div>
      </header>

      {error ? <div className="global-banner is-error">{error}</div> : null}

      {view === 'list' && !isCharacterPage ? (
        <>
          {stats ? (
            <div className="stats-row">
              {[
                ['书籍总数', stats.totalBooks || 0, '#3b82f6'],
                ['章节总数', stats.totalChapters || 0, '#10b981'],
                ['累计字数', formatWords(stats.totalWords || 0), '#f59e0b'],
                ['角色总数', stats.totalCharacters || 0, '#8b5cf6'],
                ['7天内更新', stats.recent7Days || 0, '#ec4899']
              ].map(([label, value, color]) => (
                <div key={label} className="stats-card" style={{ '--stat-color': color }}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="library-list-top-grid">
            <div className="detail-panel library-action-panel">
              <h3>列表快捷操作</h3>
              <div className="detail-action-grid">
                <button type="button" className="solid-btn" onClick={openCreateEditor}>新建书籍</button>
                <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(currentBookId)} disabled={!currentBookId}>进入创作台</button>
              </div>
            </div>

            <div className="detail-panel library-status-panel">
              <h3>当前状态</h3>
              <div className="detail-summary-row detail-summary-row-quad library-status-row">
                <div>
                  <strong>{filteredBooks.length}</strong>
                  <span>当前显示</span>
                </div>
                <div>
                  <strong>{books.length}</strong>
                  <span>书籍总数</span>
                </div>
                <div>
                  <strong>{selectedIds.size}</strong>
                  <span>已选书籍</span>
                </div>
                <div>
                  <strong>{activeFilterCount}</strong>
                  <span>启用筛选</span>
                </div>
              </div>
              <div className="library-status-meta">
                <span>当前书：{currentBook?.title || '尚未选择'}</span>
              </div>
            </div>
          </div>

          <div className="filter-toolbar detail-panel">
            <label className="field filter-field">
              <span>搜索</span>
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="按书名、作者、简介、题材搜索" />
            </label>
            <label className="field filter-field">
              <span>状态</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">全部状态</option>
                {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field filter-field">
              <span>题材</span>
              <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
                <option value="all">全部题材</option>
                {genreOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field filter-field">
              <span>排序</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="updated_desc">最近更新</option>
                <option value="updated_asc">最早更新</option>
                <option value="created_desc">最近创建</option>
                <option value="created_asc">最早创建</option>
                <option value="title_asc">书名 A-Z</option>
              </select>
            </label>
          </div>

          <div className="detail-panel list-tools-merged-panel">
            <div className="detail-action-grid list-tools-inline-row">
              <button type="button" className="ghost-btn" onClick={toggleSelectAll}>
                {selectedIds.size === filteredBooks.length && filteredBooks.length > 0 ? '取消全选' : '全选当前'}
              </button>
                  <button type="button" className="solid-btn danger-solid-btn" onClick={batchDelete} disabled={selectedIds.size === 0 || deleteLoading}>
                    {deleteLoading ? '删除中...' : '批量删除'}
                  </button>
              <button type="button" className="ghost-btn action-btn" onClick={focusCurrentBook} disabled={!currentBookId}>定位当前书</button>
              <button type="button" className="ghost-btn action-btn" onClick={loadLibrary}>刷新列表</button>
              <button type="button" className="ghost-btn action-btn" onClick={() => {
                setSearchText('');
                setStatusFilter('all');
                setGenreFilter('all');
                setSortBy('updated_desc');
              }}>清空筛选</button>
            </div>
          </div>

          {loading ? (
            <div className="global-banner">正在加载书籍列表...</div>
          ) : (
            <div className="book-card-grid">
              {filteredBooks.length === 0 ? (
                <div className="global-banner">
                  {books.length === 0 ? '还没有书籍，先新建一本吧。' : '没有符合当前筛选条件的书籍。'}
                </div>
              ) : (
                filteredBooks.map((book) => {
                  const isCurrent = book.id === currentBookId;
                  return (
                    <div
                      key={book.id}
                      data-book-id={book.id}
                      className={`book-card${selectedIds.has(book.id) ? ' is-selected' : ''}${isCurrent ? ' is-current' : ''}`}
                      onClick={() => loadDetail(book.id)}
                    >
                      <input
                        type="checkbox"
                        className="book-card-checkbox"
                        checked={selectedIds.has(book.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(book.id)) next.delete(book.id);
                            else next.add(book.id);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="book-card-body">
                        <div className="book-card-title-row">
                          <h3>{book.title}</h3>
                          {isCurrent ? <span className="current-book-badge">当前</span> : null}
                        </div>
                        <div className="book-card-meta">
                          <span className="book-card-genre">
                            {genreLabels[book.genre] || book.genre}
                            {book.subgenre ? ` · ${subgenreLabels[book.subgenre] || book.subgenre}` : ''}
                          </span>
                          <span className="book-card-status">{statusLabels[book.status] || book.status}</span>
                        </div>
                        <div className="book-card-extra">
                          <span>{book.updated_at || book.created_at ? formatDate(book.updated_at || book.created_at) : '刚创建'}</span>
                          <span>{(book.word_count || 0) > 0 ? formatWords(book.word_count || 0) : '暂无字数'}</span>
                        </div>
                        <span className="book-card-platform">{getPlatformLabel(book.platform)}</span>
                      </div>
                      <div className="book-card-actions">
                        {!isCurrent ? (
                          <button
                            type="button"
                            className="ghost-btn action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentBook(book.id);
                            }}
                          >
                            设为当前
                          </button>
                        ) : (
                          <span className="book-card-current-note">主工作台使用中</span>
                        )}
                        <button
                          type="button"
                          className="ghost-btn action-btn"
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
        <section className="workbench-stage">
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
                        {deleteLoading ? '清空中...' : '清空已有角色'}
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
                              <span>{option.label}</span>
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
                            {roleTierOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                                    {roleTierLabelMap[draft.role_tier || character.role_tier || 'supporting_major'] || '普通配角'}
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
                                    <button type="button" className="ghost-btn" onClick={() => setEditingCharacterKey(characterKey)}>
                                      编辑
                                    </button>
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
                                      {roleTierOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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

              <div className="detail-side">
                <div className="detail-panel">
                  <h3>快捷入口</h3>
                  <div className="detail-action-grid">
                    <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(detailBook.id)}>进入创作台</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksSummaryPage(detailBook.id)}>查看汇总页</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksOutlinePage(detailBook.id)}>大纲链页</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksChapterPage(detailBook.id)}>章节与正文页</button>
                    {detailBook.id !== currentBookId ? (
                      <button type="button" className="ghost-btn action-btn" onClick={() => setCurrentBook(detailBook.id)}>设为当前</button>
                    ) : (
                      <span className="current-book-badge">当前使用中</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {view === 'detail' && detailBook && isOutlinePage ? (
        <section className="workbench-stage">
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
                  <h3>大纲链档案</h3>
                  <div className="detail-panel-actions">
                    <button type="button" className="solid-btn" onClick={outlineEditing ? stopOutlineEditing : startOutlineEditing}>
                      {outlineEditing ? '收起编辑' : '编辑大纲'}
                    </button>
                    <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(detailBook.id)}>去工作台写章节</button>
                  </div>
                  {outlineError ? <div className="global-banner is-error">{outlineError}</div> : null}
                  {outlineNotice ? <div className="global-banner">{outlineNotice}</div> : null}
                  <div className="detail-outline-grid">
                    <div className="detail-outline-section">
                      <div className="detail-section-head">
                        <strong>全书大纲</strong>
                        {outlineEditing ? (
                          <button type="button" className="ghost-btn" onClick={handleSaveOutline} disabled={outlineSaving}>
                            {outlineSaving ? '保存中...' : '保存'}
                          </button>
                        ) : null}
                      </div>
                      {outlineEditing ? (
                        <textarea
                          className="detail-inline-textarea"
                          rows={8}
                          value={outlineDraft.main_outline}
                          onChange={(e) => setOutlineDraft((prev) => ({ ...prev, main_outline: e.target.value }))}
                          placeholder="写这本书整体在讲什么。"
                        />
                      ) : detailOutline?.main_outline ? (
                        <pre className="detail-pre">{detailOutline.main_outline}</pre>
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
                          <button type="button" className="ghost-btn detail-inline-primary-action" onClick={handleGenerateVolumePlans} disabled={outlineSaving}>
                            {outlineSaving ? '处理中...' : '自动拆分分卷'}
                          </button>
                          <span className="detail-inline-toolbar-hint">填 0 表示让模型自行判断分卷数量。</span>
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
                                volume_name: plan.volume_name || '',
                                stage_goal: plan.stage_goal || '',
                                core_conflict: plan.core_conflict || '',
                                notes: plan.notes || '',
                                cover_image: plan.cover_image || ''
                              };
                              const volumeKey = String(volumeNumber);
                              const isSavingCurrent = volumePlanSavingKey === volumeKey;
                              const isEditingCurrent = editingVolumeKey === volumeKey;
                              return (
                                <article key={plan.id || `${plan.book_id}-${plan.volume_number}`} className="detail-outline-volume">
                                  <div className="detail-section-head">
                                    <strong>第 {volumeNumber} 卷 · {draft.volume_name || plan.volume_name || '未命名分卷'}</strong>
                                    <div className="detail-inline-actions">
                                      {isEditingCurrent ? (
                                        <>
                                          <button type="button" className="ghost-btn" onClick={() => setEditingVolumeKey('')} disabled={isSavingCurrent}>
                                            取消
                                          </button>
                                          <button type="button" className="ghost-btn" onClick={() => handleSaveVolumePlan(volumeNumber)} disabled={isSavingCurrent || outlineSaving}>
                                            {isSavingCurrent ? '保存中...' : '保存本卷'}
                                          </button>
                                        </>
                                      ) : (
                                        <button type="button" className="ghost-btn" onClick={() => setEditingVolumeKey(volumeKey)} disabled={outlineSaving}>
                                          编辑
                                        </button>
                                      )}
                                    </div>
                                  </div>
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
                                      {draft.cover_image ? (
                                        <div className="detail-cover-preview">
                                          <img src={draft.cover_image} alt={`第${volumeNumber}卷封面预览`} className="detail-cover-preview-image" />
                                        </div>
                                      ) : null}
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
                                      {plan.cover_image ? (
                                        <div className="detail-cover-preview">
                                          <img src={plan.cover_image} alt={`第${volumeNumber}卷封面`} className="detail-cover-preview-image" />
                                        </div>
                                      ) : null}
                                      {plan.stage_goal ? <p className="excerpt-text"><b>阶段目标：</b>{plan.stage_goal}</p> : null}
                                      {plan.core_conflict ? <p className="excerpt-text"><b>核心冲突：</b>{plan.core_conflict}</p> : null}
                                      {plan.notes ? <p className="excerpt-text"><b>卷内说明：</b>{plan.notes}</p> : null}
                                    </div>
                                  )}
                                </article>
                              );
                            })}
                        </div>
                      ) : detailOutline?.volume_outline ? (
                        <pre className="detail-pre">{detailOutline.volume_outline}</pre>
                      ) : (
                        <p className="excerpt-text">暂无分卷大纲。</p>
                      )}
                    </div>
                    <div className="detail-outline-section">
                      <div className="detail-section-head">
                        <strong>细节补充</strong>
                      </div>
                      {outlineEditing ? (
                        <textarea
                          className="detail-inline-textarea"
                          rows={5}
                          value={outlineDraft.detailed_outline}
                          onChange={(e) => setOutlineDraft((prev) => ({ ...prev, detailed_outline: e.target.value }))}
                          placeholder="补充关键伏笔、限制条件、风格提醒等。"
                        />
                      ) : detailOutline?.detailed_outline ? (
                        <pre className="detail-pre">{detailOutline.detailed_outline}</pre>
                      ) : null}
                    </div>
                    <div className="detail-outline-section">
                      <strong>剧情线大纲</strong>
                      {storylineGroups.length > 0 ? (
                        <div className="detail-volume-plan-list">
                          {storylineGroups.map((group) => (
                            <section key={`storyline-volume-${group.volumeNumber}`} className="detail-outline-volume">
                              <strong>第 {group.volumeNumber} 卷剧情线</strong>
                              <div className="detail-storyline-list">
                                {group.items.map((storyline) => (
                                  <div key={storyline.id} className="detail-storyline-item">
                                    <p className="excerpt-text"><b>{storyline.storyline_name || '未命名剧情线'}</b>{storyline.storyline_type ? ` · ${storyline.storyline_type}` : ''}</p>
                                    {storyline.core_conflict ? <p className="excerpt-text"><b>核心冲突：</b>{storyline.core_conflict}</p> : null}
                                    {storyline.description ? <p className="excerpt-text"><b>说明：</b>{storyline.description}</p> : null}
                                    <p className="excerpt-text">预计第 {Number(storyline.start_chapter || 1)} - {Number(storyline.end_chapter || 1)} 章</p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      ) : (
                        <p className="excerpt-text">暂无剧情线大纲。</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="detail-side">
                <div className="detail-panel">
                  <h3>分页面入口</h3>
                  <div className="detail-action-grid">
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksSummaryPage(detailBook.id)}>汇总页</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksCharacterPage(detailBook.id)}>角色页</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksChapterPage(detailBook.id)}>章节与正文页</button>
                    <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(detailBook.id)}>进入创作台</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {view === 'detail' && detailBook && isChapterPage ? (
        <section className="workbench-stage">
          <div className="detail-header">
            <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksSummaryPage(detailBook.id)}>返回汇总页</button>
            <div className="detail-header-main">
              <h2>{detailBook.title}</h2>
              <div className="detail-header-meta">
                <span className="detail-meta-chip">章节与正文页</span>
                {detailBook.id === currentBookId ? <span className="detail-meta-chip">当前使用中</span> : null}
              </div>
            </div>
          </div>

          {detailLoading ? (
            <div className="global-banner">正在加载章节与正文...</div>
          ) : (
            <div className="detail-grid">
              <div className="detail-main">
                <div className="detail-panel">
                  <div className="detail-panel-actions">
                    <h3>章节细纲与正文</h3>
                    <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(detailBook.id)}>去创作台继续写</button>
                  </div>
                  {chapterEntries.length > 0 ? (
                    <div className="chapter-entry-list">
                      {chapterEntries.map(({ chapterNumber, chapter, plan }) => (
                        <article key={`chapter-entry-${chapterNumber}`} className="chapter-entry-card">
                          <div className="detail-section-head">
                            <strong>第 {chapterNumber} 章 · {plan?.chapter_name || chapter?.chapter_name || chapter?.title || '未命名章节'}</strong>
                            <span className="detail-entry-meta">
                              {chapter?.word_count ? `${formatWords(chapter.word_count)} · ` : ''}
                              {formatDate((chapter?.updated_at || plan?.updated_at || chapter?.created_at || plan?.created_at))}
                            </span>
                          </div>
                          {plan?.chapter_mission ? <p className="excerpt-text"><b>本章目标：</b>{plan.chapter_mission}</p> : null}
                          {plan?.summary ? <p className="excerpt-text"><b>章节摘要：</b>{plan.summary}</p> : null}
                          {plan?.outline_text ? <pre className="detail-pre">{String(plan.outline_text).slice(0, 260)}{String(plan.outline_text).length > 260 ? '...' : ''}</pre> : null}
                          {chapter?.content ? <pre className="detail-pre">{String(chapter.content).slice(0, 320)}{String(chapter.content).length > 320 ? '...' : ''}</pre> : <p className="excerpt-text">正文尚未生成。</p>}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="excerpt-text">暂无章节细纲和正文记录。</p>
                  )}
                </div>
              </div>

              <div className="detail-side">
                <div className="detail-panel">
                  <h3>分页面入口</h3>
                  <div className="detail-action-grid">
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksSummaryPage(detailBook.id)}>汇总页</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksOutlinePage(detailBook.id)}>大纲链页</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksCharacterPage(detailBook.id)}>角色页</button>
                    <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(detailBook.id)}>进入创作台</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {view === 'detail' && detailBook && !isSubPage ? (
        <section className="workbench-stage">
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
              <div className="detail-panel summary-overview-panel">
                <div className="summary-overview-head">
                  <div>
                    <h3>全书汇总</h3>
                    <p>先看整体结构，再进入具体分页面继续维护。</p>
                  </div>
                </div>
                <div className="summary-metric-grid">
                  <div className="summary-metric-card">
                    <strong>{detailVolumePlans.length}</strong>
                    <span>分卷</span>
                  </div>
                  <div className="summary-metric-card">
                    <strong>{detailStorylines.length}</strong>
                    <span>剧情线</span>
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

              <div className="detail-panel">
                <h3>进入分页面</h3>
                <div className="summary-nav-grid summary-nav-grid-hub">
                  <button type="button" className="summary-nav-card summary-nav-button summary-nav-card-outline" onClick={() => openBooksOutlinePage(detailBook.id)}>
                    <span className="summary-nav-kicker">Story Structure</span>
                    <strong>大纲链页</strong>
                    <span>全书大纲、分卷大纲、剧情线大纲</span>
                    <em>进入结构规划</em>
                  </button>
                  <button type="button" className="summary-nav-card summary-nav-button summary-nav-card-character" onClick={() => openBooksCharacterPage(detailBook.id)}>
                    <span className="summary-nav-kicker">Character Core</span>
                    <strong>角色页</strong>
                    <span>角色档案、人物设定</span>
                    <em>进入人物设定</em>
                  </button>
                  <button type="button" className="summary-nav-card summary-nav-button summary-nav-card-chapter" onClick={() => openBooksChapterPage(detailBook.id)}>
                    <span className="summary-nav-kicker">Chapter Flow</span>
                    <strong>章节与正文页</strong>
                    <span>章节细纲、章节记录、正文预览</span>
                    <em>进入执行区</em>
                  </button>
                </div>
              </div>

              <div className="summary-bottom-grid">
                <div className="detail-panel">
                  <h3>书籍信息</h3>
                  <ul className="meta-list">
                    <li>题材：{genreLabels[detailBook.genre] || detailBook.genre}</li>
                    <li>子分类：{subgenreLabels[detailBook.subgenre] || detailBook.subgenre || '未设置'}</li>
                    <li>平台：{getPlatformLabel(detailBook.target_platform)}</li>
                    <li>状态：{statusLabels[detailBook.status] || detailBook.status}</li>
                    <li>作者：{detailBook.author || '未知'}</li>
                    <li>简介：{detailBook.description || '暂无简介'}</li>
                  </ul>
                </div>
                <div className="detail-panel">
                  <h3>快捷操作</h3>
                  <div className="detail-action-grid">
                    <button type="button" className="ghost-btn nav-btn" onClick={goBackToList}>返回列表</button>
                    <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(detailBook.id)}>进入创作台</button>
                    <button type="button" className="solid-btn" onClick={openEditEditor}>编辑基础信息</button>
                    {detailBook.id !== currentBookId ? (
                      <button type="button" className="ghost-btn action-btn" onClick={() => setCurrentBook(detailBook.id)}>设为当前</button>
                    ) : (
                      <span className="current-book-badge">当前使用中</span>
                    )}
                    <button type="button" className="ghost-btn action-btn" onClick={() => deleteBook(detailBook.id)} disabled={deleteLoading}>删除书籍</button>
                  </div>
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

      <style>{`
        .hero-note-card-stack { display: grid; gap: 12px; min-width: 260px; }
        .hero-note-card-stack p { margin: 4px 0 0; color: var(--muted); }
        .hero-note-card-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
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
          background: #ecfdf5;
          color: #166534;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .stats-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        .stats-card { padding: 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); display: grid; gap: 4px; }
        .stats-card strong { font-size: 24px; color: var(--stat-color, var(--text)); }
        .stats-card span { font-size: 12px; color: var(--muted); }
        .library-list-top-grid {
          display: grid;
          grid-template-columns: minmax(320px, 1.05fr) minmax(280px, 0.95fr);
          gap: 16px;
          margin-bottom: 16px;
          align-items: stretch;
        }
        .library-action-panel,
        .library-status-panel { display: grid; gap: 14px; }
        .library-action-panel {
          align-content: start;
          padding-bottom: 20px;
        }
        .library-action-panel h3,
        .library-status-panel h3 {
          margin: 0;
        }
        .library-action-panel .detail-action-grid {
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          margin-top: 4px;
        }
        .library-action-panel .solid-btn,
        .library-action-panel .ghost-btn {
          min-height: 42px;
          padding-inline: 18px;
          font-size: 15px;
        }
        .library-status-row { margin-bottom: 0; }
        .library-status-meta { display: flex; flex-wrap: wrap; gap: 10px; color: var(--muted); font-size: 13px; }
        .filter-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 2fr) repeat(3, minmax(180px, 1fr)) auto;
          gap: 12px;
          align-items: end;
          margin-bottom: 16px;
          padding: 16px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: rgba(255, 252, 247, 0.88);
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
        .batch-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255, 252, 247, 0.9); }
        .batch-toolbar-info { display: flex; gap: 10px; align-items: center; }
        .batch-toolbar-info strong { font-size: 14px; }
        .batch-toolbar-info span { color: var(--muted); font-size: 13px; }
        .batch-toolbar-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .list-tools-merged-panel {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }
        .list-tools-inline-row {
          width: 100%;
          align-items: center;
          justify-content: flex-start;
          flex-wrap: wrap;
        }
        .book-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .book-card { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 12px; align-items: start; padding: 18px; border: 1px solid rgba(217, 181, 142, 0.2); border-radius: 18px; background: linear-gradient(180deg, rgba(255, 252, 247, 0.98), rgba(255, 246, 232, 0.88)); box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04); cursor: pointer; transition: border-color 140ms ease, background 140ms ease, transform 140ms ease, box-shadow 140ms ease; }
        .book-card:hover { border-color: rgba(194, 120, 48, 0.34); transform: translateY(-2px); box-shadow: 0 14px 30px rgba(194, 120, 48, 0.08); }
        .book-card.is-selected { border-color: rgba(59, 130, 246, 0.36); background: linear-gradient(180deg, rgba(239, 246, 255, 0.92), rgba(230, 242, 255, 0.82)); }
        .book-card.is-current { box-shadow: inset 0 0 0 1px rgba(30, 64, 175, 0.08), 0 12px 30px rgba(15, 23, 42, 0.05); }
        .book-card-checkbox { width: 16px; height: 16px; margin-top: 4px; accent-color: var(--brand); }
        .book-card-body { min-width: 0; display: flex; flex-direction: column; gap: 8px; min-height: 100%; }
        .book-card-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .book-card-body h3 { margin: 0; font-size: 16px; line-height: 1.4; word-break: break-word; }
        .book-card-meta { display: flex; gap: 8px; flex-wrap: wrap; }
        .book-card-genre { font-size: 12px; color: var(--muted); }
        .book-card-status { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--brand-soft); color: var(--brand); font-weight: 600; }
        .book-card-extra { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
        .book-card-platform { font-size: 12px; color: var(--muted); }
        .book-card-actions { display: flex; align-items: center; justify-content: flex-start; gap: 8px; flex-wrap: nowrap; margin-top: auto; padding-top: 12px; border-top: 1px dashed rgba(217, 181, 142, 0.28); }
        .book-card-actions .ghost-btn { flex: 0 0 auto; white-space: nowrap; min-width: 0; }
        .book-card-current-note { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 999px; background: #ecfdf5; color: #166534; font-size: 12px; font-weight: 600; white-space: nowrap; flex: 0 0 auto; }
        .detail-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
        .detail-header-main { min-width: 0; }
        .detail-header h2 { margin: 0 0 8px; }
        .detail-header-meta { display: flex; flex-wrap: wrap; gap: 8px; }
        .detail-meta-chip { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; background: var(--brand-soft); color: var(--brand); font-size: 12px; font-weight: 600; white-space: nowrap; }
        .detail-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); gap: 16px; align-items: start; }
        .detail-grid-character { grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.8fr); }
        .detail-main, .detail-side { display: grid; gap: 16px; }
        .summary-hub { display: grid; gap: 16px; }
        .summary-overview-panel { display: grid; gap: 16px; }
        .summary-overview-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .summary-overview-head h3 { margin: 0 0 6px; }
        .summary-overview-head p { margin: 0; color: var(--muted); line-height: 1.6; }
        .summary-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .summary-metric-card { padding: 16px; border: 1px solid var(--line); border-radius: var(--radius-panel-sm); background: color-mix(in srgb, var(--panel-strong) 84%, transparent); }
        .summary-metric-card strong { display: block; font-size: var(--font-size-section-title); line-height: 1; color: var(--text); }
        .summary-metric-card span { display: block; margin-top: 8px; font-size: 13px; color: var(--muted); }
        .summary-bottom-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr); gap: 16px; }
        .detail-panel { box-shadow: var(--shadow); }
        .detail-panel { padding: 18px; border: 1px solid var(--line); border-radius: var(--radius-panel-sm); background: var(--panel); }
        .detail-panel h3 { margin: 0 0 12px; font-size: var(--font-size-panel-title); }
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
        .summary-nav-grid-hub { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .summary-nav-card {
          position: relative;
          display: grid;
          align-content: start;
          gap: 10px;
          min-height: 220px;
          padding: 22px 22px 20px;
          border: 1px solid var(--line-strong);
          border-radius: var(--radius-panel-lg);
          overflow: hidden;
          background: linear-gradient(180deg, color-mix(in srgb, var(--panel-card-bg) 92%, white), color-mix(in srgb, var(--panel-card-bg) 92%, var(--brand-soft)));
        }
        .summary-nav-card::after {
          content: '';
          position: absolute;
          inset: auto 20px 0 auto;
          width: 120px;
          height: 120px;
          border-radius: 999px;
          background: radial-gradient(circle, var(--brand-soft-strong), rgba(194, 120, 48, 0));
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
          transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }
        .summary-nav-button:hover {
          transform: translateY(-3px);
          border-color: var(--badge-border);
          box-shadow: 0 18px 34px color-mix(in srgb, var(--brand) 16%, transparent);
        }
        .summary-nav-card-outline {
          background: linear-gradient(180deg, color-mix(in srgb, var(--panel-card-bg) 90%, white), color-mix(in srgb, var(--panel-card-bg) 84%, var(--brand-soft)));
        }
        .summary-nav-card-character {
          background: linear-gradient(180deg, rgba(255, 252, 247, 0.98), rgba(245, 238, 227, 0.94));
        }
        .summary-nav-card-chapter {
          background: linear-gradient(180deg, rgba(255, 249, 241, 0.98), rgba(255, 234, 214, 0.92));
        }
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
          background: #fff;
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
          background: #fff;
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
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 10px 12px;
          background: #fff;
          color: var(--text);
          font: inherit;
          line-height: 1.6;
        }
        .detail-inline-field textarea { resize: vertical; }
        .detail-inline-field em { font-size: 12px; color: var(--muted); font-style: normal; }
        .detail-inline-editor { display: grid; gap: 10px; margin-top: 6px; }
        .detail-inline-display { display: grid; gap: 4px; }
        .detail-character-ai-box { margin-bottom: 14px; padding: 14px; border: 1px solid rgba(217, 181, 142, 0.22); border-radius: 12px; background: rgba(255, 248, 240, 0.66); }
        .detail-character-role-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
        .detail-role-count-field.is-warning input { border-color: #d68d21; background: rgba(255, 247, 230, 0.9); }
        .detail-character-metric-strip { display: flex; flex-wrap: wrap; gap: 8px; }
        .detail-character-metric-strip span { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.82); color: var(--brand); font-size: 12px; font-weight: 600; }
        .detail-character-metric-list { display: grid; gap: 6px; margin-top: 6px; }
        .detail-volume-plan-list { display: grid; gap: 10px; }
        .detail-outline-volume { padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255, 252, 247, 0.7); }
        .detail-outline-volume strong { display: block; margin-bottom: 6px; color: var(--brand); }
        .detail-storyline-list { display: grid; gap: 8px; }
        .detail-storyline-item { padding-top: 8px; border-top: 1px dashed rgba(148, 163, 184, 0.28); }
        .detail-storyline-item:first-child { padding-top: 0; border-top: 0; }
        .detail-pre { margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(255, 248, 240, 0.7); white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 14px; line-height: 1.7; color: var(--text); }
        .detail-chapter-list, .detail-character-list { display: grid; gap: 8px; }
        .chapter-entry-list { display: grid; gap: 12px; }
        .chapter-entry-card { padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255, 252, 247, 0.72); display: grid; gap: 8px; }
        .detail-chapter-item, .detail-character-item { padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255, 252, 247, 0.6); }
        .detail-character-item-editing { margin-bottom: 12px; background: rgba(255, 248, 240, 0.72); }
        .detail-character-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .detail-role-tier-badge { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        .detail-role-tier-badge-protagonist { background: rgba(191, 90, 36, 0.16); color: #9a4f17; }
        .detail-role-tier-badge-supporting_major { background: rgba(42, 106, 179, 0.14); color: #1f5d9c; }
        .detail-role-tier-badge-supporting_minor { background: rgba(92, 121, 74, 0.16); color: #52703a; }
        .detail-role-tier-badge-antagonist_major { background: rgba(150, 46, 46, 0.16); color: #922f2f; }
        .detail-role-tier-badge-antagonist_minor { background: rgba(104, 69, 138, 0.14); color: #68458a; }
        .detail-character-item-protagonist { background: linear-gradient(180deg, rgba(255, 246, 235, 0.92), rgba(255, 240, 222, 0.82)); border-color: rgba(191, 90, 36, 0.18); }
        .detail-character-item-supporting_major { background: linear-gradient(180deg, rgba(241, 247, 255, 0.92), rgba(233, 241, 253, 0.82)); border-color: rgba(42, 106, 179, 0.16); }
        .detail-character-item-supporting_minor { background: linear-gradient(180deg, rgba(245, 250, 241, 0.92), rgba(236, 245, 231, 0.82)); border-color: rgba(92, 121, 74, 0.16); }
        .detail-character-item-antagonist_major { background: linear-gradient(180deg, rgba(255, 241, 241, 0.92), rgba(250, 232, 232, 0.82)); border-color: rgba(150, 46, 46, 0.16); }
        .detail-character-item-antagonist_minor { background: linear-gradient(180deg, rgba(247, 241, 252, 0.92), rgba(239, 232, 247, 0.82)); border-color: rgba(104, 69, 138, 0.16); }
        .detail-character-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .detail-character-avatar {
          width: 56px;
          height: 56px;
          object-fit: cover;
          border-radius: 16px;
          border: 1px solid rgba(217, 181, 142, 0.22);
          background: rgba(255, 252, 247, 0.82);
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
          flex: 0 0 auto;
        }
        .avatar-crop-modal { width: min(560px, calc(100vw - 48px)); max-height: calc(100vh - 48px); border-radius: 20px; overflow: hidden; }
        .avatar-crop-body { padding: 24px 24px 12px; background: rgba(255, 252, 247, 0.9); }
        .avatar-crop-stage {
          position: relative;
          width: 320px;
          height: 320px;
          margin: 0 auto;
          overflow: hidden;
          border-radius: 24px;
          background:
            linear-gradient(45deg, rgba(217, 181, 142, 0.14) 25%, transparent 25%, transparent 75%, rgba(217, 181, 142, 0.14) 75%),
            linear-gradient(45deg, rgba(217, 181, 142, 0.14) 25%, transparent 25%, transparent 75%, rgba(217, 181, 142, 0.14) 75%);
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
          box-shadow: inset 0 0 0 999px rgba(15, 23, 42, 0.18);
          pointer-events: none;
        }
        .avatar-crop-frame {
          position: absolute;
          inset: 0;
          border: 2px solid rgba(255, 255, 255, 0.92);
          border-radius: 24px;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12);
          pointer-events: none;
        }
        .avatar-crop-actions { padding-inline: 24px; padding-bottom: 20px; background: rgba(255, 252, 247, 0.96); }
        .detail-chapter-item strong, .detail-character-item strong { display: block; margin-bottom: 4px; }
        .detail-chapter-meta { font-size: 12px; color: var(--muted); display: block; margin-bottom: 6px; }
        .detail-entry-meta { font-size: 12px; color: var(--muted); white-space: nowrap; }
        .modal-backdrop { position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-start; justify-content: center; padding: 40px; background: rgba(15, 23, 42, 0.34); overflow: auto; }
        .book-editor-modal { width: min(580px, calc(100vw - 80px)); max-height: calc(100vh - 80px); margin: 0 auto; border-radius: var(--radius-panel-md); box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16); overflow: hidden; display: flex; flex-direction: column; }
        .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 0; padding: 18px 28px 14px; border-bottom: 1px solid var(--line); background: rgba(255, 250, 242, 0.86); }
        .modal-head-text { display: grid; gap: 2px; }
        .modal-head h3 { margin: 0; font-size: 16px; }
        .modal-head p { margin: 0; color: var(--muted); line-height: 1.35; font-size: 12px; }
        .book-editor-form { display: grid; gap: 10px; padding: 16px 28px 22px; background: rgba(255, 252, 247, 0.72); overflow: auto; }
        .field { display: grid; gap: 6px; }
        .field-full { grid-column: 1 / -1; }
        .field span { font-size: 13px; font-weight: 600; color: var(--text); }
        .field input, .field select, .field textarea { width: 100%; border: 1px solid var(--line); border-radius: 11px; padding: 11px 13px; background: #fff; color: var(--text); font: inherit; }
        .field textarea { resize: vertical; min-height: 108px; }
        .form-grid-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; position: sticky; bottom: 0; background: rgba(255, 252, 247, 0.96); }
        @media (max-width: 900px) {
          .stats-row, .library-list-top-grid, .filter-toolbar, .form-grid-two, .detail-grid, .detail-summary-row, .detail-summary-row-quad, .summary-nav-grid, .summary-metric-grid, .summary-bottom-grid, .detail-character-role-grid { grid-template-columns: 1fr; }
          .batch-toolbar { align-items: flex-start; flex-direction: column; }
          .batch-toolbar, .detail-header, .modal-head, .summary-overview-head { align-items: stretch; flex-direction: column; }
          .book-card-grid { grid-template-columns: 1fr; }
          .hero-note-card-stack { min-width: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
