import '../styles.css';
import '../app-shell.css';

const conceptChain = [
  {
    order: '01',
    label: '全书规划',
    db: 'book_plans',
    output: '产出全书主线、世界规则、核心冲突、分卷草案',
    note: '定整本书方向，不定单章。'
  },
  {
    order: '02',
    label: '分卷规划',
    db: 'volume_plans',
    output: '产出本卷阶段目标、卷级冲突、卷末结果、激活线池',
    note: '把长线拆成卷任务，不定单章钩子。'
  },
  {
    order: '03',
    label: '剧情线规划',
    db: 'storylines',
    output: '产出本卷剧情线集合、初始起止章节、跨卷许可与收束预期',
    note: '先定本卷有哪些线，再按章挂载。'
  },
  {
    order: '04',
    label: '章节目标',
    db: 'chapter_plans',
    output: '产出本章任务、情绪目标、主推进线、关联线、出场角色',
    note: '定本章挂哪几条线、主推哪条。'
  },
  {
    order: '05',
    label: '章节细纲',
    db: 'chapter_plans',
    output: '产出场景拆解、冲突推进、结尾钩子、结构化细纲',
    note: '定这一章怎么写，是正文前最后一层。'
  },
  {
    order: '06',
    label: '正文生成',
    db: 'chapters',
    output: '产出正文、字数、章节状态',
    note: '按既定目标和细纲写成正文。'
  },
  {
    order: '07',
    label: '生成反馈',
    db: 'chapter_plans / storylines',
    output: '产出推进反馈、状态回写、下一章焦点',
    note: '把结果回写成推进状态，形成闭环。'
  },
  {
    order: '08',
    label: '校改收口',
    db: 'chapters / structured_content',
    output: '产出局部修改、人工保留结果、最终稿',
    note: '做局部精修，不重做上游规划。'
  }
];

const mismatchAlerts = [
  {
    title: '当前第一卡点：章节规划层还没彻底拆清目标层和执行层',
    detail: '主链已能从章节任务表一路推进到正文和反馈，但 chapter_plans 里还同时挂着“推什么”和“怎么写”，会继续影响边界。'
  },
  {
    title: '当前第二卡点：剧情线回写已接通，但 storylines 还没变成稳定中枢',
    detail: '章节反馈已能把进度推回剧情线，也能带动 active 推进；但 storylines 仍同时承担主链中枢和兼容容器两种角色。'
  }
];

