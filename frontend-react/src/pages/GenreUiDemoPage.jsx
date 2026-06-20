import { useMemo, useState } from 'react';
import {
  BOOK_CATEGORY_KEYS,
  categoryLabels,
  categoryToGenreTheme,
  ChapterStageIcon,
  CharacterRoleIcon,
  GenreBadge,
  GenreButton,
  GenreCard,
  GenreCorner,
  GenreDivider,
  GenreMainIcon,
  GenrePanel,
  GENRE_THEME_KEYS,
  genreThemeLabels,
  getGenreCssVars,
  getGenreThemeByCategory,
  getGenreVisualSystem,
  resolveGenreGrammar,
  WorldElementIcon
} from '../genre-ui/index.js';

const demoThemeOrder = [
  'urban',
  'fantasy',
  'scifi',
  'mystery',
  'game',
  'lightnovel'
];

const stageBadgeItems = ['觉醒', '试炼', '危机', '高潮'];
const chapterBadgeItems = ['开篇', '主要冲突', '阶段推进'];
const characterBadgeItems = ['主角', '导师', '对手'];
const worldBadgeItems = ['势力', '地点', '秘密'];
const stageIconItems = [
  ['opening', '开篇'],
  ['awakening', '觉醒'],
  ['trial', '试炼'],
  ['crisis', '危机'],
  ['breakthrough', '突破'],
  ['climax', '高潮']
];
const roleIconItems = [
  ['protagonist', '主角'],
  ['mentor', '导师'],
  ['rival', '对手'],
  ['villain', '反派'],
  ['companion', '同伴'],
  ['mystery', '神秘']
];
const worldIconItems = [
  ['faction', '势力'],
  ['location', '地点'],
  ['artifact', '道具'],
  ['ability', '能力'],
  ['secret', '秘密'],
  ['destiny', '命运']
];
const overrideExamples = [
  {
    category: 'system',
    overrides: ['urban', 'fantasy', 'scifi']
  },
  {
    category: 'fanfic',
    overrides: ['game', 'fantasy']
  }
];

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function ColorSwatch({ label, value, themeKey }) {
  return (
    <div className="rounded-2xl border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_84%,white)] p-4" style={getGenreCssVars(themeKey)}>
      <div className="flex items-center gap-3">
        <span
          className="h-10 w-10 rounded-xl border border-[var(--genre-line)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--genre-text)_8%,transparent)]"
          style={{ background: value }}
        />
        <div className="min-w-0">
          <strong className="block text-sm font-semibold text-[var(--genre-text)]">{label}</strong>
          <span className="mt-1 block break-all text-xs leading-5 text-[var(--genre-muted)]">{value}</span>
        </div>
      </div>
    </div>
  );
}

function UiStyleItem({ title, text, themeKey }) {
  return (
    <div className="rounded-2xl border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_84%,white)] p-4" style={getGenreCssVars(themeKey)}>
      <strong className="block text-sm font-semibold text-[var(--genre-text)]">{title}</strong>
      <p className="mt-2 text-sm leading-6 text-[var(--genre-muted)]">{text}</p>
    </div>
  );
}

function GrammarItem({ title, data, themeKey }) {
  return (
    <GenreCard
      genre={themeKey}
      title={title}
      description="当前主题在这一组视觉语法上的配置。"
    >
      <div className="grid gap-2 text-sm text-[var(--genre-muted)]">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_82%,white)] px-3 py-2">
            <strong className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--genre-text)]">
              {key}
            </strong>
            <span className="mt-1 block break-all leading-6">{value}</span>
          </div>
        ))}
      </div>
    </GenreCard>
  );
}

function IconChip({ label, children, themeKey }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_84%,white)] px-4 py-3"
      style={getGenreCssVars(themeKey)}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-primary)_10%,white)] text-[var(--genre-primary)]">
        {children}
      </span>
      <span className="text-sm font-medium text-[var(--genre-text)]">{label}</span>
    </div>
  );
}

