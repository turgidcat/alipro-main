import { useEffect, useMemo, useState } from 'react';
import '../styles.css';
import '../app-shell.css';
import {
  STYLE_ATMOSPHERE_OPTIONS,
  STYLE_THEME_PRESETS,
  STYLE_TONE_OPTIONS,
  applyStyleTheme,
  getStoredStyleTheme,
  saveStoredActiveStyleThemeId,
  saveStyleTheme
} from '../styleTheme.js';

const PREVIEW_SCENES = [
  { key: 'book', title: '书籍主卡', note: '看主卡、摘要和指标。' },
  { key: 'entry', title: '入口操作', note: '看导航、按钮和入口。' },
  { key: 'list', title: '列表状态', note: '看列表、筛选和轻操作。' },
  { key: 'status', title: '提示系统', note: '看状态和反馈提示。' }
];

const THEME_COVERAGE_GROUPS = [
  { label: '页面底色', note: '背景、导航和主面板同步切换。' },
  { label: '主操作语气', note: '关键按钮一起换语气。' },
  { label: '列表与资料页', note: '列表和详情区统一承接氛围。' },
  { label: '工作台主链', note: '章节区、正文区和提示区一起收口。' }
];

const surfaceStyle = {
  borderColor: 'var(--line)',
  background: 'var(--panel-card-bg)',
  boxShadow: 'var(--shadow)'
};

const softSurfaceStyle = {
  borderColor: 'var(--line)',
  background: 'var(--panel)',
  boxShadow: 'none'
};

const flatSurfaceStyle = {
  borderColor: 'var(--line)',
  background: 'var(--panel-note-bg)'
};

const previewCanvasStyle = {
  borderColor: 'var(--line)',
  background: `
    radial-gradient(circle at top left, rgba(var(--brand-rgb), 0.12), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.08))
  `
};

const inputStyle = {
  borderColor: 'var(--line-strong)',
  background: 'var(--panel-strong)',
  color: 'var(--text)'
};

const monoStyle = {
  color: 'var(--muted)',
  fontFamily: 'var(--font-mono)'
};

function SectionEyebrow({ children }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.08em]" style={monoStyle}>
      <span>//</span>
      <span>{children}</span>
    </span>
  );
}

