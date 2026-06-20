import { useMemo, useState } from 'react';
import {
  BOOK_CATEGORY_KEYS,
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
  getGenreVisualSystem,
  resolveGenreGrammar,
  WorldElementIcon
} from '../genre-ui/index.js';

const ARC_STAGE_KEYS = ['opening', 'awakening', 'trial', 'crisis', 'climax'];
const CAST_ROLE_KEYS = ['protagonist', 'mentor', 'rival', 'mystery'];
const LORE_KEYS = ['faction', 'location', 'artifact', 'secret'];

const THEME_CONTENT_MAP = {
  urban: {
    title: '《霓虹回路》',
    hook: '在高楼玻璃与失控异能之间，主角被迫读懂这座城市真正的规则。',
    summary: '偏都市现代气质。故事从现实秩序裂开开始，主角在职场、圈层与异能之间切换身份，一边承受反噬，一边趁乱突围。',
    badges: ['都市异能', '身份反转', '快节奏'],
    spotlight: ['城市棋局', '现实压迫', '信息战'],
    activeStage: 'trial',
    stages: {
      opening: '现实秩序稳定运转，但异常能力第一次从缝隙里露头。',
      awakening: '主角发现自己能读到信息噪点背后的另一层信号。',
      trial: '进入圈层边缘，第一次在规则与利益之间正面站位。',
      crisis: '身份即将曝光，城市里所有监控都开始对准他。',
      climax: '在公开视野下反制对手，把整座城变成自己的证据链。'
    },
    cast: {
      protagonist: ['野心上升者', '现实派'],
      mentor: ['规则引路', '资源门槛'],
      rival: ['同城对手', '压力镜像'],
      mystery: ['幕后局中人', '身份未明']
    },
    lore: {
      faction: ['资本网络', '灰色联盟'],
      location: ['高楼夜景', '旧城区线索'],
      artifact: ['黑卡终端', '匿名密钥'],
      secret: ['旧案残卷', '舆论反证']
    }
  },
  fantasy: {
    title: '《天阶卷册》',
    hook: '山门初启之后，真正危险的不是外敌，而是每个人都在争的一道天命。',
    summary: '偏东方幻想气质。世界层级、传承与命数共同推动剧情，主角在古老秩序的缝隙里登阶，持续承受因果、门派与宿敌的压迫。',
    badges: ['东方幻想', '宗门登阶', '古纹大局'],
    spotlight: ['山门格局', '命数竞争', '传承真相'],
    activeStage: 'awakening',
    stages: {
      opening: '凡俗世界与更高秩序之间的边界第一次被看见。',
      awakening: '天赋、血脉或机缘被点亮，登阶路线开始显形。',
      trial: '真正的试炼不是战斗，而是是否有资格站进那道门。',
      crisis: '旧秩序开始反扑，主角被迫提前面对更高层敌意。',
      climax: '在众目睽睽之下破局登阶，改写下一阶段的天命次序。'
    },
    cast: {
      protagonist: ['登阶者', '命数中心'],
      mentor: ['问道引路', '世界上限'],
      rival: ['宿命强敌', '同代镜像'],
      mystery: ['旧局知情人', '身份未明']
    },
    lore: {
      faction: ['宗门圣地', '世家旧脉'],
      location: ['边荒秘境', '古城天阶'],
      artifact: ['残卷异火', '古碑道印'],
      secret: ['上古失序', '飞升断层']
    }
  },
  scifi: {
    title: '《灰烬信标》',
    hook: '当最后一座避难城失去坐标，主角必须决定该保护人类秩序，还是重写它。',
    summary: '偏科幻末世气质。废墟、生存协议与任务系统贯穿全页节奏，故事围绕终端权限、资源调度和文明火种展开。',
    badges: ['科幻末世', '终端任务', '生存协议'],
    spotlight: ['废墟秩序', '战术推演', '坐标失真'],
    activeStage: 'crisis',
    stages: {
      opening: '灾变后的秩序仍在勉强维持，所有人都依赖同一套协议活下去。',
      awakening: '主角得到异常权限，开始接触真正的信标系统。',
      trial: '任务终端不断升级，队伍首次进入高风险禁区。',
      crisis: '补给断线、坐标漂移，所有安全规则同时失效。',
      climax: '在全城撤离倒计时里，主角必须重启最后的文明节点。'
    },
    cast: {
      protagonist: ['权限持有者', '高压抉择'],
      mentor: ['战术顾问', '协议解释者'],
      rival: ['资源竞争', '立场冲突'],
      mystery: ['失落坐标源', '封存身份']
    },
    lore: {
      faction: ['避难城邦', '科研军团'],
      location: ['断网前哨', '污染外环'],
      artifact: ['终端芯核', '信标模组'],
      secret: ['战前档案', '协议黑箱']
    }
  },
  mystery: {
    title: '《封存夜谈》',
    hook: '每一次翻开旧档案，主角都离真相更近一步，也离危险更近一步。',
    summary: '偏悬疑灵异气质。页面像案件档案与线索板，故事围绕旧案、封存记录与异常展开，让线索、关系和规则压迫同步升级。',
    badges: ['悬疑灵异', '旧案拼图', '规则压迫'],
    spotlight: ['封存档案', '线索逆转', '异常规则'],
    activeStage: 'opening',
    stages: {
      opening: '一个看似结案的旧档案，被新的异常再次拉回光下。',
      awakening: '主角第一次意识到线索之外还有一套看不见的规则。',
      trial: '每一次夜探都像在验证自己还能不能活着回来。',
      crisis: '关键证人消失，线索链条在最接近真相时突然断裂。',
      climax: '主角必须在真相公开和更大黑幕之间做出危险选择。'
    },
    cast: {
      protagonist: ['线索拼接者', '高压视角'],
      mentor: ['旧案知情人', '规则提示'],
      rival: ['时间对手', '真相竞争'],
      mystery: ['危险证人', '身份飘忽']
    },
    lore: {
      faction: ['调查小组', '旧教残脉'],
      location: ['封楼走廊', '停尸档案室'],
      artifact: ['录音遗物', '封条残页'],
      secret: ['禁忌记录', '旧案底层真相']
    }
  },
  game: {
    title: '《赛季回响》',
    hook: '当一次普通开局突然变成全服唯一任务，主角的人生也被写进版本更新里。',
    summary: '偏游戏竞技气质。页面强调任务日志、状态面板和阶段推进，故事围绕职业成长、队伍协作、赛季目标与规则翻盘展开。',
    badges: ['游戏竞技', '赛季成长', '任务面板'],
    spotlight: ['任务链', '队伍协作', '版本翻盘'],
    activeStage: 'trial',
    stages: {
      opening: '主角从新手开局进入一条别人看不到的任务链。',
      awakening: '系统权限升级，职业路线第一次出现真正分岔。',
      trial: '副本、天梯和资源位开始同时压测主角的判断力。',
      crisis: '团战失误导致整支队伍掉出榜单安全区。',
      climax: '在最终赛点里利用隐藏机制完成版本级翻盘。'
    },
    cast: {
      protagonist: ['任务持有者', '成长主核'],
      mentor: ['老玩家指挥', '机制解释'],
      rival: ['同服天梯敌手', '赛场镜像'],
      mystery: ['隐藏 NPC', '匿名高手']
    },
    lore: {
      faction: ['公会阵营', '服务器联盟'],
      location: ['主城大厅', '首领副本'],
      artifact: ['稀有装备', '赛季钥匙'],
      secret: ['隐藏任务', '策划埋线']
    }
  },
  lightnovel: {
    title: '《星屑社团日志》',
    hook: '看似轻快的日常，从某个新角色出现后，悄悄偏离了原来的轨道。',
    summary: '偏轻小说动漫气质。页面更轻、更有角色感，故事从关系起点和日常节奏切入，逐步解锁角色关系与世界秘密。',
    badges: ['轻小说动漫', '角色关系', '日常悬念'],
    spotlight: ['便签式日常', '关系推进', '设定翻面'],
    activeStage: 'climax',
    stages: {
      opening: '日常像往常一样展开，但某个设定钩子悄悄埋进第一页。',
      awakening: '能力或关系开始显露变化，角色间的距离被重新定义。',
      trial: '一次看似轻松的社团任务，暴露了更深层的问题。',
      crisis: '情绪误会与设定真相碰撞，让关系瞬间跌入谷底。',
      climax: '在最温柔的场景里，角色终于做出最重要的选择。'
    },
    cast: {
      protagonist: ['情绪视角', '关系中心'],
      mentor: ['年长引导', '认知补位'],
      rival: ['情感竞争', '价值差异'],
      mystery: ['反差角色', '里侧关键']
    },
    lore: {
      faction: ['社团阵列', '学园组织'],
      location: ['社团室', '放学街区'],
      artifact: ['契约信物', '角色挂饰'],
      secret: ['校园旧闻', '世界里侧']
    }
  }
};

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function getThemeCategoryGroups() {
  return BOOK_CATEGORY_KEYS.reduce((result, categoryKey) => {
    const themeKey = categoryToGenreTheme[categoryKey];
    if (!result[themeKey]) result[themeKey] = [];
    result[themeKey].push(categoryKey);
    return result;
  }, {});
}