const branchChains = [
  {
    title: '角色链',
    summary: '这条链解决“角色信息应该怎样稳定传到章节层”，重点不是把角色像剧情一样硬拆成递进台阶，而是把“底色、锚点、执行、观察、修正”五层职责分开。',
    stages: [
      {
        layer: '全书角色底色层',
        source: 'book_plans.role_summary',
        input: '整本书主要角色的性格底盘、核心动机、价值取向、关系底盘、长期稳定特征。',
        process: '这里只定义“这个人本来是谁”。它是长期主档，不处理章节出场，也不记录短期剧情波动。',
        output: '向下提供稳定角色主档，供剧情线锚点层和章节执行层引用。',
        required: ['role_summary'],
        optional: ['premise', 'main_goal', 'core_conflict', 'world_rules'],
        forbidden: '不能把单章情绪、临时合作、一次冲突反应直接回写成角色底色。'
      },
      {
        layer: '剧情线角色锚点层',
        source: 'storylines.structured_content.role_change_anchors（待补）',
        input: '全书角色底色 + 当前剧情线状态 + 上一章反馈里的角色推进信息。',
        process: '这里只回答“这条剧情线里，这个角色接下来能往哪边动、不能提前跳到哪”。它是模型参考层，不是人工逐章剧本层。',
        output: '向章节执行层提供角色变化边界、当前阶段位置和禁止跳变提醒。',
        required: ['role', 'current_baseline', 'next_allowed_change', 'forbidden_jump'],
        optional: ['anchor_reason', 'related_storyline', 'stage_status'],
        forbidden: '不能把剧情线锚点写成逐章台词单，也不能让它直接替代章节计划。'
      },
      {
        layer: '章节角色执行层',
        source: 'chapter_plans.structured_content.role_execution',
        input: '全书角色底色 + 剧情线角色锚点 + 本章任务与出场角色名单。',
        process: '这一层才真正回答“这章这个角色具体承担什么作用、允许变化到哪、绝对不能提前发生什么”。这是正文生成的直接角色输入层。',
        output: '向正文生成提供本章角色执行参数，向生成前检查提供高风险提醒。',
        required: ['role', 'chapter_function', 'allowed_change', 'forbidden_change'],
        optional: ['baseline', 'dimension', 'direction', 'scope', 'confidence'],
        forbidden: '不能只给出角色名单而没有执行边界，也不能让模型只靠自由发挥决定角色本章作用。'
      },
      {
        layer: '章节后角色观察层',
        source: 'chapter_feedback / structured_content（待正式结构化）',
        input: '本章正文 + 本章角色执行层 + 本章计划。',
        process: '这一层只记录“这一章这个角色实际表现成什么样”，它是观察样本，不是底色修正结果。',
        output: '向后续章节提供短程承接信息，向修正候选层提供连续观察样本。',
        required: ['role', 'observed_trait', 'direction', 'scope', 'evidence'],
        optional: ['confidence', 'chapter_number', 'storyline_effect'],
        forbidden: '不能因为单章观察到一次变化，就直接宣布人物底色已经改变。'
      },
      {
        layer: '跨章节修正候选层',
        source: '角色观察记录聚合（待补）',
        input: '连续多个章节的角色观察记录 + 全书角色底色主档。',
        process: '这一层负责判断“这是不是已经从短期表现，变成值得复核的长期趋势”。默认只产出候选，不自动改主档。',
        output: '向人工审核或后续自动复核提供底色修正候选，再决定是否回写角色底色层。',
        required: ['role', 'dimension', 'direction', 'window_hits', 'review_status'],
        optional: ['candidate_summary', 'supporting_chapters', 'confidence'],
        forbidden: '不能让单章结果直接改底色，也不能把剧情态误当成长期人格迁移。'
      }
    ],
    rule: '当前优选规则：角色链不是“全书 -> 分卷 -> 章节”的硬递进链，而是“底色主档 -> 剧情线锚点 -> 章节执行 -> 章节观察 -> 修正候选”的闭环链。底色层负责“这个人是谁”，锚点层负责“这条线里能怎么动”，执行层负责“这章具体怎么用”，观察层负责“实际写出来怎样”，修正层负责“多章后是否值得改底色”。'
  },
  {
    title: '大纲链',
    summary: '这条链解决“这一章为什么会写成这样”，重点不是文本长短，而是目标是从哪一层被传下来的。',
    stages: [
      {
        layer: '全书规划',
        source: 'book_plans.main_outline / volume_outline / detailed_outline',
        input: '整本书主线、世界规则、长期冲突、总阶段设计。',
        process: '这里只给方向，不给具体章节行动。',
        output: '向分卷层提供长期主线和不可违背的总约束。',
        required: ['main_outline'],
        optional: ['volume_outline', 'detailed_outline', 'main_goal', 'world_rules'],
        forbidden: '不能直接从这里生成本章任务。'
      },
      {
        layer: '分卷规划',
        source: 'volume_plans.stage_goal / core_conflict / structured_content',
        input: '全书规划 + 本卷在全书中的阶段位置。',
        process: '这里只决定“这一卷要解决什么阶段问题”，不直接决定第几章怎么收尾。',
        output: '向剧情线层提供本卷阶段目标、卷级冲突和卷内容量。',
        required: ['stage_goal'],
        optional: ['core_conflict', 'estimated_chapters', 'storyline_quota'],
        forbidden: '不能让分卷摘要直接替代剧情线推进判断。'
      },
      {
        layer: '剧情线规划',
        source: 'storylines',
        input: '分卷阶段目标 + 当前活跃冲突。',
        process: '这一层决定当前该推进哪条线、推进到什么程度，是章节层之前的中枢决策层。',
        output: '向章节层提供主推进线、关联线和本章应承接的节奏压力。',
        required: ['storyline_name', 'core_conflict', 'start_chapter', 'end_chapter'],
        optional: ['structured_content', 'description', 'key_nodes'],
        forbidden: '不能跳过这层，直接拿全书/分卷摘要拼 chapter_mission。'
      },
      {
        layer: '章节目标与细纲',
        source: 'chapter_plans.chapter_mission / emotion_target / scene_outline / outline_text',
        input: '剧情线推进要求 + 本章角色与承接钩子。',
        process: '这一层先定“本章推进什么”，再定“本章具体怎么写”。',
        output: '向正文生成提供本章任务、情绪目标、场景拆解和结尾钩子。',
        required: ['chapter_mission', 'main_storyline_id'],
        optional: ['emotion_target', 'scene_outline', 'outline_text', 'target_storylines', 'ending_hook'],
        forbidden: '这一层不能把缺失的剧情线决策硬塞回全书大纲去补。'
      }
    ],
    rule: '当前优选规则：章节目标主要受剧情线层驱动，不能跳过剧情线，直接拿全书大纲或分卷摘要去拼本章任务。'
  }
];

