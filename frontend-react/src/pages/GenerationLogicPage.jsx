import '../styles.css';
import '../app-shell.css';

const conceptChain = [
  {
    order: '01',
    label: '全书规划',
    db: 'book_plans',
    output: '产出全书主线、世界规则、核心冲突、分卷草案',
    note: '这一层只定整本书的大方向，不直接决定某一章写什么。'
  },
  {
    order: '02',
    label: '分卷规划',
    db: 'volume_plans',
    output: '产出本卷阶段目标、卷级冲突、卷末结果、激活线池',
    note: '这一层只把长线拆成阶段任务，不直接决定单章结尾钩子。'
  },
  {
    order: '03',
    label: '剧情线规划',
    db: 'storylines',
    output: '产出当前活跃线、推进状态、下一步和优先级',
    note: '这一层决定“当前该推进哪条线”，是章节决策前的中间层。'
  },
  {
    order: '04',
    label: '章节目标',
    db: 'chapter_plans',
    output: '产出本章任务、情绪目标、关联剧情线、出场角色',
    note: '这一层回答“这一章到底推进什么”，还不是正文执行蓝图。'
  },
  {
    order: '05',
    label: '章节细纲',
    db: 'chapter_plans',
    output: '产出场景拆解、冲突推进、结尾钩子、结构化细纲',
    note: '这一层回答“这一章具体怎么写出来”，是正文前最后一层。'
  },
  {
    order: '06',
    label: '正文生成',
    db: 'chapters',
    output: '产出正文、字数、章节状态',
    note: '这一层只负责把上游已确定的目标和细纲执行成正文。'
  },
  {
    order: '07',
    label: '生成反馈',
    db: 'chapter_plans / storylines',
    output: '产出推进反馈、状态回写、下一章焦点',
    note: '这一层把结果重新翻译回结构化推进状态，形成真正闭环。'
  },
  {
    order: '08',
    label: '校改收口',
    db: 'chapters / structured_content',
    output: '产出局部修改、人工保留结果、最终稿',
    note: '这一层做局部精修，不重做上游规划。'
  }
];