function getRoleTitle(role) {
  const labelMap = {
    protagonist: '主角位',
    mentor: '导师位',
    rival: '对手位',
    mystery: '神秘位'
  };

  return labelMap[role] || role;
}

function getLoreTitle(element) {
  const labelMap = {
    faction: '势力组',
    location: '场景组',
    artifact: '关键物',
    secret: '里层秘密'
  };

  return labelMap[element] || element;
}

function ThemeSwitcher({ currentTheme, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {GENRE_THEME_KEYS.map((themeKey) => (
        <GenreButton
          key={themeKey}
          genre={currentTheme}
          variant={themeKey === currentTheme ? 'primary' : 'ghost'}
          onClick={() => onChange(themeKey)}
        >
          {genreThemeLabels[themeKey]}
        </GenreButton>
      ))}
    </div>
  );
}

function HeroVisual({ themeKey, spotlight }) {
  const grammar = resolveGenreGrammar(themeKey);
  const theme = getGenreVisualSystem(themeKey);
  const frameClassMap = {
    urban: 'grid grid-cols-[1fr_1fr] gap-3',
    fantasy: 'flex flex-col items-center justify-center gap-4',
    scifi: 'grid grid-cols-[1fr_auto] gap-3',
    mystery: 'flex flex-col gap-3',
    game: 'grid grid-cols-[1.15fr_0.85fr] gap-3',
    lightnovel: 'grid grid-cols-[1fr_1fr] gap-3'
  };

  return (
    <div
      style={{
        ...getGenreCssVars(themeKey),
        background: [grammar.ornament.pattern, grammar.surface.cardGradient].join(', '),
        boxShadow: grammar.surface.shadow,
        borderRadius: grammar.shape.cardRadius,
        borderWidth: grammar.shape.borderWidth
      }}
      className={joinClasses(
        'relative min-h-[320px] overflow-hidden border border-[var(--genre-line)] p-5 text-[var(--genre-text)]',
        frameClassMap[themeKey] || frameClassMap.lightnovel
      )}
    >
      <GenreCorner genre={themeKey} position="top-left" className="absolute left-4 top-4" />
      <GenreCorner genre={themeKey} position="bottom-right" className="absolute bottom-4 right-4" />
      <div className="relative flex flex-col justify-between gap-4 rounded-[24px] border border-[color:color-mix(in_srgb,var(--genre-primary)_18%,var(--genre-line))] bg-[color:color-mix(in_srgb,var(--genre-panel)_78%,white)] p-4">
        <div className="flex items-center justify-between gap-3">
          <GenreBadge genre={themeKey} variant="outline">
            主视觉符号
          </GenreBadge>
          <GenreBadge genre={themeKey} variant="soft">
            {theme.label}
          </GenreBadge>
        </div>
        <div className="flex h-full items-center justify-center rounded-[22px] border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-primary)_10%,white)] text-[var(--genre-primary)]">
          <GenreMainIcon genre={themeKey} className="h-16 w-16" />
        </div>
      </div>

      <div className="relative flex flex-col gap-3">
        <GenreDivider genre={themeKey} variant={themeKey === 'mystery' ? 'compact' : 'ornate'} className="h-4" />
        {spotlight.map((item, index) => (
          <div
            key={item}
            className={joinClasses(
              'rounded-2xl border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_76%,white)] px-4 py-3',
              index === 0 ? 'translate-x-0' : '',
              index === 1 ? 'translate-x-3' : '',
              index === 2 ? 'translate-x-1' : ''
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--genre-muted)]">
              Scene 0{index + 1}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--genre-text)]">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookHero({ themeKey, content, themeCategories }) {
  return (
    <section
      style={getGenreCssVars(themeKey)}
      className="relative overflow-hidden rounded-[36px] border border-[var(--genre-line)] bg-[var(--genre-panel)] px-6 py-7 shadow-[var(--genre-glow)] sm:px-8 lg:px-10 lg:py-10"
    >
      <GenreCorner genre={themeKey} position="top-left" className="absolute left-5 top-5 h-7 w-7" />
      <GenreCorner genre={themeKey} position="top-right" className="absolute right-5 top-5 h-7 w-7" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:items-center">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <GenreBadge genre={themeKey} variant="solid">
              {genreThemeLabels[themeKey]}
            </GenreBadge>
            <GenreBadge genre={themeKey} variant="outline">
              覆盖分类 {themeCategories.length} 项
            </GenreBadge>
            <GenreBadge genre={themeKey} variant="soft">
              连载专题页 Demo
            </GenreBadge>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--genre-muted)]">
              Modular Novel Showcase
            </p>
            <h1 className="text-[clamp(2.4rem,4vw,4.4rem)] font-semibold tracking-[-0.05em] text-[var(--genre-text)]">
              {content.title}
            </h1>
            <p className="max-w-[40rem] text-lg leading-8 text-[var(--genre-primary)]">
              {content.hook}
            </p>
            <p className="max-w-[44rem] text-[15px] leading-8 text-[var(--genre-muted)]">
              {content.summary}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {content.badges.map((item) => (
              <GenreBadge key={item} genre={themeKey} variant="soft">
                {item}
              </GenreBadge>
            ))}
          </div>

          <GenreDivider genre={themeKey} variant="simple" className="h-4 max-w-[520px]" />

          <div className="flex flex-wrap gap-3">
            <GenreButton genre={themeKey} variant="primary" size="lg">
              开始阅读
            </GenreButton>
            <GenreButton genre={themeKey} variant="secondary" size="lg">
              加入书架
            </GenreButton>
          </div>

          <div className="flex flex-wrap gap-2">
            {themeCategories.map((categoryKey) => (
              <GenreBadge key={categoryKey} genre={themeKey} variant="outline">
                {categoryKey}
              </GenreBadge>
            ))}
          </div>
        </div>

        <HeroVisual themeKey={themeKey} spotlight={content.spotlight} />
      </div>
    </section>
  );
}