const currentTracks = [
  {
    track: '前端',
    title: 'React 前端改造',
    status: '稳定期',
    statusTone: 'done',
    logic: '这一块不再大拆骨架，重点是把 React 工作台、资料库和说明页继续拉齐口径，补视觉统一和稳定性。',
    goal: '前端主改造已收口，现阶段以稳定和小修为主。',
    done: [
      'React 工作台已经接管创作主入口，旧静态前端退到兼容层。',
      '路由、工作台双栏结构、抽屉区、章节三态、校改闭环都已经接通并验收。',
      '资料库、样式管理、说明页等外围页面已经进入 React 体系内统一维护。',
      '当前文档已明确：工程地基、信息架构、交互收口都已完成。'
    ],
    todo: [
      '继续处理页面之间残留的视觉不统一，避免有的页面像新站，有的页面还像旧壳。',
      '后续优先做稳定性回归和性能优化，不再重开一轮大改造。'
    ],
    nextGate: '这不是不管前端，而是后续所有调整都要建立在现有 React 架构上。',
    files: [
      'frontend-react/src/App.jsx',
      'frontend-react/src/router.jsx',
      'frontend-react/src/components/workbench/*',
      'frontend-react/src/pages/*',
      'docs/latest-task-status.md'
    ]
  },
  {
    track: '链路',
    title: '生成链路校正',
    status: '进行中',
    statusTone: 'active',
    logic: '这一块不是堆新功能，而是把“全书规划 -> 分卷规划 -> 剧情线 -> 章节目标 -> 章节细纲 -> 正文 -> 反馈回写”的边界校正清楚。',
    goal: '当前主任务已从“能不能跑”转成“怎么稳定传、怎么回写、怎么避免混层”。',
    done: [
      'book_plans 和 volume_plans 已经开始承担正式主表职责，旧表只做兼容兜底。',
      '章节计划、正文生成、chapter_feedback 回写这条最小闭环已经验通过。',
      '剧情线进度已能从章节反馈写回 storylines.structured_content.chapter_progress，并推动 active 状态。',
      'generation-logic 页面已经按新链路拆出了全书、分卷、剧情线、章节、反馈的层级说明。'
    ],
    todo: [
      '继续把剧情线定义从“说明概念”收成“前端可见、可挂载、可回写修正”的真实结构。',
      '继续拆清 chapter_plans 里的目标层和执行层，避免一张表同时说“这章推什么”和“这章怎么写”。',
      '把“剧情线影响下一章目标”的下行联动补齐，形成真正闭环。'
    ],
    nextGate: '这一块做完后，前端看到的就不只是生成按钮，而是完整传递链路。',
    files: [
      'frontend-react/src/pages/GenerationLogicPage.jsx',
      'frontend-react/src/workbenchApi.js',
      'backend/routes/ai.js',
      'backend/routes/data.js',
      'docs/task-board.md'
    ]
  },
  {
    track: '正式化',
    title: '结构正式化卡点',
    status: '继续收口',
    statusTone: 'warm',
    logic: '这张卡讲的不是新路线，而是当前还没彻底收干净的旧职责和兼容层。真正难点不在“有没有数据”，而在“哪一层应该说哪句话”。',
    goal: '把旧兼容结构稳定降级，把剧情线与反馈层从“已接上”推进到“职责清楚、长期可维护”。',
    done: [
      'React 全书规划读取与保存已经切到 book_plans 优先。',
      'React 章节准备区已经优先读取 volume_plans。',
      '章节反馈已经能推动剧情线进入 active，而不是只停在正文生成结果里。'
    ],
    todo: [
      '继续压缩 novel_outlines 和 volume_settings 的主链职责，让它们只保留兼容意义。',
      '继续推进 chapter_feedback 独立化，避免长期挂在 structured_content 上。',
      '把剧情线回写从“库里有记录”继续推进到“前端页面能稳定解释和利用”。'
    ],
    nextGate: '如果这层不收好，后面无论是继续做自动决策、写作辅助还是更细的模型控制，都会被旧结构反复拖回来。',
    files: [
      'backend/services/VolumePlanService.js',
      'backend/routes/data.js',
      'frontend-react/src/workbenchApi.js',
      'docs/latest-task-status.md',
      'docs/task-board.md'
    ]
  }
];