function MappingRow({ categoryKey, currentTheme }) {
  const mappedTheme = categoryToGenreTheme[categoryKey];

  return (
    <div
      className="grid gap-3 rounded-2xl border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_84%,white)] p-4 md:grid-cols-[160px_minmax(0,1fr)_160px_160px]"
      style={getGenreCssVars(currentTheme)}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--genre-muted)]">分类 key</p>
        <p className="mt-1 text-sm font-semibold text-[var(--genre-text)]">{categoryKey}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--genre-muted)]">分类名称</p>
        <p className="mt-1 text-sm text-[var(--genre-text)]">{categoryLabels[categoryKey]}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--genre-muted)]">默认 UI Theme</p>
        <GenreBadge genre={currentTheme} variant="outline" className="mt-2">
          {mappedTheme}
        </GenreBadge>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--genre-muted)]">主题名称</p>
        <p className="mt-1 text-sm text-[var(--genre-text)]">{genreThemeLabels[mappedTheme]}</p>
      </div>
    </div>
  );
}

function OverrideExampleCard({ category, overrides, currentTheme }) {
  const defaultTheme = getGenreThemeByCategory(category);

  return (
    <GenreCard
      genre={currentTheme}
      title={`${category} override 示例`}
      description={`默认 theme：${defaultTheme} · ${genreThemeLabels[defaultTheme]}`}
    >
      <div className="flex flex-wrap gap-2">
        <GenreBadge genre={currentTheme} variant="solid">
          {'默认 -> '}
          {defaultTheme}
        </GenreBadge>
        {overrides.map((overrideTheme) => (
          <GenreBadge key={overrideTheme} genre={overrideTheme} variant="outline">
            {'override -> '}
            {overrideTheme}
          </GenreBadge>
        ))}
      </div>
      <div className="grid gap-2 text-sm text-[var(--genre-muted)]">
        {overrides.map((overrideTheme) => (
          <p key={overrideTheme}>
            {`getGenreThemeByCategory("${category}", "${overrideTheme}") -> "${getGenreThemeByCategory(category, overrideTheme)}"`}
          </p>
        ))}
      </div>
    </GenreCard>
  );
}