function ChapterArc({ themeKey, content }) {
  return (
    <GenrePanel
      genre={themeKey}
      title="章节弧线"
      subtitle="像卷轴线、案件线、任务线那样去看故事推进。"
    >
      <div className="relative">
        <div className="pointer-events-none absolute left-7 right-7 top-7 hidden border-t border-dashed border-[var(--genre-line)] md:block" />
        <div className="grid gap-4 md:grid-cols-5">
          {ARC_STAGE_KEYS.map((stageKey, index) => {
            const isActive = content.activeStage === stageKey;
            const stageText = content.stages[stageKey];

            return (
              <div
                key={stageKey}
                className={joinClasses(
                  'relative flex flex-col gap-3 rounded-[24px] border p-4 transition duration-150',
                  isActive
                    ? 'border-[var(--genre-primary)] bg-[color:color-mix(in_srgb,var(--genre-primary)_12%,var(--genre-panel))] shadow-[var(--genre-glow)]'
                    : 'border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_84%,white)]'
                )}
              >
                <div className="relative z-10 flex items-center gap-3">
                  <span
                    className={joinClasses(
                      'inline-flex h-10 w-10 items-center justify-center rounded-2xl border',
                      isActive
                        ? 'border-[var(--genre-primary)] bg-[color:color-mix(in_srgb,var(--genre-primary)_14%,white)] text-[var(--genre-primary)]'
                        : 'border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_78%,white)] text-[var(--genre-secondary)]'
                    )}
                  >
                    <ChapterStageIcon genre={themeKey} stage={stageKey} />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--genre-muted)]">
                      Stage {index + 1}
                    </p>
                    <p className="text-sm font-semibold text-[var(--genre-text)]">{stageKey}</p>
                  </div>
                </div>
                <p className="text-sm leading-7 text-[var(--genre-muted)]">{stageText}</p>
                {isActive ? (
                  <GenreBadge genre={themeKey} variant="solid" className="w-fit">
                    当前阶段
                  </GenreBadge>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </GenrePanel>
  );
}

function CharacterCast({ themeKey, content }) {
  return (
    <GenrePanel
      genre={themeKey}
      title="角色阵容"
      subtitle="像小说详情页里的角色阵列区，用定位和关系建立阅读预期。"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <GenreCard
          genre={themeKey}
          title={getRoleTitle('protagonist')}
          description="作为主视角，承担成长、抉择与节奏牵引。"
          className="min-h-[240px]"
          headerRight={<CharacterRoleIcon genre={themeKey} role="protagonist" className="h-6 w-6" />}
        >
          <p className="text-sm leading-7 text-[var(--genre-muted)]">
            {content.hook}
          </p>
          <div className="flex flex-wrap gap-2">
            {content.cast.protagonist.map((item) => (
              <GenreBadge key={item} genre={themeKey} variant="soft">
                {item}
              </GenreBadge>
            ))}
          </div>
          <GenreDivider genre={themeKey} variant="compact" className="h-4" />
          <p className="text-sm leading-7 text-[var(--genre-muted)]">
            这一位不是普通主角卡，而是整页阅读重心。
          </p>
        </GenreCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {CAST_ROLE_KEYS.filter((role) => role !== 'protagonist').map((roleKey) => (
            <GenreCard
              key={roleKey}
              genre={themeKey}
              title={getRoleTitle(roleKey)}
              description={getGenreVisualSystem(themeKey).characterRoles[roleKey]}
              headerRight={<CharacterRoleIcon genre={themeKey} role={roleKey} className="h-5 w-5" />}
            >
              <div className="flex flex-wrap gap-2">
                {content.cast[roleKey].map((item) => (
                  <GenreBadge key={item} genre={themeKey} variant="outline">
                    {item}
                  </GenreBadge>
                ))}
              </div>
            </GenreCard>
          ))}
        </div>
      </div>
    </GenrePanel>
  );
}

function WorldLore({ themeKey, content }) {
  return (
    <GenrePanel
      genre={themeKey}
      title="世界观资料"
      subtitle="像小说详情页里的资料区，用组织、地点、道具和秘密立出世界轮廓。"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {LORE_KEYS.map((elementKey) => (
          <GenreCard
            key={elementKey}
            genre={themeKey}
            title={getLoreTitle(elementKey)}
            description={getGenreVisualSystem(themeKey).worldElements[elementKey]}
            headerRight={<WorldElementIcon genre={themeKey} element={elementKey} className="h-5 w-5" />}
            className="min-h-[220px]"
          >
            <p className="text-sm leading-7 text-[var(--genre-muted)]">
              {content.summary}
            </p>
            <div className="flex flex-wrap gap-2">
              {content.lore[elementKey].map((item) => (
                <GenreBadge key={item} genre={themeKey} variant="soft">
                  {item}
                </GenreBadge>
              ))}
            </div>
          </GenreCard>
        ))}
      </div>
    </GenrePanel>
  );
}

function ReadingCta({ themeKey }) {
  return (
    <section
      style={getGenreCssVars(themeKey)}
      className="rounded-[34px] border border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_88%,white)] px-6 py-8 text-center shadow-[var(--genre-glow)] sm:px-8"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5">
        <GenreDivider genre={themeKey} variant="ornate" className="h-5 max-w-[360px]" />
        <h2 className="text-[clamp(1.8rem,2.6vw,2.8rem)] font-semibold tracking-[-0.04em] text-[var(--genre-text)]">
          准备进入这个故事了吗？
        </h2>
        <p className="max-w-2xl text-[15px] leading-8 text-[var(--genre-muted)]">
          从第一章开始，逐步解锁角色关系、世界秘密与命运分支。
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <GenreButton genre={themeKey} variant="primary" size="lg">
            开始阅读
          </GenreButton>
          <GenreButton genre={themeKey} variant="ghost" size="lg">
            查看大纲
          </GenreButton>
        </div>
      </div>
    </section>
  );
}

export default function GenreBookShowcasePage() {
  const [currentTheme, setCurrentTheme] = useState('lightnovel');

  const currentVars = useMemo(() => getGenreCssVars(currentTheme), [currentTheme]);
  const currentContent = useMemo(() => THEME_CONTENT_MAP[currentTheme], [currentTheme]);
  const themeCategories = useMemo(() => getThemeCategoryGroups()[currentTheme] || [], [currentTheme]);

  return (
    <div
      style={currentVars}
      className="min-h-screen bg-[var(--genre-bg)] px-4 py-8 text-[var(--genre-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <GenrePanel
          genre={currentTheme}
          title="真实小说网站模块化 Demo"
          subtitle="这页不再是组件陈列，而是用现有 genre-ui 拼出更像小说详情页的模块节奏。"
        >
          <ThemeSwitcher currentTheme={currentTheme} onChange={setCurrentTheme} />
        </GenrePanel>

        <BookHero
          themeKey={currentTheme}
          content={currentContent}
          themeCategories={themeCategories}
        />

        <ChapterArc themeKey={currentTheme} content={currentContent} />

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <CharacterCast themeKey={currentTheme} content={currentContent} />
          <WorldLore themeKey={currentTheme} content={currentContent} />
        </div>

        <ReadingCta themeKey={currentTheme} />
      </div>
    </div>
  );
}