const storylineBoardGuide = [
  {
    title: '初始章数',
    detail: '每条剧情线一开始就允许给“预计起始章”和“预计终止章”，这样创作者对篇幅和节奏有明确预期。'
  },
  {
    title: '动态校正',
    detail: '正文写完后，不是只记一句“已推进”，而是根据真实结果缩短、延长、拆分或跨卷转移剧情线。'
  },
  {
    title: '收卷判断',
    detail: '进入下一卷不能只看写到第几章，还要同时看卷目标、必要剧情线、角色状态和下卷钩子是否到位。'
  }
];

const storylineBoard = {
  volumeBands: [
    { label: '全书', span: 12, tone: 'book', range: '长期总方向' },
    { label: '卷1', span: 6, tone: 'volume-1', range: '预计 1-24 章' },
    { label: '卷2', span: 3, tone: 'volume-2', range: '预计 25-36 章' },
    { label: '卷3', span: 3, tone: 'volume-3', range: '预计 37-48 章' }
  ],
  stageBands: [
    '卷1 · 起势',
    '卷1 · 推进',
    '卷1 · 转折',
    '卷1 · 高压',
    '卷1 · 收束前',
    '卷1 · 卷尾',
    '卷2 · 起势',
    '卷2 · 对抗',
    '卷2 · 卷尾',
    '卷3 · 起势',
    '卷3 · 高潮',
    '卷3 · 终局'
  ],
  rows: [
    {
      label: '全书总线',
      hint: '长期不变的总命题与总冲突',
      tone: 'book',
      bars: [
        {
          start: 1,
          span: 12,
          title: '命运真相线',
          meta: '全书长期主线 · 跨卷延续',
          status: '长期活跃'
        }
      ]
    },
    {
      label: '卷1 · 主线',
      hint: '当前卷必须完成的阶段任务',
      tone: 'main',
      bars: [
        {
          start: 1,
          span: 6,
          title: '走出封闭世界',
          meta: '卷1主任务 · 初始计划 1-24 章',
          status: '进行中'
        }
      ]
    },
    {
      label: '卷1 · 支线1',
      hint: '服务主角立足与早期成长',
      tone: 'growth',
      bars: [
        {
          start: 1,
          span: 2,
          title: '求生立足线',
          meta: '初始计划 1-8 章',
          status: '可提前收束'
        }
      ]
    },
    {
      label: '卷1 · 支线2',
      hint: '可与主线并行推进的关系或资源线',
      tone: 'relation',
      bars: [
        {
          start: 1,
          span: 4,
          title: '师门关系线',
          meta: '初始计划 2-16 章',
          status: '进行中'
        }
      ]
    },
    {
      label: '卷1 · 支线3',
      hint: '中段爆发的阶段事件线',
      tone: 'trial',
      bars: [
        {
          start: 2,
          span: 3,
          title: '洞府传承线',
          meta: '初始计划 7-14 章',
          status: '回写后可缩短'
        }
      ]
    },
    {
      label: '卷1 · 支线4',
      hint: '尾段接入的伏笔或钩子线',
      tone: 'hook',
      bars: [
        {
          start: 4,
          span: 3,
          title: '旧势力露头线',
          meta: '初始计划 15-24 章',
          status: '可能跨卷'
        }
      ]
    },
    {
      label: '卷2 · 主线',
      hint: '上一卷收束后承接的下一阶段任务',
      tone: 'main',
      bars: [
        {
          start: 7,
          span: 3,
          title: '进入更大棋局',
          meta: '卷2主任务 · 初始计划 25-36 章',
          status: '待激活'
        }
      ]
    },
    {
      label: '跨卷延续线',
      hint: '本卷未完但需转交下一卷的线',
      tone: 'carry',
      bars: [
        {
          start: 6,
          span: 4,
          title: '血脉真相线',
          meta: '卷1尾声露头，卷2继续发酵',
          status: '跨卷延续'
        }
      ]
    }
  ],
  currentMarker: {
    chapter: '当前写作：卷1 · 第 9 章',
    note: '此时应该优先挂“卷1主线 + 洞府传承线”，并允许顺带推进师门关系线。',
    gridColumn: 3.2
  }
};

function SectionLine({ text }) {
  return (
    <div className="section-line" aria-hidden="true">
      <span>{text}</span>
    </div>
  );
}

function getTimelineBarStyle(bar) {
  return {
    gridColumn: `${bar.start} / span ${bar.span}`
  };
}