const mismatchAlerts = [
  {
    title: '当前第一卡点：章节规划层还没彻底拆清目标层和执行层',
    detail: '主链已经能从章节任务表一路推进到正文和反馈，但 chapter_plans 里还同时挂着“本章推进什么”和“本章具体怎么写”，这会持续影响第三步生成控制与第二步章节计划的边界。'
  },
  {
    title: '当前第二卡点：剧情线回写已接通，但 storylines 还没变成稳定中枢',
    detail: '章节反馈已经能把进度推回剧情线，也能带动 active 状态推进；但 storylines 现在仍同时承担主链中枢和兼容容器两种角色，P2 还要继续压缩职责。'
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

const phaseRoadmap = [
  {
    phase: 'P0',
    title: '验收收口',
    status: '已完成',
    statusTone: 'done',
    logic: '先验主链。先确认“章节计划 -> 正文生成 -> feedback 回写”这条最小闭环能稳定反复跑，再谈扩功能和结构升级。',
    goal: 'P0 已按 3 轮收口：第一轮验主链，第二轮统一解析与保存闭环，第三轮完成真实前端回归。',
    done: [
      '第 1 轮硬验收已完成：以《破雾修真录》第 8 章真实跑通了“章节计划 -> 正文生成 -> chapter_feedback 回写”。',
      '数据库已确认 chapter_feedback 会刷新 updated_at，说明 feedback 不是只在前端假显示，而是真的写回了 chapter_plans。',
      '同章 upsert 保存接口已回测通过，现有章节内容可正常写回，不会因为新主链接入而失去保存能力。',
      '第 2 轮已落地：workbenchApi 先统一标准化 chapter_plan，页面不再一边吃字符串、一边吃对象。',
      '第 2 轮已落地：生成后保存和校改后保存已收成同一条闭环，减少两套近似流程继续漂移。',
      '第 3 轮已完成真实前端回归：`/workbench` 上重新生成后，正文、feedback 和 chapter_plan 会同步刷新。',
      '第 3 轮已完成真实前端回归：打开校改弹窗后直接保存，feedback 也会再次刷新并写回；回归样本已恢复原始数据。',
      'React 构建、前后端启动链路都已经验证可用。'
    ],
    todo: [
      'P0 不再挂新问题；剩余历史 prompt 乱码、演示脏数据和重复快照转入后续阶段继续清理。'
    ],
    nextGate: 'P0 结束后，后面不该再重复讨论“主链到底通没通”，而是直接进入入口收口和结构正式化。',
    files: [
      'backend/routes/ai.js',
      'backend/routes/data.js',
      'frontend-react/src/workbenchApi.js',
      'frontend-react/src/App.jsx',
      'backend/services/deepseek.js'
    ]
  },
  {
    phase: 'P1',
    title: '主链扩展收口',
    status: '已完成',
    statusTone: 'done',
    logic: '再收入口。主链能跑之后，下一步不是继续堆样例，而是把前端入口、演示书、批量生成和说明口径全部拉回同一条新主链。',
    goal: 'P1 已按 3 轮收口：第一轮收前端入口，第二轮收演示样例与批量路径，第三轮收页面和台账口径。',
    done: [
      '第 1 轮入口收口已基本完成：结构化章节任务表已经接进 React 创作主链，chapter_plans 也已成为章节规划主对象。',
      '第 1 轮入口收口已基本完成：generation-logic 页面已经能把章节目标层、章节细纲层、反馈层拆开讲清楚。',
      '第 2 轮样例 / 批量收口已完成：批量生成今天已重新复验，1-4 章走 outline_text 兼容输入，第 5 章走 stored_structured_outline 新主链输入，结果全部通过。',
      '第 2 轮样例 / 批量收口已完成：这轮批量复验里，5 个样本章节的字数波动都压在 10% 以内。',
      '第 2 轮样例 / 批量收口已完成：`/workbench` 主入口、批量验收脚本和 chapter_plans 的读写口径已回到同一条链路。',
      '第 3 轮说明收口已完成：已把“批量链路已验真”和“演示书仍含种子正文样板”这两件事拆开表述，不再用一句“演示链路已收口”混写。',
      '第 3 轮说明收口已完成：《破雾修真录》当前可确认的是 1-8 章任务表连续挂在同一主线下；但其中前段章节仍有短正文种子，不能假装它们都已经是完整长正文样板。'
    ],
    todo: [
      'P1 不再挂新问题；如果后面继续补演示章节或替换短正文种子，按新增施工单独记录，不回头虚增 P1 完成度。'
    ],
    nextGate: 'P1 结束后，后面不该再反复确认“主入口到底是不是新链路”或“批量验收是不是只写在页面上”；这些口径已经验真，下一步直接进入 P2 结构正式化。',
    files: [
      'frontend-react/src/App.jsx',
      'frontend-react/src/pages/GenerationLogicPage.jsx',
      'backend/verify-batch-generation.js',
      'docs/task-board.md'
    ]
  },
  {
    phase: 'P2',
    title: '结构正式化',
    status: '进行中',
    statusTone: 'active',
    logic: '最后正结构。等主链和入口都稳了，再继续压缩旧表职责、拆清层级边界，把反馈和剧情线回写做成长期可维护的正式结构。',
    goal: '继续把概念层和工程层对齐，让前几层不再只是摆在图上，而是真正落到表结构、路由职责和反馈闭环里。',
    done: [
      '前端章节准备区已优先读取 volume_plans。',
      '旧 volume-settings 路由已经开始内部转向 VolumePlanService。',
      '章节目标包 / 细纲包的保存口径已经分开。',
      'React 全书规划读取与保存已经切到 book_plans 优先，旧 outline 与角色摘要只做兜底。',
      '章节反馈已能同步写入 storylines.structured_content.chapter_progress，并推动剧情线进入 active。',
      '已用《破雾修真录》第 1 章验证：剧情线状态可自动推进为 active。'
    ],
    todo: [
      '继续压缩 novel_outlines / volume_settings 的主链职责，把它们稳定降为兼容层。',
      '把剧情线进度回写从“已能推进 active”继续做成前端可见联动，而不是只停在库里。',
      '继续推进 chapter_feedback 独立化，避免反馈层长期挂在 structured_content 上。',
      '准备旧静态入口退场条件，但暂不急着硬下线。'
    ],
    nextGate: '这一层完成后，后续再接大模型主判或更细的自动化链路，底层结构才不会继续摇摆。',
    files: [
      'backend/routes/storylines.js',
      'backend/services/database.js',
      'frontend-react/src/workbenchApi.js',
      'docs/implementation-roadmap.md'
    ]
  }
];

function SectionLine({ text }) {
  return (
    <div className="section-line" aria-hidden="true">
      <span>{text}</span>
    </div>
  );
}

export default function GenerationLogicPage() {
  return (
    <div className="page-shell">
      <header className="hero-section logic-hero">
        <div>
          <span className="hero-eyebrow">Generation Logic</span>
          <h1>生成逻辑与结构归属图</h1>
          <p>这页把概念主链、工程主表、真实路由和前端入口放在一张图里，先把认知地图画准。</p>
        </div>
        <div className="hero-note-card logic-note">
          <strong>当前重点</strong>
          <p>当前施工顺序不是“想到哪修哪”，而是先验主链，再收入口，最后正结构。</p>
        </div>
      </header>

      <section className="logic-section">
        <div className="section-head">
          <span className="guide-eyebrow">Concept Chain</span>
          <SectionLine text="严格递进主链" />
        </div>
        <div className="chain-grid">
          {conceptChain.map((item) => (
            <article key={item.order} className="chain-card">
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
            <article key={item.title} className="alert-card">
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="logic-section">
        <div className="section-head">
          <span className="guide-eyebrow">Branch Chains</span>
          <SectionLine text="先梳理角色链与大纲链" />
        </div>
        <div className="branch-grid">
          {branchChains.map((chain) => (
            <article key={chain.title} className="branch-card">
              <div className="branch-head">
                <strong>{chain.title}</strong>
                <p>{chain.summary}</p>
              </div>
              <div className="branch-stage-list">
                {chain.stages.map((stage) => (
                  <div key={`${chain.title}-${stage.layer}`} className="branch-stage">
                    <div className="branch-stage-top">
                      <span className="branch-layer">{stage.layer}</span>
                      <em className="chain-db-tag">{stage.source}</em>
                    </div>
                    <p><strong>输入：</strong>{stage.input}</p>
                    <p><strong>本层职责：</strong>{stage.process}</p>
                    <p><strong>向下输出：</strong>{stage.output}</p>
                    <div className="branch-rule-grid">
                      <div className="branch-rule-box">
                        <span>必传字段</span>
                        <p>{stage.required.join(' / ')}</p>
                      </div>
                      <div className="branch-rule-box">
                        <span>参考字段</span>
                        <p>{stage.optional.join(' / ')}</p>
                      </div>
                    </div>
                    <div className="branch-rule-ban">
                      <span>禁止跳层</span>
                      <p>{stage.forbidden}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="phase-block">
                <span>当前优选传输规则</span>
                <p>{chain.rule}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="logic-section">
        <div className="section-head">
          <span className="guide-eyebrow">Roadmap Sync</span>
          <SectionLine text="P0 / P1 / P2 施工看板" />
        </div>
        <div className="phase-grid">
          {phaseRoadmap.map((item) => (
            <article key={item.phase} className="phase-card">
              <div className="phase-top">
                <div className="phase-top-main">
                  <span className="phase-tag">{item.phase}</span>
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
          <p>当前施工逻辑就是三句话：先验主链，再收入口，最后正结构。</p>
        </div>
        <div className="logic-links">
          <a href="/">返回创作台</a>
          <a href="/start-guide">返回启动引导</a>
        </div>
      </section>

      <style>{`
        .logic-hero { align-items: stretch; }
        .logic-note { max-width: 440px; }
        .logic-section,
        .summary-banner { margin-top: 24px; }

        .section-head {
          display: grid;
          gap: 10px;
        }

        .section-line {
          display: flex;
          align-items: center;
          gap: 14px;
          color: #b46d2b;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .section-line::before,
        .section-line::after {
          content: '';
          height: 2px;
          flex: 1;
          background: linear-gradient(90deg, rgba(217, 168, 117, 0.08), rgba(217, 168, 117, 0.95), rgba(217, 168, 117, 0.08));
          border-radius: 999px;
        }

        .section-line span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid rgba(217, 168, 117, 0.45);
          background: rgba(255, 249, 242, 0.96);
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
          grid-template-columns: repeat(auto-fit, minmax(300px, 348px));
          justify-content: center;
          gap: 14px;
          margin-top: 18px;
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
          border: 1px solid var(--line);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 14px 30px rgba(145, 88, 32, 0.06);
        }

        .chain-card {
          padding: 16px;
          display: grid;
          gap: 8px;
          min-height: 220px;
        }

        .alert-card {
          padding: 18px;
          display: grid;
          gap: 10px;
          background: rgba(255, 248, 239, 0.96);
        }

        .phase-card {
          padding: 20px;
          display: grid;
          gap: 14px;
          align-content: start;
          min-width: 0;
        }

        .branch-card {
          padding: 20px;
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .branch-head {
          display: grid;
          gap: 8px;
        }

        .branch-stage-list {
          display: grid;
          gap: 12px;
        }

        .branch-stage {
          display: grid;
          gap: 8px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid rgba(214, 186, 156, 0.72);
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,249,242,0.95));
        }

        .branch-stage-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .branch-layer {
          color: var(--brand);
          font-size: 18px;
          font-weight: 800;
        }

        .branch-rule-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 4px;
        }

        .branch-rule-box,
        .branch-rule-ban {
          display: grid;
          gap: 6px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 252, 247, 0.9);
          border: 1px solid rgba(214, 186, 156, 0.58);
        }

        .branch-rule-box span,
        .branch-rule-ban span {
          color: var(--brand);
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .branch-rule-ban {
          background: rgba(255, 245, 238, 0.92);
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
          font-size: 28px;
          line-height: 1.18;
          color: var(--text);
        }

        .chain-db-tag,
        .ledger-table,
        .field-chip {
          width: fit-content;
          padding: 0 12px;
          min-height: 30px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          background: rgba(255, 244, 232, 0.95);
          color: #8a4a18;
          font-style: normal;
          font-size: 17px;
          font-weight: 700;
          font-family: "SF Mono", "Fira Code", monospace;
        }

        .chain-output {
          color: var(--text) !important;
          font-weight: 700;
          font-size: 18px !important;
        }

        .chain-card p,
        .alert-card p,
        .layer-card p,
        .phase-card p,
        .ledger-main p,
        .ledger-cell p {
          margin: 0;
          color: var(--muted);
          line-height: 1.65;
          font-size: 17px;
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
          font-size: 18px !important;
          font-weight: 700;
        }

        .phase-block {
          display: grid;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid rgba(214, 186, 156, 0.72);
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,249,242,0.95));
          min-width: 0;
        }

        .phase-block > span {
          color: var(--brand);
          font-size: 17px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .phase-block ul {
          margin: 0;
          padding-left: 18px;
          color: var(--muted);
          line-height: 1.65;
          font-size: 17px;
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
          border-radius: 20px;
          background: rgba(255, 250, 243, 0.92);
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
          font-size: 27px;
          font-weight: 700;
          line-height: 1.45;
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
          min-height: 40px;
          padding: 0 15px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--text);
          text-decoration: none;
          font-weight: 600;
        }

        @media (max-width: 1280px) {
          .chain-grid,
          .branch-grid,
          .alert-grid,
          .phase-grid,
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

          .branch-rule-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