function CompactThemeBadge({ label, value }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={flatSurfaceStyle}>
      <div className="text-[11px] font-bold tracking-[0.06em]" style={monoStyle}>{label}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

function PreviewButton({ children, solid = false, danger = false }) {
  return (
    <button
      type="button"
      className="rounded-md border px-4 py-2 text-sm font-semibold transition duration-150 hover:-translate-y-0.5"
      style={{
        borderColor: solid ? 'transparent' : danger ? 'var(--status-error-border)' : 'var(--line-strong)',
        background: solid ? 'var(--btn-nav-primary-bg)' : danger ? 'var(--status-error-bg)' : 'var(--panel-strong)',
        color: solid ? 'var(--btn-nav-primary-text)' : danger ? 'var(--status-error-text)' : 'var(--text)',
        boxShadow: solid ? 'var(--btn-nav-primary-shadow)' : 'none'
      }}
    >
      {children}
    </button>
  );
}

function AtmosphereCard({ option, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border p-4 text-left transition duration-150 hover:-translate-y-0.5"
      style={{
        ...softSurfaceStyle,
        borderColor: active ? 'var(--brand)' : 'var(--line)',
        boxShadow: active ? '0 0 0 1px rgba(var(--brand-rgb), 0.18)' : 'none'
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong className="block text-base font-semibold" style={{ color: 'var(--text)' }}>{option.label}</strong>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{option.description}</p>
        </div>
        <span
          className="rounded-md px-2.5 py-1 text-[11px] font-bold"
          style={{
            ...monoStyle,
            color: active ? 'var(--brand-deep)' : 'var(--muted)',
            background: active ? 'var(--brand-soft)' : 'transparent'
          }}
        >
          {active ? 'ACTIVE' : option.shortLabel}
        </span>
      </div>
    </button>
  );
}

function TonePill({ option, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border px-4 py-2 text-sm font-semibold transition duration-150"
      style={{
        borderColor: active ? 'var(--brand)' : 'var(--line)',
        background: active ? 'var(--brand-soft)' : 'var(--panel-strong)',
        color: active ? 'var(--brand-deep)' : 'var(--text)'
      }}
    >
      {option.label}
    </button>
  );
}

function PreviewTab({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border px-3.5 py-2 text-left text-sm font-semibold transition duration-150"
      style={{
        borderColor: active ? 'var(--brand)' : 'var(--line)',
        background: active ? 'var(--brand-soft)' : 'var(--panel-strong)',
        color: active ? 'var(--brand-deep)' : 'var(--text)'
      }}
    >
      {label}
    </button>
  );
}

function CoverageCard({ label, note }) {
  return (
    <article className="rounded-lg border p-4" style={flatSurfaceStyle}>
      <strong className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</strong>
      <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>{note}</p>
    </article>
  );
}

function PreviewBookScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <article className="rounded-[18px] border p-6" style={softSurfaceStyle}>
        <SectionEyebrow>Book Hero</SectionEyebrow>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--text)', fontFamily: 'var(--font-serif)' }}>
          轮回之门
        </h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {['玄幻修真', '传统修真', '连载中'].map((item) => (
            <span key={item} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ ...monoStyle, borderColor: 'var(--line)', background: 'var(--panel-strong)' }}>
              {item}
            </span>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4" style={flatSurfaceStyle}>
            <strong className="block text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--text)', fontFamily: 'var(--font-serif)' }}>24</strong>
            <span className="mt-2 block text-sm" style={{ color: 'var(--muted)' }}>进行中的章节</span>
          </div>
          <div className="rounded-xl border p-4" style={flatSurfaceStyle}>
            <strong className="block text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--text)', fontFamily: 'var(--font-serif)' }}>6</strong>
            <span className="mt-2 block text-sm" style={{ color: 'var(--muted)' }}>已建分卷</span>
          </div>
        </div>
        <p className="mt-6 text-sm leading-7" style={{ color: 'var(--muted)' }}>
          确认标题、摘要、标签和指标是否同调。
        </p>
      </article>

      <article className="rounded-[18px] border p-5" style={surfaceStyle}>
        <SectionEyebrow>Meta Notes</SectionEyebrow>
        <div className="mt-5 grid gap-3">
          {[
            ['作者', '未署名 · 男频长篇 · 起点中文网', '基础'],
            ['一句话简介', '旧城异变复苏，主角被迫回到命运起点。', '文案'],
            ['观察重点', '确认信息卡不会重新长回重阴影大卡片。', '校验']
          ].map(([title, text, tag]) => (
            <div key={title} className="rounded-xl border p-4" style={flatSurfaceStyle}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</strong>
                  <span className="mt-2 block text-sm leading-6" style={{ color: 'var(--muted)' }}>{text}</span>
                </div>
                <em className="not-italic text-[11px] font-bold tracking-[0.06em]" style={monoStyle}>{tag}</em>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function PreviewEntryScene() {
  return (
    <article className="rounded-[18px] border p-6" style={surfaceStyle}>
      <SectionEyebrow>Entry Surface</SectionEyebrow>
      <div className="mt-6 grid gap-6">
        <div>
          <strong className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>导航入口</strong>
          <div className="mt-3 flex flex-wrap gap-3">
            <PreviewButton solid>进入创作台</PreviewButton>
            <PreviewButton>进入汇总页</PreviewButton>
            <PreviewButton>进入角色页</PreviewButton>
          </div>
        </div>
        <div>
          <strong className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>操作区</strong>
          <div className="mt-3 flex flex-wrap gap-3">
            <PreviewButton solid>新建书籍</PreviewButton>
            <PreviewButton>刷新列表</PreviewButton>
            <PreviewButton>清空筛选</PreviewButton>
            <PreviewButton danger>批量删除</PreviewButton>
          </div>
        </div>
        <div>
          <strong className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>切换入口</strong>
          <div className="mt-3 grid gap-3 md:grid-cols-[auto_auto_minmax(180px,220px)]">
            <PreviewButton solid>新建书籍</PreviewButton>
            <PreviewButton>编辑书籍</PreviewButton>
            <label className="block">
              <select className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} defaultValue="轮回之门">
                <option>轮回之门</option>
                <option>雾城疑案</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </article>
  );
}

function PreviewListScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-[18px] border p-5" style={surfaceStyle}>
        <SectionEyebrow>Toolbar</SectionEyebrow>
        <div className="mt-5 flex flex-wrap gap-3">
          <PreviewButton>定位当前书</PreviewButton>
          <PreviewButton>刷新列表</PreviewButton>
          <PreviewButton>清空筛选</PreviewButton>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} defaultValue="最近更新">
            <option>最近更新</option>
            <option>最近创建</option>
          </select>
          <select className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} defaultValue="全部状态">
            <option>全部状态</option>
            <option>连载中</option>
          </select>
          <PreviewButton solid>应用筛选</PreviewButton>
        </div>
      </article>

      <article className="rounded-[18px] border p-5" style={surfaceStyle}>
        <SectionEyebrow>List Rows</SectionEyebrow>
        <div className="mt-5 grid gap-3">
          {[
            ['轮回之门', '全书规划已完成，待继续正文。', '当前书'],
            ['雾城疑案', '角色页已建立，分卷待补完。', '已归档'],
            ['末日信标', '章节细纲尚未接入，适合观察灰度状态。', '暂停中']
          ].map(([title, note, tag]) => (
            <div key={title} className="rounded-xl border p-4 transition duration-150 hover:-translate-y-0.5" style={flatSurfaceStyle}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</strong>
                  <span className="mt-2 block text-sm leading-6" style={{ color: 'var(--muted)' }}>{note}</span>
                </div>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ ...monoStyle, background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}>
                  {tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function PreviewStatusScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <article className="rounded-[18px] border p-5" style={surfaceStyle}>
        <SectionEyebrow>Status Stack</SectionEyebrow>
        <div className="mt-5 grid gap-3">
          <div className="rounded-xl border p-4 text-sm leading-6" style={{ borderColor: 'var(--status-warning-border)', background: 'var(--status-warning-bg)', color: 'var(--brand-deep)' }}>
            检测到本章计划缺少收束钩子。
          </div>
          <div className="rounded-xl border p-4 text-sm leading-6" style={{ borderColor: 'var(--status-success-border)', background: 'var(--status-success-bg)', color: 'var(--badge-text)' }}>
            角色底色已同步到当前章节计划。
          </div>
          <div className="rounded-xl border p-4 text-sm leading-6" style={{ borderColor: 'var(--status-error-border)', background: 'var(--status-error-bg)', color: 'var(--status-error-text)' }}>
            分卷拆解结果尚未确认，请先复核。
          </div>
        </div>
      </article>

      <article className="rounded-[18px] border p-5" style={surfaceStyle}>
        <SectionEyebrow>Coverage</SectionEyebrow>
        <div className="mt-5 grid gap-3">
          {THEME_COVERAGE_GROUPS.map((item) => (
            <CoverageCard key={item.label} {...item} />
          ))}
        </div>
      </article>
    </div>
  );
}

export default function StyleManagerPage() {
  const [theme, setTheme] = useState(() => getStoredStyleTheme());
  const [activePreview, setActivePreview] = useState('book');

  useEffect(() => {
    applyStyleTheme(theme);
    saveStyleTheme(theme);
    saveStoredActiveStyleThemeId(theme.atmosphere);
  }, [theme]);

  const activePreset = useMemo(
    () => STYLE_THEME_PRESETS.find((preset) => preset.id === theme.atmosphere) || STYLE_THEME_PRESETS[0],
    [theme.atmosphere]
  );

  const activeTone = useMemo(
    () => STYLE_TONE_OPTIONS.find((option) => option.value === theme.tone) || STYLE_TONE_OPTIONS[0],
    [theme.tone]
  );

  const activePreviewMeta = useMemo(
    () => PREVIEW_SCENES.find((scene) => scene.key === activePreview) || PREVIEW_SCENES[0],
    [activePreview]
  );

  function updateTheme(patch) {
    setTheme((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="page-shell">
      <div className="grid gap-6 pb-10">
        <header className="rounded-[18px] border p-6 md:p-8" style={surfaceStyle}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-end">
            <div>
              <SectionEyebrow>Style Manager</SectionEyebrow>
              <h1
                className="mt-4 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em]"
                style={{ color: 'var(--text)', fontFamily: 'var(--font-serif)' }}
              >
                样式管理台
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 md:text-base" style={{ color: 'var(--muted)' }}>
                这里只切氛围和明暗，其他细节交给统一设计系统。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CompactThemeBadge label="当前氛围" value={activePreset.shortLabel} />
              <CompactThemeBadge label="明暗" value={activeTone.label} />
              <CompactThemeBadge label="按钮语气" value={theme.tone === 'dark' ? '更克制' : '更开放'} />
              <CompactThemeBadge label="切换原则" value="只改氛围，不改结构" />
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(390px,0.92fr)_minmax(0,1.08fr)]">
          <section className="grid min-h-0 gap-4 rounded-[18px] border p-5 md:p-6" style={surfaceStyle}>
            <div className="rounded-[16px] border p-5" style={softSurfaceStyle}>
              <SectionEyebrow>Theme Controls</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--text)', fontFamily: 'var(--font-serif)' }}>
                两项控制
              </h2>
              <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                氛围定语气，明暗定亮度，不改结构尺寸。
              </p>
            </div>

            <section className="rounded-[16px] border p-5" style={softSurfaceStyle}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionEyebrow>Atmosphere</SectionEyebrow>
                  <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em]" style={{ color: 'var(--text)' }}>氛围</h3>
                </div>
                <span className="rounded-md border px-3 py-1.5 text-xs font-bold" style={flatSurfaceStyle}>4 PRESETS</span>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {STYLE_ATMOSPHERE_OPTIONS.map((option) => (
                  <AtmosphereCard
                    key={option.value}
                    option={option}
                    active={theme.atmosphere === option.value}
                    onClick={() => updateTheme({ atmosphere: option.value })}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-[16px] border p-5" style={softSurfaceStyle}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionEyebrow>Tone</SectionEyebrow>
                  <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em]" style={{ color: 'var(--text)' }}>明暗</h3>
                </div>
                <span className="rounded-md border px-3 py-1.5 text-xs font-bold" style={flatSurfaceStyle}>2 MODES</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {STYLE_TONE_OPTIONS.map((option) => (
                  <TonePill
                    key={option.value}
                    option={option}
                    active={theme.tone === option.value}
                    onClick={() => updateTheme({ tone: option.value })}
                  />
                ))}
              </div>
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                当前是 {activePreset.label} · {activeTone.description}
              </p>
            </section>

            <section className="rounded-[16px] border p-5" style={softSurfaceStyle}>
              <SectionEyebrow>Rule</SectionEyebrow>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <CompactThemeBadge label="用户能调" value="氛围、明暗" />
                <CompactThemeBadge label="系统接管" value="圆角、密度、层级、按钮细节" />
              </div>
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                业务页继续归到统一系统，这里不再暴露碎参数。
              </p>
            </section>
          </section>

          <section className="grid min-h-0 gap-4 rounded-[18px] border p-5 md:p-6" style={surfaceStyle}>
            <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-end md:justify-between" style={{ borderColor: 'var(--line)' }}>
              <div>
                <SectionEyebrow>Live Scene</SectionEyebrow>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]" style={{ color: 'var(--text)', fontFamily: 'var(--font-serif)' }}>
                  实时预览
                </h2>
                <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>{activePreviewMeta.note}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PREVIEW_SCENES.map((scene) => (
                  <PreviewTab
                    key={scene.key}
                    active={activePreview === scene.key}
                    label={scene.title}
                    onClick={() => setActivePreview(scene.key)}
                  />
                ))}
              </div>
            </div>

            <div className="min-h-0 rounded-[16px] border p-4 md:p-5" style={previewCanvasStyle}>
              <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                <div>
                  <div className="text-[11px] font-bold tracking-[0.08em]" style={monoStyle}>预览画布</div>
                  <strong className="mt-2 block text-base font-semibold" style={{ color: 'var(--text)' }}>
                    {activePreset.label} · {activeTone.label}
                  </strong>
                </div>
                <span className="rounded-md border px-3 py-1.5 text-xs font-bold" style={flatSurfaceStyle}>
                  LIVE
                </span>
              </div>
              <div className="min-h-0 overflow-auto">
                {activePreview === 'book' ? <PreviewBookScene /> : null}
                {activePreview === 'entry' ? <PreviewEntryScene /> : null}
                {activePreview === 'list' ? <PreviewListScene /> : null}
                {activePreview === 'status' ? <PreviewStatusScene /> : null}
              </div>
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