export default function GenerationLogicPage() {
  return (
    <div className="page-shell">
      <header className="hero-section logic-hero">
        <div>
          <span className="hero-eyebrow">Generation Logic</span>
          <h1>生成逻辑与结构归属图</h1>
          <p>这页把主链、主表、真实路由和前端入口放在一张图里。</p>
        </div>
        <div className="hero-note-card logic-note">
          <strong>当前重点</strong>
          <p>当前顺序是先验主链，再收入口，最后正结构。</p>
        </div>
      </header>

      <section className="logic-section">
        <div className="section-head">
          <span className="guide-eyebrow">Concept Chain</span>
          <SectionLine text="严格递进主链" />
        </div>
        <div className="chain-grid">
          {conceptChain.map((item) => (
            <article key={item.order} className="chain-card panel-card is-card">
              <span className="chain-order">{item.order}</span>
              <strong>{item.label}</strong>
              <p className="chain-output">{item.output}</p>
              <p>{item.note}</p>
              <em className="chain-db-tag">{item.db}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="logic-section">
        <div className="section-head">
          <span className="guide-eyebrow">Focus</span>
          <SectionLine text="当前仍需收口" />
        </div>
        <div className="alert-grid">
          {mismatchAlerts.map((item) => (
            <article key={item.title} className="alert-card panel-card is-card">
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="logic-section">
        <div className="section-head">
          <span className="guide-eyebrow">Branch Chains</span>
          <SectionLine text="只保留角色链与大纲链的最小传递骨架" />
        </div>
        <div className="branch-grid">
          {branchChains.map((chain) => (
            <article key={chain.title} className="branch-card panel-card is-card">
              <div className="branch-head">
                <strong>{chain.title}</strong>
                <p>{chain.summary}</p>
              </div>
              <div className="branch-rule-summary">
                <span>当前优选规则</span>
                <p>{chain.rule}</p>
              </div>
              <div className="branch-stage-list">
                {chain.stages.map((stage) => (
                  <div key={`${chain.title}-${stage.layer}`} className="branch-stage">
                    <div className="branch-stage-top">
                      <div className="branch-stage-title">
                        <span className="branch-layer">{stage.layer}</span>
                        <em className="chain-db-tag">{stage.source}</em>
                      </div>
                      <span className="branch-required-line">关键字段：{stage.required.join(' / ')}</span>
                    </div>
                    <div className="branch-stage-copy">
                      <p><strong>接收：</strong>{stage.input}</p>
                      <p><strong>负责：</strong>{stage.process}</p>
                      <p><strong>交出：</strong>{stage.output}</p>
                    </div>
                    <div className="branch-rule-ban">
                      <span>别做</span>
                      <p>{stage.forbidden}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="logic-section">
        <div className="section-head">
          <span className="guide-eyebrow">Current Focus</span>
          <SectionLine text="React 前端改造 / 生成链路校正" />
        </div>
        <div className="phase-grid">
          {currentTracks.map((item) => (
            <article key={item.track} className="phase-card panel-card is-card">
              <div className="phase-top">
                <div className="phase-top-main">
                  <span className="phase-tag">{item.track}</span>
                  <strong>{item.title}</strong>
                </div>
                <span className={`phase-status is-${item.statusTone}`}>{item.status}</span>
              </div>
              <p className="phase-goal">{item.goal}</p>
              <div className="phase-block">
                <span>施工逻辑</span>
                <p>{item.logic}</p>
              </div>
              <div className="phase-block">
                <span>已落地</span>
                <ul>
                  {item.done.map((entry) => <li key={entry}>{entry}</li>)}
                </ul>
              </div>
              <div className="phase-block">
                <span>下一步</span>
                <ul>
                  {item.todo.map((entry) => <li key={entry}>{entry}</li>)}
                </ul>
              </div>
              <div className="phase-block">
                <span>为什么继续往后做</span>
                <p>{item.nextGate}</p>
              </div>
              <div className="phase-block">
                <span>关联文件</span>
                <div className="field-list">
                  {item.files.map((file) => (
                    <span key={file} className="field-chip">{file}</span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="summary-banner">
        <div className="summary-copy">
          <span className="summary-kicker">一句话</span>
          <p>当前重点只有两件事：前端收口，链路校正。</p>
        </div>
        <div className="logic-links">
          <a href="/">返回创作台</a>
          <a href="/books">返回资料库</a>
        </div>
      </section>

      <style>{`
        .logic-hero { align-items: stretch; }
        .logic-note { max-width: 400px; }
        .logic-section,
        .summary-banner { margin-top: 20px; }

        .section-head {
          display: grid;
          gap: 10px;
        }

        .section-line {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--brand-deep);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .section-line::before,
        .section-line::after {
          content: '';
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, rgba(217, 168, 117, 0.06), rgba(217, 168, 117, 0.55), rgba(217, 168, 117, 0.06));
          border-radius: 999px;
        }

        .section-line span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 90%, transparent);
          white-space: nowrap;
        }

        .chain-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .alert-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .phase-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .storyline-board-card {
          margin-top: 18px;
          padding: 22px;
          display: grid;
          gap: 16px;
          min-height: 0;
        }

        .storyline-board-copy {
          display: grid;
          gap: 12px;
        }

        .storyline-board-copy strong {
          font-size: 24px;
          line-height: 1.18;
          color: var(--text);
        }

        .storyline-board-copy p {
          margin: 0;
          color: var(--muted);
          line-height: 1.68;
          font-size: 15px;
        }

        .storyline-board-shell {
          display: grid;
          gap: 10px;
          overflow-x: auto;
          padding: 14px;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 78%, transparent);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.55);
        }

        .storyline-board-head {
          min-width: 1412px;
          display: grid;
          gap: 8px;
        }

        .storyline-header-row,
        .storyline-current-guide {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 12px;
          align-items: stretch;
        }

        .storyline-header-side,
        .storyline-current-guide-spacer {
          padding: 10px 14px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 92%, transparent);
          display: grid;
          gap: 3px;
          align-content: center;
        }

        .storyline-header-side strong,
        .storyline-current-guide-spacer span {
          color: var(--brand-deep);
          font-size: 14px;
          font-weight: 800;
          line-height: 1.2;
          white-space: nowrap;
        }

        .storyline-header-side span {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .storyline-header-side.is-muted {
          background: color-mix(in srgb, var(--panel-strong) 82%, transparent);
        }

        .storyline-volume-overview,
        .storyline-stage-overview {
          min-width: 1180px;
          display: grid;
          grid-template-columns: repeat(12, minmax(70px, 1fr));
          gap: 8px;
        }

        .storyline-volume-overview {
          align-items: stretch;
        }

        .storyline-board-divider {
          min-width: 1412px;
          height: 1px;
          background: linear-gradient(90deg, rgba(214, 186, 156, 0.08), rgba(214, 186, 156, 0.92), rgba(214, 186, 156, 0.08));
        }

        .storyline-volume-band {
          min-height: 64px;
          padding: 10px 12px;
          border-radius: 12px;
          display: grid;
          gap: 4px;
          border: 1px solid var(--line);
        }

        .storyline-volume-band strong {
          font-size: 16px;
          line-height: 1.2;
          color: #43220f;
          white-space: nowrap;
        }

        .storyline-volume-band span {
          color: rgba(67, 43, 25, 0.72);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .storyline-volume-band.is-book {
          background: linear-gradient(135deg, rgba(246, 196, 205, 0.95), rgba(249, 218, 224, 0.92));
        }

        .storyline-volume-band.is-volume-1 {
          background: linear-gradient(135deg, rgba(251, 214, 183, 0.96), rgba(255, 236, 219, 0.94));
        }

        .storyline-volume-band.is-volume-2 {
          background: linear-gradient(135deg, rgba(247, 146, 151, 0.92), rgba(255, 210, 213, 0.92));
        }

        .storyline-volume-band.is-volume-3 {
          background: linear-gradient(135deg, rgba(201, 163, 33, 0.92), rgba(237, 218, 146, 0.9));
        }

        .storyline-stage-pill {
          min-height: 36px;
          padding: 0 8px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          border: 1px dashed rgba(182, 133, 80, 0.28);
          background: color-mix(in srgb, var(--panel-strong) 94%, transparent);
          color: var(--brand-deep);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .storyline-current-guide-track {
          position: relative;
          min-height: 34px;
        }

        .storyline-board-grid {
          min-width: 1412px;
          display: grid;
          gap: 8px;
        }

        .storyline-row {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 12px;
          align-items: stretch;
        }

        .storyline-row-meta {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 94%, transparent);
          display: grid;
          gap: 4px;
        }

        .storyline-row-meta strong {
          font-size: 17px;
          line-height: 1.18;
          color: var(--text);
          white-space: nowrap;
        }

        .storyline-row-meta p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .storyline-row-track {
          position: relative;
          display: grid;
          grid-template-columns: repeat(12, minmax(70px, 1fr));
          gap: 8px;
          padding: 2px 0;
          align-items: center;
          min-height: 56px;
          border-radius: 12px;
          background:
            repeating-linear-gradient(
              to right,
              rgba(214, 186, 156, 0.12) 0,
              rgba(214, 186, 156, 0.12) calc((100% - 88px) / 12),
              transparent calc((100% - 88px) / 12),
              transparent calc((100% - 88px) / 12 + 8px)
            ),
            linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,248,239,0.22));
        }

        .storyline-bar {
          position: relative;
          z-index: 1;
          min-height: 50px;
          margin: 2px 0;
          padding: 8px 12px;
          border-radius: 12px;
          display: grid;
          gap: 2px;
          align-content: center;
          border: 1px solid rgba(130, 98, 72, 0.22);
          box-shadow: 0 6px 12px rgba(47, 40, 30, 0.06);
          overflow: hidden;
        }

        .storyline-bar strong {
          font-size: 15px;
          line-height: 1.12;
          color: #2f1b0e;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .storyline-bar p,
        .storyline-bar span {
          margin: 0;
          font-size: 12px;
          line-height: 1.2;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .storyline-bar p {
          color: rgba(67, 43, 25, 0.88);
        }

        .storyline-bar span {
          width: fit-content;
          max-width: 100%;
          min-height: 20px;
          padding: 0 8px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          color: #5b4026;
          background: rgba(255,255,255,0.94);
          border: 1px solid rgba(108, 78, 52, 0.18);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
        }

        .storyline-bar.is-book {
          background: linear-gradient(135deg, rgba(248, 208, 216, 0.88), rgba(255, 227, 232, 0.86));
        }

        .storyline-bar.is-main {
          background: linear-gradient(135deg, rgba(204, 229, 184, 0.84), rgba(228, 243, 212, 0.84));
        }

        .storyline-bar.is-growth {
          background: linear-gradient(135deg, rgba(255, 243, 64, 0.82), rgba(255, 249, 166, 0.82));
        }

        .storyline-bar.is-relation {
          background: linear-gradient(135deg, rgba(191, 208, 242, 0.84), rgba(225, 234, 252, 0.84));
        }

        .storyline-bar.is-trial {
          background: linear-gradient(135deg, rgba(181, 134, 244, 0.8), rgba(226, 208, 255, 0.84));
        }

        .storyline-bar.is-hook {
          background: linear-gradient(135deg, rgba(169, 227, 223, 0.82), rgba(214, 245, 242, 0.82));
        }

        .storyline-bar.is-carry {
          background: linear-gradient(135deg, rgba(121, 195, 246, 0.82), rgba(204, 236, 255, 0.82));
        }

        .storyline-current-marker {
          position: absolute;
          inset: 0 auto auto 0;
          width: 0;
          z-index: 2;
          border-left: 2px dashed rgba(225, 79, 104, 0.85);
          pointer-events: none;
          height: 100%;
        }

        .storyline-current-marker span {
          position: absolute;
          top: -6px;
          left: 8px;
          min-height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          background: rgba(255, 240, 243, 0.96);
          color: #af3450;
          border: 1px solid rgba(225, 79, 104, 0.28);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .storyline-board-footer {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .branch-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .chain-card,
        .branch-card,
        .alert-card,
        .ledger-card,
        .layer-card,
        .phase-card {
          border-radius: var(--radius-panel-lg);
        }

        .chain-card {
          padding: 18px;
          display: grid;
          gap: 8px;
          min-height: 0;
        }

        .alert-card {
          padding: 18px;
          display: grid;
          gap: 8px;
          min-height: 0;
          background: color-mix(in srgb, var(--panel-card-bg) 88%, var(--status-warning-bg));
        }

        .phase-card {
          padding: 20px;
          display: grid;
          gap: 14px;
          align-content: start;
          min-width: 0;
          min-height: 0;
        }

        .branch-card {
          padding: 18px;
          display: grid;
          gap: 12px;
          align-content: start;
          min-height: 0;
        }

        .branch-head {
          display: grid;
          gap: 6px;
        }

        .branch-head p {
          margin: 0;
        }

        .branch-rule-summary {
          display: grid;
          gap: 6px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 94%, transparent);
        }

        .branch-rule-summary span {
          color: var(--brand);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .branch-rule-summary p {
          margin: 0;
        }

        .branch-stage-list {
          display: grid;
          gap: 10px;
        }

        .branch-stage {
          display: grid;
          gap: 6px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 92%, transparent);
        }

        .branch-stage-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .branch-stage-title {
          display: grid;
          gap: 6px;
        }

        .branch-layer {
          color: var(--brand);
          font-size: 15px;
          font-weight: 800;
        }

        .branch-required-line {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.45;
          white-space: nowrap;
        }

        .branch-stage-copy {
          display: grid;
          gap: 4px;
        }

        .branch-stage-copy p {
          margin: 0;
        }

        .branch-rule-ban span {
          color: var(--brand);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .branch-rule-ban {
          display: grid;
          gap: 4px;
          padding-top: 6px;
          margin-top: 2px;
          border-top: 1px dashed color-mix(in srgb, var(--line) 82%, transparent);
          background: color-mix(in srgb, var(--status-warning-bg) 64%, var(--panel-strong));
        }

        .chain-order {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 244, 232, 0.95);
          border: 1px solid rgba(214, 186, 156, 0.72);
          color: #7c4419;
          font-size: 12px;
          font-weight: 800;
        }

        .chain-card strong,
        .alert-card strong,
        .layer-card strong,
        .phase-card strong,
        .ledger-top strong {
          font-size: 22px;
          line-height: 1.2;
          color: var(--text);
        }

        .chain-db-tag,
        .ledger-table,
        .field-chip {
          width: fit-content;
          padding: 0 10px;
          min-height: 28px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          background: var(--brand-soft);
          color: var(--brand-deep);
          font-style: normal;
          font-size: 12px;
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .chain-output {
          color: var(--text) !important;
          font-weight: 700;
          font-size: 16px !important;
        }

        .chain-card p,
        .alert-card p,
        .layer-card p,
        .phase-card p,
        .ledger-main p,
        .ledger-cell p {
          margin: 0;
          color: var(--muted);
          line-height: 1.6;
          font-size: 14px;
        }

        .phase-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .phase-top-main {
          display: grid;
          gap: 10px;
        }

        .phase-tag,
        .phase-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 800;
          white-space: nowrap;
        }

        .phase-tag {
          width: fit-content;
          background: rgba(255, 244, 232, 0.95);
          color: #8a4a18;
          border: 1px solid rgba(214, 186, 156, 0.72);
        }

        .phase-status.is-done {
          background: rgba(59, 130, 246, 0.12);
          color: #1d4ed8;
          border: 1px solid rgba(59, 130, 246, 0.22);
        }

        .phase-status.is-muted {
          background: rgba(148, 163, 184, 0.16);
          color: #475569;
          border: 1px solid rgba(148, 163, 184, 0.34);
        }

        .phase-status.is-active {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
          border: 1px solid rgba(16, 185, 129, 0.28);
        }

        .phase-status.is-warm {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
          border: 1px solid rgba(245, 158, 11, 0.28);
        }

        .phase-goal {
          color: var(--text) !important;
          font-size: 16px !important;
          font-weight: 700;
        }

        .phase-block {
          display: grid;
          gap: 8px;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 92%, transparent);
          min-width: 0;
        }

        .phase-block > span {
          color: var(--brand);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .phase-block ul {
          margin: 0;
          padding-left: 18px;
          color: var(--muted);
          line-height: 1.6;
          font-size: 14px;
          min-width: 0;
        }

        .phase-block li,
        .phase-block .field-chip {
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .summary-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 20px 22px;
          border: 1px solid var(--line);
          border-radius: var(--radius-panel-lg);
          background: var(--panel-card-bg);
          box-shadow: var(--shadow);
        }

        .summary-kicker {
          color: var(--brand);
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .summary-copy {
          display: grid;
          gap: 6px;
        }

        .summary-copy p {
          margin: 0;
          color: var(--text);
          font-size: 22px;
          font-weight: 700;
          line-height: 1.4;
        }

        .logic-links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .logic-links a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--panel-strong) 96%, white);
          color: var(--text);
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
        }

        @media (max-width: 1280px) {
          .chain-grid,
          .branch-grid,
          .alert-grid,
          .phase-grid,
          .storyline-board-footer,
          .summary-banner {
            grid-template-columns: 1fr;
            display: grid;
          }
        }

        @media (max-width: 900px) {
          .section-line {
            gap: 10px;
            font-size: 15px;
          }

          .chain-card strong,
          .alert-card strong,
          .layer-card strong,
          .phase-card strong,
          .ledger-top strong {
            font-size: 24px;
          }

          .summary-copy p {
            font-size: 22px;
          }

          .storyline-row {
            grid-template-columns: 1fr;
          }

          .storyline-header-row,
          .storyline-current-guide {
            grid-template-columns: 1fr;
          }

          .storyline-current-guide-spacer {
            display: inline-flex;
            align-items: center;
          }

          .storyline-board-card {
            padding: 18px;
          }

          .branch-required-line {
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}