export default function GenreUiDemoPage() {
  const [currentTheme, setCurrentTheme] = useState('lightnovel');

  const currentSystem = useMemo(
    () => getGenreVisualSystem(currentTheme),
    [currentTheme]
  );

  const currentVars = useMemo(
    () => getGenreCssVars(currentTheme),
    [currentTheme]
  );

  const currentGrammar = useMemo(
    () => resolveGenreGrammar(currentTheme),
    [currentTheme]
  );

  const availableThemeKeys = GENRE_THEME_KEYS.filter((key) => demoThemeOrder.includes(key));

  return (
    <div
      style={currentVars}
      className="min-h-screen bg-[var(--genre-bg)] px-4 py-8 text-[var(--genre-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <GenrePanel
          genre={currentTheme}
          title="网络小说类型包 UI 系统"
          subtitle="当前只维护 6 个主视觉主题，15 个业务分类统一映射到这 6 套母版。"
        >
          <div className="flex flex-wrap gap-3">
            {demoThemeOrder.map((themeKey) => {
              const theme = getGenreVisualSystem(themeKey);
              return (
                <GenreButton
                  key={themeKey}
                  genre={currentTheme}
                  variant={themeKey === currentTheme ? 'primary' : 'ghost'}
                  size="md"
                  onClick={() => setCurrentTheme(themeKey)}
                >
                  {theme.label}
                </GenreButton>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableThemeKeys.map((themeKey) => (
              <GenreBadge
                key={themeKey}
                genre={currentTheme}
                variant={themeKey === currentTheme ? 'solid' : 'soft'}
              >
                {themeKey}
              </GenreBadge>
            ))}
          </div>
        </GenrePanel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <GenrePanel
            genre={currentTheme}
            title={currentSystem.label}
            subtitle={currentSystem.description}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <GenreCard
                genre={currentTheme}
                title="当前视觉气质"
                description="看这一套主题想传递的页面气质。"
              >
                <p className="text-sm leading-7 text-[var(--genre-muted)]">{currentSystem.tone}</p>
                <div className="flex flex-wrap gap-2">
                  {currentSystem.motifs.map((item) => (
                    <GenreBadge key={item} genre={currentTheme} variant="soft">
                      {item}
                    </GenreBadge>
                  ))}
                </div>
              </GenreCard>

              <GenreCard
                genre={currentTheme}
                title="主题覆盖"
                description="这里只负责视觉母版，不细分业务分类。"
              >
                <div className="grid gap-2 text-sm text-[var(--genre-muted)]">
                  <p>章节阶段语义：{Object.keys(currentSystem.chapterStages).length} 项</p>
                  <p>角色语义：{Object.keys(currentSystem.characterRoles).length} 项</p>
                  <p>世界观语义：{Object.keys(currentSystem.worldElements).length} 项</p>
                  <p>业务分类总数：{BOOK_CATEGORY_KEYS.length} 项</p>
                </div>
              </GenreCard>
            </div>

            <GenreCard
              genre={currentTheme}
              title="颜色 Token"
              description="当前主题的基础色变量。"
            >
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(currentSystem.colors).map(([key, value]) => (
                  <ColorSwatch key={key} themeKey={currentTheme} label={key} value={value} />
                ))}
              </div>
            </GenreCard>

            <GenreCard
              genre={currentTheme}
              title="类型主符号"
              description="主图标负责补上颜色之外的符号识别。"
              headerRight={<GenreMainIcon genre={currentTheme} className="h-7 w-7" />}
            >
              <div className="flex items-center gap-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-[24px] border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_78%,white)] text-[var(--genre-primary)] shadow-[var(--genre-glow)]">
                  <GenreMainIcon genre={currentTheme} className="h-9 w-9" />
                </div>
                <div className="space-y-2 text-sm leading-6 text-[var(--genre-muted)]">
                  <p>主图标跟随当前主题切换，用统一接口表达不同题材的符号语义。</p>
                  <p>这一步开始，系统已不只是在换色，而是在建立题材识别符号。</p>
                </div>
              </div>
            </GenreCard>
          </GenrePanel>

          <GenrePanel
            genre={currentTheme}
            title="UI 风格说明"
            subtitle="像一页设计规范摘录，确认按钮、标签和容器是否统一。"
          >
            <div className="grid gap-3">
              {Object.entries(currentSystem.uiStyle).map(([key, value]) => (
                <UiStyleItem
                  key={key}
                  themeKey={currentTheme}
                  title={key}
                  text={value}
                />
              ))}
            </div>
          </GenrePanel>
        </div>

        <GenrePanel
          genre={currentTheme}
          title="书籍分类映射展示区"
          subtitle="15 个业务分类继续保留，但统一映射到 6 个 UI theme。"
        >
          <div className="grid gap-3">
            {BOOK_CATEGORY_KEYS.map((categoryKey) => (
              <MappingRow
                key={categoryKey}
                categoryKey={categoryKey}
                currentTheme={currentTheme}
              />
            ))}
          </div>
        </GenrePanel>

        <GenrePanel
          genre={currentTheme}
          title="override 示例区"
          subtitle="业务分类不变时，也能通过 overrideTheme 临时切换页面视觉。"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {overrideExamples.map((item) => (
              <OverrideExampleCard
                key={item.category}
                category={item.category}
                overrides={item.overrides}
                currentTheme={currentTheme}
              />
            ))}
          </div>
        </GenrePanel>

        <GenrePanel
          genre={currentTheme}
          title="组件展示一：按钮"
          subtitle="同一套按钮组件，在不同 theme 下应是同体系的不同皮肤。"
        >
          <div className="flex flex-wrap gap-3">
            <GenreButton genre={currentTheme} variant="primary">主按钮</GenreButton>
            <GenreButton genre={currentTheme} variant="secondary">次按钮</GenreButton>
            <GenreButton genre={currentTheme} variant="ghost">幽灵按钮</GenreButton>
            <GenreButton genre={currentTheme} variant="primary" disabled>禁用按钮</GenreButton>
          </div>
        </GenrePanel>

        <GenrePanel
          genre={currentTheme}
          title="视觉语法展示区"
          subtitle="直接展示当前主题的视觉语法 token，确认差异是否已经不只停在换色。"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <GrammarItem themeKey={currentTheme} title="surface" data={currentGrammar.surface} />
            <GrammarItem themeKey={currentTheme} title="shape" data={currentGrammar.shape} />
            <GrammarItem themeKey={currentTheme} title="ornament" data={currentGrammar.ornament} />
            <GrammarItem themeKey={currentTheme} title="interaction" data={currentGrammar.interaction} />
          </div>
        </GenrePanel>

        <GenrePanel
          genre={currentTheme}
          title="类型化图标展示区"
          subtitle="专门验证符号语义层，确认题材差异已进入可复用的小型视觉语言。"
        >
          <GenreCard
            genre={currentTheme}
            title="GenreMainIcon"
            description="每个主题的主图标，负责做类型识别锚点。"
          >
            <div className="flex items-center gap-4">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-[28px] border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_80%,white)] text-[var(--genre-primary)]">
                <GenreMainIcon genre={currentTheme} className="h-11 w-11" />
              </div>
              <div className="space-y-2 text-sm leading-6 text-[var(--genre-muted)]">
                <p>当前主题：{currentSystem.label}</p>
                <p>主图标语气会跟随同一套颜色、边角和线条风格一起变化。</p>
              </div>
            </div>
          </GenreCard>

          <GenreDivider genre={currentTheme} variant="ornate" className="my-1 h-5" />

          <div className="grid gap-4 xl:grid-cols-3">
            <GenreCard
              genre={currentTheme}
              title="章节阶段图标"
              description="用于开篇、觉醒、试炼、危机、突破、高潮等阶段标签。"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {stageIconItems.map(([stageKey, label]) => (
                  <IconChip key={stageKey} themeKey={currentTheme} label={label}>
                    <ChapterStageIcon genre={currentTheme} stage={stageKey} />
                  </IconChip>
                ))}
              </div>
            </GenreCard>

            <GenreCard
              genre={currentTheme}
              title="角色类型图标"
              description="用于主角、导师、对手、反派、同伴、神秘人物等角色语义。"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {roleIconItems.map(([roleKey, label]) => (
                  <IconChip key={roleKey} themeKey={currentTheme} label={label}>
                    <CharacterRoleIcon genre={currentTheme} role={roleKey} />
                  </IconChip>
                ))}
              </div>
            </GenreCard>

            <GenreCard
              genre={currentTheme}
              title="世界观元素图标"
              description="用于势力、地点、道具、能力、秘密、命运等世界观语义。"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {worldIconItems.map(([elementKey, label]) => (
                  <IconChip key={elementKey} themeKey={currentTheme} label={label}>
                    <WorldElementIcon genre={currentTheme} element={elementKey} />
                  </IconChip>
                ))}
              </div>
            </GenreCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <GenreCard
              genre={currentTheme}
              title="分割线展示"
              description="GenreDivider 用于页面分段、卡片分层和类型装饰语气。"
            >
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--genre-muted)]">simple</p>
                  <GenreDivider genre={currentTheme} variant="simple" className="h-4" />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--genre-muted)]">ornate</p>
                  <GenreDivider genre={currentTheme} variant="ornate" className="h-5" />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--genre-muted)]">compact</p>
                  <GenreDivider genre={currentTheme} variant="compact" className="h-4" />
                </div>
              </div>
            </GenreCard>

            <GenreCard
              genre={currentTheme}
              title="卡片角标展示"
              description="GenreCorner 用于四角装饰，帮卡片更像同一个题材体系。"
            >
              <div className="relative min-h-52 rounded-[24px] border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_82%,white)] p-6">
                <GenreCorner genre={currentTheme} position="top-left" className="absolute left-4 top-4" />
                <GenreCorner genre={currentTheme} position="top-right" className="absolute right-4 top-4" />
                <GenreCorner genre={currentTheme} position="bottom-left" className="absolute bottom-4 left-4" />
                <GenreCorner genre={currentTheme} position="bottom-right" className="absolute bottom-4 right-4" />
                <div className="space-y-3 pt-6 text-center">
                  <p className="text-sm font-semibold text-[var(--genre-text)]">四角装饰示例</p>
                  <GenreDivider genre={currentTheme} variant="compact" className="mx-auto max-w-[220px]" />
                  <p className="text-sm leading-6 text-[var(--genre-muted)]">
                    这一层适合给专题卡、章节卡或类型页头补一点边角语法，不必引入重资产插画。
                  </p>
                </div>
              </div>
            </GenreCard>
          </div>
        </GenrePanel>

        <GenrePanel
          genre={currentTheme}
          title="组件展示二：标签"
          subtitle="标签适合承载阶段、情绪、角色和世界观短语义。"
        >
          <div className="flex flex-wrap gap-3">
            {stageBadgeItems.map((item) => (
              <GenreBadge key={`soft-${item}`} genre={currentTheme} variant="soft">
                {item}
              </GenreBadge>
            ))}
            {stageBadgeItems.map((item) => (
              <GenreBadge key={`outline-${item}`} genre={currentTheme} variant="outline">
                {item}
              </GenreBadge>
            ))}
            {stageBadgeItems.map((item) => (
              <GenreBadge key={`solid-${item}`} genre={currentTheme} variant="solid">
                {item}
              </GenreBadge>
            ))}
          </div>
        </GenrePanel>

        <GenrePanel
          genre={currentTheme}
          title="组件展示三：卡片"
          subtitle="这 3 张卡片只放通用网文语义，避免把组件层绑死到真实业务页。"
        >
          <div className="grid gap-4 xl:grid-cols-3">
            <GenreCard
              genre={currentTheme}
              title="开篇章节"
              description="故事从这里进入主要冲突。"
              headerRight={<GenreBadge genre={currentTheme} variant="solid">章节卡</GenreBadge>}
            >
              <GenreDivider genre={currentTheme} variant="compact" />
              <div className="flex flex-wrap gap-2">
                {chapterBadgeItems.map((item) => (
                  <GenreBadge key={item} genre={currentTheme} variant="soft">
                    {item}
                  </GenreBadge>
                ))}
              </div>
              <GenreButton genre={currentTheme} variant="primary">查看章节</GenreButton>
            </GenreCard>

            <GenreCard
              genre={currentTheme}
              title="主角类型"
              description="承担成长、选择和冲突推进。"
              headerRight={<GenreBadge genre={currentTheme} variant="outline">角色卡</GenreBadge>}
            >
              <GenreDivider genre={currentTheme} variant="compact" />
              <div className="flex flex-wrap gap-2">
                {characterBadgeItems.map((item) => (
                  <GenreBadge key={item} genre={currentTheme} variant="soft">
                    {item}
                  </GenreBadge>
                ))}
              </div>
              <GenreButton genre={currentTheme} variant="secondary">查看角色</GenreButton>
            </GenreCard>

            <GenreCard
              genre={currentTheme}
              title="势力与地点"
              description="展示小说世界里的组织、地点与关键规则。"
              headerRight={<GenreBadge genre={currentTheme} variant="soft">世界观卡</GenreBadge>}
            >
              <GenreDivider genre={currentTheme} variant="compact" />
              <div className="flex flex-wrap gap-2">
                {worldBadgeItems.map((item) => (
                  <GenreBadge key={item} genre={currentTheme} variant="outline">
                    {item}
                  </GenreBadge>
                ))}
              </div>
              <GenreButton genre={currentTheme} variant="ghost">查看设定</GenreButton>
            </GenreCard>
          </div>
        </GenrePanel>

        <GenrePanel
          genre={currentTheme}
          title="组件展示四：Panel"
          subtitle="专门展示 GenrePanel 作为页面大容器时的质感。"
        >
          <GenrePanel
            genre={currentTheme}
            className={joinClasses(
              'border-[color:color-mix(in_srgb,var(--genre-primary)_18%,var(--genre-line))]',
              'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--genre-panel)_86%,white),color-mix(in_srgb,var(--genre-primary)_10%,white))]'
            )}
            title="类型包容器示例"
            subtitle="后续这个容器可以承接 Demo 分区、专题页或类型化业务页外层。"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <GenreCard genre={currentTheme} title="语气" description="当前主题想传递的页面第一印象。">
                <p className="text-sm leading-7 text-[var(--genre-muted)]">{currentSystem.tone}</p>
              </GenreCard>
              <GenreCard genre={currentTheme} title="母题" description="当前视觉最常用的图形意象。">
                <div className="flex flex-wrap gap-2">
                  {currentSystem.motifs.slice(0, 3).map((item) => (
                    <GenreBadge key={item} genre={currentTheme} variant="soft">
                      {item}
                    </GenreBadge>
                  ))}
                </div>
              </GenreCard>
              <GenreCard genre={currentTheme} title="动作入口" description="类型化按钮在容器里的协同效果。">
                <div className="flex flex-wrap gap-2">
                  <GenreButton genre={currentTheme} size="sm">切换视图</GenreButton>
                  <GenreButton genre={currentTheme} variant="ghost" size="sm">查看规范</GenreButton>
                </div>
              </GenreCard>
            </div>
          </GenrePanel>
        </GenrePanel>
      </div>
    </div>
  );
}
