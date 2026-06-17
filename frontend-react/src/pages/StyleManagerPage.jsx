import { useEffect, useMemo, useState } from 'react';
import '../styles.css';
import '../app-shell.css';
import {
  ACTION_THEME_OPTIONS,
  BRAND_THEME_OPTIONS,
  DENSITY_THEME_OPTIONS,
  NAV_THEME_OPTIONS,
  PAGE_THEME_OPTIONS,
  PANEL_THEME_OPTIONS,
  RADIUS_THEME_OPTIONS,
  STATUS_THEME_OPTIONS,
  STYLE_THEME_PRESETS,
  TITLE_THEME_OPTIONS,
  applyStyleTheme,
  deleteCustomStyleTheme,
  getStoredActiveStyleThemeId,
  getStoredStyleTheme,
  getStyleThemeLibrary,
  saveCustomStyleTheme,
  saveStoredActiveStyleThemeId,
  saveStyleTheme
} from '../styleTheme.js';

const FIELD_GROUPS = [
  {
    key: 'atmosphere',
    title: '页面氛围',
    fields: [
      {
        key: 'pageTheme',
        label: '背景气氛',
        description: '决定整站底色、顶部氛围和页面空气感。',
        options: PAGE_THEME_OPTIONS
      },
      {
        key: 'brandTheme',
        label: '强调色',
        description: '决定橙字、重点边线、主要强调区域的色彩。',
        options: BRAND_THEME_OPTIONS
      },
      {
        key: 'statusTheme',
        label: '提示强度',
        description: '决定标签、成功/警告/错误提示的存在感。',
        options: STATUS_THEME_OPTIONS
      }
    ]
  },
  {
    key: 'buttons',
    title: '按钮风格',
    fields: [
      {
        key: 'navTheme',
        label: '导航按钮',
        description: '影响跳转入口、路由导航、页面切换型按钮。',
        options: NAV_THEME_OPTIONS
      },
      {
        key: 'actionTheme',
        label: '操作按钮',
        description: '影响刷新、清空、编辑、提交这类工具动作。',
        options: ACTION_THEME_OPTIONS
      }
    ]
  },
  {
    key: 'surface',
    title: '卡片与结构',
    fields: [
      {
        key: 'panelTheme',
        label: '面板气质',
        description: '控制卡片底色、边线、阴影和玻璃感。',
        options: PANEL_THEME_OPTIONS
      },
      {
        key: 'radiusTheme',
        label: '轮廓圆角',
        description: '控制卡片、控件和按钮整体的边角性格。',
        options: RADIUS_THEME_OPTIONS
      },
      {
        key: 'densityTheme',
        label: '布局密度',
        description: '控制留白、按钮高度、卡片内间距和页面节奏。',
        options: DENSITY_THEME_OPTIONS
      }
    ]
  },
  {
    key: 'fine',
    title: '细节微调',
    fields: [
      {
        key: 'colorStrength',
        label: '强调力度',
        description: '控制强调色在标签、边线和按钮里的浓度。',
        kind: 'range',
        min: 70,
        max: 140,
        step: 5,
        suffix: '%'
      },
      {
        key: 'backgroundGlow',
        label: '背景氛围',
        description: '控制页面底色和晕染感的存在感。',
        kind: 'range',
        min: 70,
        max: 140,
        step: 5,
        suffix: '%'
      },
      {
        key: 'spacingScale',
        label: '留白倍率',
        description: '控制页边距、卡片间距和内部留白。',
        kind: 'range',
        min: 85,
        max: 120,
        step: 5,
        suffix: '%'
      },
      {
        key: 'controlScale',
        label: '控件尺寸',
        description: '控制按钮和输入框的高度与横向呼吸感。',
        kind: 'range',
        min: 90,
        max: 120,
        step: 5,
        suffix: '%'
      }
    ]
  },
  {
    key: 'title',
    title: '标题节奏',
    fields: [
      {
        key: 'titleTheme',
        label: '标题层级',
        description: '控制主标题、区块标题、数字信息的压迫感。',
        options: TITLE_THEME_OPTIONS
      }
    ]
  }
];

const THEME_COVERAGE_GROUPS = [
  { label: '基础壳层', status: '已接入', note: '页面背景、导航栏、主按钮、公共面板' },
  { label: '创作台主卡', status: '已接入', note: '全书规划三张主卡与入口卡已吃到主题变量' },
  { label: '资料库详情', status: '已接入', note: '详情面板、导航卡、摘要指标卡已联动' },
  { label: '系统提示', status: '已接入', note: '状态条、标签、警告/成功/错误提示已联动' },
  { label: '章节生成区', status: '已接入', note: '生成控制、禁止项、反馈承接、节奏提示已联动' },
  { label: '校改阅读区', status: '已接入', note: '对照阅读、差异高亮、建议面板、弹窗导航已联动' },
  { label: '长尾业务卡', status: '过渡中', note: '仍有少量历史卡片在逐步清理旧写死样式' }
];

const PREVIEW_SCENES = [
  { key: 'book', title: '书籍主卡', note: '集中看封面主卡、摘要和核心指标。' },
  { key: 'entry', title: '入口操作', note: '集中看导航按钮、操作按钮和切换入口。' },
  { key: 'list', title: '列表状态', note: '集中看列表页的行卡、筛选和轻操作。' },
  { key: 'status', title: '提示系统', note: '集中看状态条、生成提醒和接入覆盖。' }
];

function createLabelMap(options) {
  return Object.fromEntries(options.map((option) => [option.value, option.label]));
}

function normalizeTheme(theme) {
  return JSON.stringify(theme);
}

function sanitizeThemeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function createThemeId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildThemeSummary(theme, labels) {
  return [
    labels.pageTheme[theme.pageTheme],
    labels.panelTheme[theme.panelTheme],
    labels.densityTheme[theme.densityTheme]
  ].filter(Boolean).join(' / ');
}

function buildDerivedThemeName(baseName, existingNames, suffix = '副本') {
  const cleanedBase = sanitizeThemeName(baseName) || '自定义主题';
  const preferred = suffix ? `${cleanedBase} ${suffix}` : cleanedBase;
  if (!existingNames.has(preferred)) return preferred;
  let index = 2;
  while (existingNames.has(`${preferred} ${index}`)) {
    index += 1;
  }
  return `${preferred} ${index}`;
}

function OptionPill({ active, label, onClick }) {
  return (
    <button
      type="button"
      className={`style-option-pill${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <strong>{label}</strong>
    </button>
  );
}

function FieldPanel({ field, value, onChange }) {
  if (field.kind === 'range') {
    return (
      <section className="style-field-panel style-field-panel-range">
        <div className="style-field-head">
          <div className="style-field-title-row">
            <strong>{field.label}</strong>
            <span className="style-field-active">{`${value}${field.suffix || ''}`}</span>
          </div>
        </div>
        <div className="style-range-control">
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <div className="style-range-meta">
            <span>{`${field.min}${field.suffix || ''}`}</span>
            <strong>{`${value}${field.suffix || ''}`}</strong>
            <span>{`${field.max}${field.suffix || ''}`}</span>
          </div>
        </div>
      </section>
    );
  }

  const activeOption = field.options.find((option) => option.value === value);

  return (
    <section className="style-field-panel">
      <div className="style-field-head">
        <div className="style-field-title-row">
          <strong>{field.label}</strong>
          {activeOption ? <span className="style-field-active">{activeOption.label}</span> : null}
        </div>
      </div>
      <div className={`style-option-grid style-option-grid-${field.options.length}`}>
        {field.options.map((option) => (
          <OptionPill
            key={option.value}
            active={value === option.value}
            label={option.label}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </section>
  );
}

function ThemeGroupEditor({ group, theme, onChange }) {
  return (
    <div className="style-manager-control-stack">
      <div className={`style-group-fields${group.key === 'fine' ? ' is-range-grid' : ''}`}>
        {group.fields.map((field) => (
          <FieldPanel
            key={field.key}
            field={field}
            value={theme[field.key]}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
    </div>
  );
}

function CompactThemeBadge({ label, value }) {
  return (
    <div className="style-state-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ThemeRecordCard({ label, value }) {
  return (
    <div className="style-theme-record-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ThemeCoverageCard({ label, status, note }) {
  const statusClass = status === '已接入' ? 'is-ready' : 'is-progress';
  return (
    <div className="style-theme-coverage-card">
      <div className="style-theme-coverage-head">
        <strong>{label}</strong>
        <span className={`style-theme-coverage-badge ${statusClass}`}>{status}</span>
      </div>
      <p>{note}</p>
    </div>
  );
}

export default function StyleManagerPage() {
  const [theme, setTheme] = useState(() => getStoredStyleTheme());
  const [activeSection, setActiveSection] = useState('quick');
  const [activePreview, setActivePreview] = useState('book');
  const [themeLibrary, setThemeLibrary] = useState(() => getStyleThemeLibrary());
  const [activeThemeId, setActiveThemeId] = useState(() => getStoredActiveStyleThemeId());
  const [themeNameInput, setThemeNameInput] = useState('');

  const labels = useMemo(() => ({
    pageTheme: createLabelMap(PAGE_THEME_OPTIONS),
    brandTheme: createLabelMap(BRAND_THEME_OPTIONS),
    navTheme: createLabelMap(NAV_THEME_OPTIONS),
    actionTheme: createLabelMap(ACTION_THEME_OPTIONS),
    panelTheme: createLabelMap(PANEL_THEME_OPTIONS),
    radiusTheme: createLabelMap(RADIUS_THEME_OPTIONS),
    densityTheme: createLabelMap(DENSITY_THEME_OPTIONS),
    titleTheme: createLabelMap(TITLE_THEME_OPTIONS),
    statusTheme: createLabelMap(STATUS_THEME_OPTIONS)
  }), []);

  useEffect(() => {
    applyStyleTheme(theme);
    saveStyleTheme(theme);
  }, [theme]);

  useEffect(() => {
    const currentRecord = themeLibrary.find((record) => record.id === activeThemeId) || themeLibrary[0];
    if (!currentRecord) return;
    setThemeNameInput(currentRecord.label);
  }, [activeThemeId, themeLibrary]);

  const activeThemeRecord = useMemo(
    () => themeLibrary.find((record) => record.id === activeThemeId) || themeLibrary[0] || null,
    [activeThemeId, themeLibrary]
  );

  const isDirty = useMemo(() => {
    if (!activeThemeRecord) return false;
    return normalizeTheme(theme) !== normalizeTheme(activeThemeRecord.theme);
  }, [activeThemeRecord, theme]);

  const activePresetId = useMemo(() => {
    const current = normalizeTheme(theme);
    const matched = STYLE_THEME_PRESETS.find((preset) => normalizeTheme(preset.theme) === current);
    return matched?.id || '';
  }, [theme]);

  const controlSections = useMemo(() => ([
    { key: 'quick', title: '快速基调' },
    ...FIELD_GROUPS.map((group) => ({
      key: group.key,
      title: group.title
    }))
  ]), []);

  const activeGroup = useMemo(
    () => FIELD_GROUPS.find((group) => group.key === activeSection) || null,
    [activeSection]
  );

  const customThemeCount = useMemo(
    () => themeLibrary.filter((record) => !record.builtIn).length,
    [themeLibrary]
  );
  const activePreviewMeta = useMemo(
    () => PREVIEW_SCENES.find((scene) => scene.key === activePreview) || PREVIEW_SCENES[0],
    [activePreview]
  );

  const themeStatusText = isDirty ? '有未保存修改' : '已与主题库同步';

  function updateTheme(field, value) {
    setTheme((prev) => ({ ...prev, [field]: value }));
  }

  function switchThemeRecord(themeId) {
    const nextRecord = themeLibrary.find((record) => record.id === themeId);
    if (!nextRecord) return;
    setActiveThemeId(nextRecord.id);
    saveStoredActiveStyleThemeId(nextRecord.id);
    setTheme(nextRecord.theme);
    setThemeNameInput(nextRecord.label);
  }

  function handlePreset(themePreset, presetId) {
    setTheme(themePreset);
    if (presetId) {
      setActiveThemeId(presetId);
      saveStoredActiveStyleThemeId(presetId);
      const presetRecord = themeLibrary.find((record) => record.id === presetId);
      if (presetRecord) setThemeNameInput(presetRecord.label);
    }
  }

  function persistThemeRecord(mode) {
    const existingNames = new Set(themeLibrary.map((record) => record.label));
    const typedName = sanitizeThemeName(themeNameInput);
    const nextLabel = typedName || buildDerivedThemeName(activeThemeRecord?.label, existingNames, mode === 'copy' ? '副本' : '自定义');
    const nextRecord = {
      id: mode === 'save' && activeThemeRecord && !activeThemeRecord.builtIn ? activeThemeRecord.id : createThemeId(),
      label: mode === 'copy' ? buildDerivedThemeName(nextLabel, existingNames, '') : nextLabel,
      summary: buildThemeSummary(theme, labels),
      theme,
      builtIn: false
    };
    const savedRecord = saveCustomStyleTheme(nextRecord);
    const nextLibrary = getStyleThemeLibrary();
    setThemeLibrary(nextLibrary);
    setActiveThemeId(savedRecord.id);
    setThemeNameInput(savedRecord.label);
    saveStoredActiveStyleThemeId(savedRecord.id);
  }

  function restoreActiveTheme() {
    if (!activeThemeRecord) return;
    setTheme(activeThemeRecord.theme);
    setThemeNameInput(activeThemeRecord.label);
  }

  function removeActiveCustomTheme() {
    if (!activeThemeRecord || activeThemeRecord.builtIn) return;
    deleteCustomStyleTheme(activeThemeRecord.id);
    const nextLibrary = getStyleThemeLibrary();
    const fallbackRecord = nextLibrary[0] || null;
    setThemeLibrary(nextLibrary);
    if (!fallbackRecord) return;
    setActiveThemeId(fallbackRecord.id);
    saveStoredActiveStyleThemeId(fallbackRecord.id);
    setTheme(fallbackRecord.theme);
    setThemeNameInput(fallbackRecord.label);
  }

  return (
    <div className="page-shell style-manager-shell">
      <header className="style-manager-hero">
        <div className="style-manager-hero-main">
          <div className="style-manager-hero-copy">
            <span className="hero-eyebrow">Style Manager</span>
            <h1>样式管理台</h1>
            <p>统一管理主题方案，并直接用真实业务卡预览效果。</p>
          </div>
          <div className="style-manager-status-strip">
            <CompactThemeBadge label="背景" value={labels.pageTheme[theme.pageTheme]} />
            <CompactThemeBadge label="强调" value={labels.brandTheme[theme.brandTheme]} />
            <CompactThemeBadge label="导航" value={labels.navTheme[theme.navTheme]} />
            <CompactThemeBadge label="面板" value={labels.panelTheme[theme.panelTheme]} />
            <CompactThemeBadge label="密度" value={labels.densityTheme[theme.densityTheme]} />
            <CompactThemeBadge label="标题" value={labels.titleTheme[theme.titleTheme]} />
            <CompactThemeBadge label="微调" value={`${theme.colorStrength}% / ${theme.spacingScale}%`} />
          </div>
        </div>
      </header>

      <section className="style-manager-workspace">
        <section className="style-manager-control-board">
          <div className="style-theme-assets">
            <div className="style-theme-assets-head">
              <div className="style-group-head">
                <span className="hero-eyebrow">Theme Library</span>
                <h3>主题方案</h3>
              </div>
              <div className={`style-theme-sync-badge${isDirty ? ' is-dirty' : ''}`}>
                {themeStatusText}
              </div>
            </div>

            <div className="style-theme-assets-form">
              <label className="select-wrap">
                <span className="select-label">当前主题</span>
                <select
                  className="book-select style-theme-select"
                  value={activeThemeRecord?.id || ''}
                  onChange={(event) => switchThemeRecord(event.target.value)}
                >
                  <optgroup label="系统预设">
                    {themeLibrary.filter((record) => record.builtIn).map((record) => (
                      <option key={record.id} value={record.id}>{record.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="自定义主题">
                    {themeLibrary.filter((record) => !record.builtIn).map((record) => (
                      <option key={record.id} value={record.id}>{record.label}</option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <label className="style-theme-name-field">
                <span className="select-label">主题名</span>
                <input
                  type="text"
                  value={themeNameInput}
                  onChange={(event) => setThemeNameInput(event.target.value)}
                  placeholder="输入主题名"
                />
              </label>
            </div>

            <div className="style-theme-assets-actions">
              <button type="button" className="solid-btn" onClick={() => persistThemeRecord('save')}>
                保存当前
              </button>
              <button type="button" className="ghost-btn action-btn" onClick={() => persistThemeRecord('copy')}>
                复制主题
              </button>
              <button type="button" className="ghost-btn action-btn" onClick={restoreActiveTheme} disabled={!isDirty}>
                恢复原版
              </button>
              <button
                type="button"
                className="ghost-btn action-btn"
                onClick={removeActiveCustomTheme}
                disabled={!activeThemeRecord || activeThemeRecord.builtIn}
              >
                删除主题
              </button>
            </div>

            <div className="style-theme-record-strip">
              <ThemeRecordCard label="当前挂载" value={activeThemeRecord?.label || '未命名'} />
              <ThemeRecordCard label="主题类型" value={activeThemeRecord?.builtIn ? '系统预设' : '自定义主题'} />
              <ThemeRecordCard label="自定义数量" value={`${customThemeCount} 套`} />
            </div>
          </div>

          <div className="style-manager-section-tabs">
            {controlSections.map((section) => (
              <button
                key={section.key}
                type="button"
                className={`style-manager-section-tab${activeSection === section.key ? ' is-active' : ''}`}
                onClick={() => setActiveSection(section.key)}
              >
                {section.title}
              </button>
            ))}
          </div>

          <div className="style-manager-control-body">
            {activeSection === 'quick' ? (
              <div className="style-manager-control-stack">
                <div className="style-manager-preset-grid">
                  {STYLE_THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`style-preset-card${activePresetId === preset.id ? ' is-active' : ''}`}
                      onClick={() => handlePreset(preset.theme, preset.id)}
                    >
                      <strong>{preset.label}</strong>
                      <span>{preset.summary}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : activeGroup ? (
              <ThemeGroupEditor group={activeGroup} theme={theme} onChange={updateTheme} />
            ) : null}
          </div>
        </section>

        <section className="style-manager-scene-panel">
          <div className="style-group-head style-scene-head">
            <div className="style-scene-head-top">
              <div>
                <span className="hero-eyebrow">Live Scene</span>
                <h3>实时预览</h3>
              </div>
              <div className="style-scene-preview-tabs">
                {PREVIEW_SCENES.map((scene) => (
                  <button
                    key={scene.key}
                    type="button"
                    className={`style-scene-preview-tab${activePreview === scene.key ? ' is-active' : ''}`}
                    onClick={() => setActivePreview(scene.key)}
                  >
                    {scene.title}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="style-scene-preview-note">{activePreviewMeta.note}</p>
            </div>
          </div>

          <div className="style-manager-scene-scroll">
            {activePreview === 'book' ? (
              <div className="style-scene-grid style-scene-focus-grid style-scene-focus-grid-split">
                <article className="style-scene-book-card">
                  <span className="panel-card-eyebrow">当前书籍</span>
                  <h2 className="style-scene-title">轮回之门</h2>
                  <div className="style-scene-chip-row">
                    <span>玄幻修真</span>
                    <span>传统修真</span>
                    <span>连载中</span>
                  </div>
                  <div className="style-scene-metric-grid">
                    <div className="style-scene-metric-card">
                      <strong>24</strong>
                      <span>进行中的章节</span>
                    </div>
                    <div className="style-scene-metric-card">
                      <strong>6</strong>
                      <span>已建分卷</span>
                    </div>
                  </div>
                  <div className="style-scene-summary-note">
                    书籍主卡会同步承接背景、强调色、标题层级和面板气质。
                  </div>
                </article>
                <article className="style-scene-mini-card">
                  <div className="style-scene-section-head">
                    <strong>摘要信息</strong>
                  </div>
                  <div className="style-scene-list">
                    <div className="style-scene-list-item">
                      <div>
                        <strong>作者</strong>
                        <span>未署名 · 男频长篇 · 起点中文网</span>
                      </div>
                      <em>基础</em>
                    </div>
                    <div className="style-scene-list-item">
                      <div>
                        <strong>一句话简介</strong>
                        <span>旧城异变复苏，主角被迫回到命运起点。</span>
                      </div>
                      <em>文案</em>
                    </div>
                    <div className="style-scene-list-item">
                      <div>
                        <strong>使用说明</strong>
                        <span>这一类卡优先吃标题层级、封面气质、摘要密度和标签风格。</span>
                      </div>
                      <em>重点</em>
                    </div>
                  </div>
                </article>
              </div>
            ) : null}

            {activePreview === 'entry' ? (
              <div className="style-scene-grid style-scene-focus-grid">
                <article className="style-scene-side-card">
                  <div className="style-scene-section">
                    <div className="style-scene-section-head">
                      <strong>导航入口</strong>
                    </div>
                    <div className="style-scene-button-lane">
                      <button type="button" className="solid-btn nav-btn nav-btn-primary">进入创作台</button>
                      <button type="button" className="ghost-btn nav-btn">进入汇总页</button>
                      <button type="button" className="ghost-btn nav-btn">进入角色页</button>
                    </div>
                  </div>
                  <div className="style-scene-section">
                    <div className="style-scene-section-head">
                      <strong>操作区</strong>
                    </div>
                    <div className="style-scene-button-lane style-scene-button-lane-actions">
                      <button type="button" className="solid-btn">新建书籍</button>
                      <button type="button" className="ghost-btn action-btn">刷新列表</button>
                      <button type="button" className="ghost-btn action-btn">清空筛选</button>
                      <button type="button" className="solid-btn danger-solid-btn">批量删除</button>
                    </div>
                  </div>
                  <div className="style-scene-section">
                    <div className="style-scene-section-head">
                      <strong>切换入口</strong>
                    </div>
                    <div className="style-scene-entry-strip">
                      <button type="button" className="solid-btn action-btn">新建书籍</button>
                      <button type="button" className="ghost-btn nav-btn">编辑书籍</button>
                      <label className="select-wrap style-scene-entry-select">
                        <select className="book-select" defaultValue="轮回之门">
                          <option>轮回之门</option>
                          <option>雾城疑案</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </article>
              </div>
            ) : null}

            {activePreview === 'list' ? (
              <div className="style-scene-grid style-scene-focus-grid style-scene-focus-grid-split">
                <article className="style-scene-mini-card">
                  <div className="style-scene-section-head">
                    <strong>列表工具条</strong>
                  </div>
                  <div className="style-scene-toolbar">
                    <button type="button" className="ghost-btn action-btn">定位当前书</button>
                    <button type="button" className="ghost-btn action-btn">刷新列表</button>
                    <button type="button" className="ghost-btn action-btn">清空筛选</button>
                  </div>
                  <div className="style-scene-form-row">
                    <label className="select-wrap">
                      <select className="book-select" defaultValue="最近更新">
                        <option>最近更新</option>
                        <option>最近创建</option>
                      </select>
                    </label>
                    <label className="select-wrap">
                      <select className="book-select" defaultValue="全部状态">
                        <option>全部状态</option>
                        <option>连载中</option>
                      </select>
                    </label>
                    <button type="button" className="solid-btn">应用筛选</button>
                  </div>
                </article>
                <article className="style-scene-mini-card">
                  <div className="style-scene-section-head">
                    <strong>列表行卡</strong>
                  </div>
                  <div className="style-scene-list">
                    <div className="style-scene-list-item">
                      <div>
                        <strong>轮回之门</strong>
                        <span>全书规划已完成，待继续正文。</span>
                      </div>
                      <em>当前书</em>
                    </div>
                    <div className="style-scene-list-item">
                      <div>
                        <strong>雾城疑案</strong>
                        <span>角色页已建立，分卷待补完。</span>
                      </div>
                      <em>已归档</em>
                    </div>
                    <div className="style-scene-list-item">
                      <div>
                        <strong>末日信标</strong>
                        <span>章节细纲尚未接入，适合观察灰度状态。</span>
                      </div>
                      <em>暂停中</em>
                    </div>
                  </div>
                </article>
              </div>
            ) : null}

            {activePreview === 'status' ? (
              <div className="style-scene-grid style-scene-focus-grid">
                <article className="style-scene-mini-card">
                  <div className="style-scene-section-head">
                    <strong>提示与控件</strong>
                  </div>
                  <div className="style-scene-status-stack">
                    <div className="style-scene-status style-scene-status-warning">检测到本章计划缺少收束钩子。</div>
                    <div className="style-scene-status style-scene-status-success">角色底色已同步到当前章节计划。</div>
                    <div className="style-scene-status style-scene-status-error">分卷拆解结果尚未确认，请先复核。</div>
                  </div>
                  <div className="style-scene-form-row">
                    <label className="select-wrap">
                      <select className="book-select" defaultValue="平衡模板">
                        <option>平衡模板</option>
                        <option>快节奏模板</option>
                      </select>
                    </label>
                    <button type="button" className="ghost-btn action-btn">预览</button>
                    <button type="button" className="solid-btn">保存</button>
                  </div>
                </article>
                <article className="style-scene-mini-card">
                  <div className="style-scene-section-head">
                    <strong>接入覆盖</strong>
                  </div>
                  <div className="style-theme-coverage-grid">
                    {THEME_COVERAGE_GROUPS.map((item) => (
                      <ThemeCoverageCard
                        key={item.label}
                        label={item.label}
                        status={item.status}
                        note={item.note}
                      />
                    ))}
                  </div>
                </article>
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <style>{`
        .style-manager-shell {
          display: grid;
          gap: 14px;
          min-height: calc(100vh - 96px);
          --style-admin-bg: linear-gradient(
            180deg,
            color-mix(in srgb, var(--text) 4%, rgba(246, 249, 253, 0.98)),
            color-mix(in srgb, var(--text) 10%, rgba(230, 236, 244, 0.98))
          );
          --style-admin-surface: color-mix(in srgb, var(--brand-soft) 58%, rgba(250, 252, 255, 0.96));
          --style-admin-strong: rgba(255, 255, 255, 0.98);
          --style-admin-line: color-mix(in srgb, var(--line) 72%, rgba(108, 122, 148, 0.18));
          --style-admin-line-strong: color-mix(in srgb, var(--line-strong) 76%, rgba(98, 112, 136, 0.28));
          --style-admin-muted: color-mix(in srgb, var(--muted) 86%, rgba(81, 94, 118, 0.88));
          --style-admin-text: color-mix(in srgb, var(--text) 92%, rgba(40, 49, 66, 0.94));
          --style-admin-accent: color-mix(in srgb, var(--brand) 72%, rgba(72, 88, 118, 0.92));
          --style-admin-accent-soft: color-mix(in srgb, var(--brand-soft) 72%, rgba(224, 233, 245, 0.94));
          --style-preview-bg: var(--panel);
          --style-preview-surface: var(--panel-card-bg);
          --style-preview-strong: var(--panel-note-bg);
          --style-preview-line: color-mix(in srgb, var(--line-strong) 76%, var(--brand-soft-strong) 24%);
          --style-preview-shadow: var(--shadow);
        }
        .style-manager-hero {
          display: grid;
          gap: 8px;
          padding: 14px 18px;
          border: 1px solid var(--line);
          border-radius: var(--radius-panel-sm);
          background: var(--panel);
          box-shadow: var(--shadow);
          backdrop-filter: blur(var(--panel-backdrop-blur));
        }
        .style-manager-hero-main {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
          gap: 14px;
          align-items: center;
        }
        .style-manager-hero-copy {
          display: grid;
          gap: 6px;
        }
        .style-manager-hero-copy h1 {
          margin: 0;
          font-size: clamp(28px, 2.2vw, 36px);
          line-height: 1;
        }
        .style-manager-hero-copy p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
        }
        .style-manager-status-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .style-state-chip {
          display: grid;
          gap: 4px;
          min-width: 0;
          padding: 8px 10px;
          border: 1px solid var(--line);
          border-radius: var(--radius-panel-sm);
          background: var(--panel-card-bg);
        }
        .style-state-chip span {
          color: var(--muted);
          font-size: 11px;
          font-weight: 700;
        }
        .style-state-chip strong {
          color: var(--text);
          font-size: 12px;
          line-height: 1.25;
        }
        .style-manager-workspace {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(460px, 1.08fr);
          gap: 18px;
          align-items: stretch;
          height: clamp(620px, calc(100vh - 150px), 760px);
        }
        .style-manager-control-board,
        .style-manager-scene-panel {
          display: grid;
          min-height: 0;
          height: 100%;
          padding: 16px;
          border: 1px solid var(--line);
          border-radius: var(--radius-panel-sm);
          background: var(--panel);
          box-shadow: var(--shadow);
          backdrop-filter: blur(var(--panel-backdrop-blur));
        }
        .style-manager-control-board {
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 10px;
          border-color: var(--style-admin-line);
          background: var(--style-admin-bg);
          border-radius: 18px;
          box-shadow: 0 10px 24px rgba(84, 98, 122, 0.08);
        }
        .style-manager-scene-panel {
          grid-template-rows: auto minmax(0, 1fr);
          gap: 10px;
          border-color: var(--style-preview-line);
          background: var(--style-preview-bg);
          border-radius: 26px;
          box-shadow: var(--style-preview-shadow);
        }
        .style-theme-assets {
          display: grid;
          gap: 5px;
          padding: 7px 9px 8px;
          border: 1px solid var(--style-admin-line);
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(251, 253, 255, 0.96), rgba(241, 246, 252, 0.96));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
        }
        .style-theme-assets-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .style-theme-sync-badge {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0 9px;
          border: 1px solid var(--style-admin-line);
          border-radius: var(--radius-button);
          background: rgba(247, 250, 254, 0.94);
          color: var(--style-admin-muted);
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }
        .style-theme-sync-badge.is-dirty {
          border-color: var(--status-warning-border);
          background: var(--status-warning-bg);
          color: var(--brand-deep);
        }
        .style-theme-assets-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.94fr);
          gap: 5px;
        }
        .style-theme-assets .select-wrap,
        .style-theme-name-field {
          display: grid;
          gap: 2px;
        }
        .style-theme-assets .select-label {
          font-size: 9px;
          color: var(--style-admin-muted);
          letter-spacing: 0.04em;
        }
        .style-theme-select,
        .style-theme-name-field input {
          min-height: 36px;
          padding: 0 10px;
          border: 1px solid var(--style-admin-line-strong);
          border-radius: 12px;
          background: color-mix(in srgb, var(--panel-strong) 92%, white);
          color: var(--style-admin-text);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }
        .style-manager-control-board .solid-btn,
        .style-manager-control-board .ghost-btn {
          border-radius: 12px;
        }
        .style-manager-control-board .solid-btn {
          background: var(--btn-action-solid-bg);
          color: var(--btn-action-solid-text);
          border-color: var(--btn-action-solid-border);
          box-shadow: var(--btn-action-solid-shadow);
        }
        .style-manager-control-board .ghost-btn {
          background: color-mix(in srgb, var(--btn-action-bg) 82%, rgba(255,255,255,0.62));
          color: var(--btn-action-text);
          border-color: var(--btn-action-border);
          box-shadow: var(--btn-action-shadow);
        }
        .style-manager-control-board .ghost-btn:hover,
        .style-manager-control-board .solid-btn:hover {
          transform: translateY(-1px);
        }
        .style-theme-assets-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 5px;
        }
        .style-theme-assets-actions .solid-btn,
        .style-theme-assets-actions .ghost-btn,
        .style-theme-assets-actions .solid-btn,
        .style-theme-assets-actions .ghost-btn {
          width: 100%;
          min-width: 0;
          font-size: 10px;
          min-height: 32px;
          padding-inline: 8px;
        }
        .style-theme-record-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 5px;
        }
        .style-theme-record-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-width: 0;
          padding: 5px 8px;
          border: 1px solid var(--style-admin-line);
          border-radius: 12px;
          background: rgba(248, 251, 255, 0.92);
        }
        .style-theme-record-card span {
          color: var(--style-admin-muted);
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }
        .style-theme-record-card strong {
          color: var(--style-admin-text);
          font-size: 10px;
          line-height: 1.2;
          text-align: right;
        }
        .style-theme-coverage-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .style-theme-coverage-card {
          display: grid;
          gap: 6px;
          padding: 10px;
          border: 1px solid var(--line);
          border-radius: var(--radius-panel-sm);
          background: color-mix(in srgb, var(--panel-strong) 88%, transparent);
        }
        .style-theme-coverage-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .style-theme-coverage-head strong {
          color: var(--text);
          font-size: 12px;
        }
        .style-theme-coverage-card p {
          margin: 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.45;
        }
        .style-theme-coverage-badge {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0 8px;
          border-radius: var(--radius-button);
          border: 1px solid var(--line);
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }
        .style-theme-coverage-badge.is-ready {
          border-color: var(--status-success-border);
          background: var(--status-success-bg);
          color: color-mix(in srgb, var(--text) 72%, #2f6b45);
        }
        .style-theme-coverage-badge.is-progress {
          border-color: var(--status-warning-border);
          background: var(--status-warning-bg);
          color: var(--brand-deep);
        }
        .style-manager-section-tabs {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 6px;
        }
        .style-manager-section-tab {
          min-height: 34px;
          padding: 0 8px;
          border: 1px solid var(--btn-nav-border);
          border-radius: 10px;
          background: color-mix(in srgb, var(--btn-nav-bg) 78%, rgba(255, 255, 255, 0.58));
          color: var(--btn-nav-text);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 140ms ease, background 140ms ease, color 140ms ease, transform 140ms ease;
        }
        .style-manager-section-tab.is-active {
          border-color: color-mix(in srgb, var(--btn-nav-border) 92%, rgba(255,255,255,0.08));
          background: var(--btn-nav-primary-bg);
          color: var(--btn-nav-primary-text);
          box-shadow: var(--btn-nav-primary-shadow);
          transform: translateY(-1px);
        }
        .style-manager-control-body,
        .style-manager-scene-scroll {
          min-height: 0;
          overflow: auto;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: var(--brand-soft-strong) transparent;
        }
        .style-manager-control-body::-webkit-scrollbar,
        .style-manager-scene-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .style-manager-control-body::-webkit-scrollbar-thumb,
        .style-manager-scene-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: var(--brand-soft-strong);
        }
        .style-manager-control-stack {
          display: grid;
          gap: 8px;
          padding-bottom: 2px;
        }
        .style-group-head {
          display: grid;
          gap: 2px;
        }
        .style-group-head h3 {
          margin: 0;
          font-size: 22px;
          line-height: 1.08;
        }
        .style-manager-control-board .hero-eyebrow,
        .style-manager-control-board .style-group-head h3 {
          color: var(--style-admin-text);
        }
        .style-group-fields {
          display: grid;
          gap: 8px;
        }
        .style-group-fields.is-range-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .style-field-panel {
          display: grid;
          gap: 6px;
          padding: 8px 9px;
          border: 1px solid var(--style-admin-line);
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(251, 253, 255, 0.96), rgba(241, 246, 252, 0.94));
        }
        .style-field-panel-range {
          gap: 8px;
        }
        .style-field-head {
          display: grid;
          gap: 0;
        }
        .style-field-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .style-field-head strong {
          color: var(--style-admin-text);
          font-size: 12px;
        }
        .style-field-active {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          border: 1px solid var(--badge-border);
          background: color-mix(in srgb, var(--badge-bg) 78%, rgba(255,255,255,0.44));
          color: var(--badge-text);
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }
        .style-option-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
          gap: 5px;
        }
        .style-option-pill {
          display: flex;
          align-items: center;
          min-height: 36px;
          padding: 0 9px;
          border: 1px solid var(--style-admin-line);
          border-radius: 10px;
          background: color-mix(in srgb, var(--style-admin-strong) 86%, rgba(255,255,255,0.56));
          text-align: left;
          cursor: pointer;
          transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
        }
        .style-option-pill:hover {
          border-color: color-mix(in srgb, var(--badge-border) 72%, var(--style-admin-line));
          background: color-mix(in srgb, var(--style-admin-surface) 92%, white);
        }
        .style-option-pill.is-active {
          border-color: var(--badge-border);
          background: color-mix(in srgb, var(--badge-bg) 86%, var(--style-admin-surface));
        }
        .style-option-pill strong {
          color: var(--style-admin-text);
          font-size: 11px;
        }
        .style-option-pill.is-active strong {
          color: var(--badge-text);
        }
        .style-range-control {
          display: grid;
          gap: 8px;
        }
        .style-range-control input[type='range'] {
          width: 100%;
          margin: 0;
          accent-color: var(--style-admin-accent);
        }
        .style-range-meta {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 8px;
          color: var(--style-admin-muted);
          font-size: 11px;
        }
        .style-range-meta strong {
          justify-self: center;
          color: var(--brand-deep);
          font-size: 12px;
        }
        .style-manager-preset-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }
        .style-preset-card {
          display: grid;
          gap: 4px;
          min-height: 56px;
          padding: 8px 9px;
          border: 1px solid var(--style-admin-line);
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(251, 253, 255, 0.96), rgba(241, 246, 252, 0.94));
          text-align: left;
          cursor: pointer;
          transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
        }
        .style-preset-card:hover {
          border-color: color-mix(in srgb, var(--badge-border) 72%, var(--style-admin-line));
        }
        .style-preset-card.is-active {
          border-color: var(--badge-border);
          background: color-mix(in srgb, var(--badge-bg) 82%, var(--style-admin-surface));
        }
        .style-preset-card strong {
          color: var(--style-admin-text);
          font-size: 12px;
        }
        .style-preset-card span {
          color: var(--style-admin-muted);
          font-size: 9px;
          line-height: 1.2;
        }
        .style-scene-head {
          padding-bottom: 4px;
          border-bottom: 1px solid var(--style-preview-line);
        }
        .style-scene-head-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .style-scene-preview-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
          min-width: min(100%, 420px);
        }
        .style-scene-preview-tab {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid var(--btn-nav-border);
          border-radius: var(--radius-button);
          background: color-mix(in srgb, var(--btn-nav-bg) 78%, rgba(255,255,255,0.52));
          color: var(--btn-nav-text);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .style-scene-preview-tab.is-active {
          border-color: color-mix(in srgb, var(--btn-nav-border) 92%, rgba(255,255,255,0.08));
          background: var(--btn-nav-primary-bg);
          color: var(--btn-nav-primary-text);
          box-shadow: var(--btn-nav-primary-shadow);
        }
        .style-scene-preview-note {
          margin: 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.45;
        }
        .style-scene-grid {
          display: grid;
          gap: 10px;
        }
        .style-scene-focus-grid {
          min-height: 100%;
        }
        .style-scene-focus-grid-split {
          grid-template-columns: minmax(220px, 0.92fr) minmax(0, 1.08fr);
        }
        .style-scene-grid-primary {
          grid-template-columns: minmax(220px, 0.82fr) minmax(0, 1.18fr);
          margin-bottom: 10px;
        }
        .style-scene-grid-secondary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .style-scene-coverage-card {
          margin-top: 10px;
        }
        .style-scene-book-card,
        .style-scene-side-card,
        .style-scene-mini-card {
          display: grid;
          gap: 8px;
          align-content: start;
          padding: 12px;
          border: 1px solid var(--style-preview-line);
          border-radius: var(--radius-panel-lg);
          background: var(--style-preview-surface);
          box-shadow: var(--style-preview-shadow);
          min-height: 0;
        }
        .style-scene-side-card {
          gap: 6px;
        }
        .style-scene-title {
          margin: 0;
          font-size: clamp(20px, 1.8vw, 24px);
          line-height: 1;
          letter-spacing: -0.04em;
          color: var(--text);
        }
        .style-scene-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .style-scene-chip-row span,
        .style-scene-list-item em {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          min-height: 24px;
          padding: 0 8px;
          border-radius: var(--radius-button);
          border: 1px solid var(--badge-border);
          background: var(--badge-bg);
          color: var(--badge-text);
          font-size: 10px;
          font-weight: 700;
          font-style: normal;
          white-space: nowrap;
        }
        .style-scene-metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }
        .style-scene-metric-card {
          display: grid;
          gap: 4px;
          padding: 8px;
          border: 1px solid var(--style-preview-line);
          border-radius: var(--radius-panel-sm);
          background: var(--style-preview-strong);
        }
        .style-scene-metric-card strong {
          color: var(--text);
          font-size: clamp(18px, 1.55vw, 24px);
          line-height: 1;
          letter-spacing: -0.04em;
        }
        .style-scene-metric-card span,
        .style-scene-summary-note,
        .style-scene-list-item span {
          color: var(--muted);
          font-size: 10px;
          line-height: 1.45;
        }
        .style-scene-summary-note {
          padding: 8px 10px;
          border: 1px solid var(--style-preview-line);
          border-radius: var(--radius-panel-sm);
          background: var(--style-preview-strong);
        }
        .style-scene-section {
          display: grid;
          align-content: start;
          gap: 4px;
          padding: 6px;
          border: 1px solid var(--style-preview-line);
          border-radius: var(--radius-panel-sm);
          background: var(--style-preview-strong);
        }
        .style-scene-section-head {
          display: flex;
          align-items: center;
        }
        .style-scene-section-head strong {
          color: var(--text);
          font-size: 11px;
        }
        .style-scene-button-lane {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }
        .style-scene-button-lane-actions {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .style-scene-button-lane .solid-btn,
        .style-scene-button-lane .ghost-btn,
        .style-scene-toolbar .ghost-btn,
        .style-scene-form-row .solid-btn,
        .style-scene-form-row .ghost-btn {
          width: 100%;
          min-width: 0;
          font-size: 10px;
        }
        .style-scene-entry-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 4px;
          padding: 2px;
          border: 1px solid var(--style-preview-line);
          border-radius: calc(var(--radius-button) + 4px);
          background: var(--style-preview-strong);
        }
        .style-scene-entry-strip .solid-btn,
        .style-scene-entry-strip .ghost-btn,
        .style-scene-entry-strip .book-select {
          min-height: 28px;
          font-size: 10px;
        }
        .style-scene-entry-strip .solid-btn,
        .style-scene-entry-strip .ghost-btn {
          width: 100%;
          min-width: 0;
          padding-inline: 6px;
        }
        .style-scene-entry-select,
        .style-scene-entry-select .book-select {
          width: 100%;
        }
        .style-scene-entry-select .book-select {
          padding-inline: 8px 22px;
          text-align: center;
          text-align-last: center;
        }
        .style-scene-toolbar,
        .style-scene-form-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }
        .style-scene-list {
          display: grid;
          gap: 6px;
        }
        .style-scene-list-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          border: 1px solid var(--style-preview-line);
          border-radius: var(--radius-panel-sm);
          background: var(--style-preview-strong);
        }
        .style-scene-list-item > div {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .style-scene-list-item strong {
          font-size: 12px;
          color: var(--text);
        }
        .style-scene-status-stack {
          display: grid;
          gap: 6px;
        }
        .style-scene-status {
          padding: 8px 10px;
          border: 1px solid var(--style-preview-line);
          border-radius: var(--radius-panel-sm);
          font-size: 11px;
          line-height: 1.45;
        }
        .style-scene-status-warning {
          border-color: var(--status-warning-border);
          background: var(--status-warning-bg);
        }
        .style-scene-status-success {
          border-color: var(--status-success-border);
          background: var(--status-success-bg);
        }
        .style-scene-status-error {
          border-color: var(--status-error-border);
          background: var(--status-error-bg);
        }
        @media (max-width: 1240px) {
          .style-manager-workspace,
          .style-manager-hero-main,
          .style-scene-head-top,
          .style-scene-preview-tabs,
          .style-scene-focus-grid-split,
          .style-scene-grid-primary,
          .style-scene-grid-secondary {
            grid-template-columns: 1fr;
          }
          .style-scene-head-top {
            display: grid;
          }
          .style-manager-workspace {
            height: auto;
          }
        }
        @media (max-width: 980px) {
          .style-theme-assets-form,
          .style-theme-assets-actions,
          .style-theme-record-strip,
          .style-theme-coverage-grid,
          .style-manager-section-tabs,
          .style-manager-status-strip,
          .style-manager-preset-grid,
          .style-scene-button-lane,
          .style-scene-button-lane-actions,
          .style-scene-entry-strip,
          .style-scene-toolbar,
          .style-scene-form-row {
            grid-template-columns: 1fr;
          }
          .style-group-fields.is-range-grid {
            grid-template-columns: 1fr;
          }
          .style-theme-assets-head {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
