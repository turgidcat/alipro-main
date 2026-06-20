import { Button } from '../../ui/button.jsx';
import { Separator } from '../../ui/separator.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs.jsx';
import WorkbenchSection from './WorkbenchSection.jsx';
import MetaCode from './MetaCode.jsx';

const chapterItems = [
  { id: 1, code: 'CH.01', title: '雾港来信', status: '已定稿' },
  { id: 2, code: 'CH.02', title: '潮声前夜', status: '已细化' },
  { id: 3, code: 'CH.03', title: '潮声里的名字', status: '写作中', active: true },
  { id: 4, code: 'CH.04', title: '潮汐之门', status: '待准备' },
  { id: 5, code: 'CH.05', title: '灯塔熄灭后', status: '待准备' }
];

const storylineItems = [
  { code: 'MAIN', title: '旧神苏醒线', summary: '第三章需要第一次明确听见“名字”与潮声绑定。' },
  { code: 'SIDE', title: '灯塔调查线', summary: '通过渔民口供把港口地图和灯塔禁区串起来。' }
];

const castItems = [
  { code: 'LI', title: '黎曜', summary: '本章视角角色。核心任务是听见名字后不立刻失控。' },
  { code: 'QIN', title: '秦舟', summary: '负责把“理性调查”留在场内，限制世界观泄露速度。' },
  { code: 'XU', title: '许槐', summary: '只露出一个信号，不解释全部身份。' }
];

const feedbackItems = [
  '开场声场已经稳定，但第二段“潮声”意象和第一段略重复，可以压缩一句。',
  '黎曜第一次听见名字时，建议多留半拍身体反应，再进入主观判断。',
  '结尾的灯塔线索足够强，可以把“门轴发热”的描写提前一小段。'
];

const roleExecution = [
  { title: '黎曜', value: '情绪曲线稳定上升', note: '先压住，再失衡。' },
  { title: '秦舟', value: '旁证功能达标', note: '保留冷静观察位。' },
  { title: '许槐', value: '信息量偏多', note: '删一条解释性台词。' }
];

const contextClues = [
  '码头广播在 03:17 出现无编号杂音。',
  '旧姓氏“岑”第一次出现在渔船登记簿边角。',
  '港务局的封存名单里缺了一页。'
];

const nextPrep = [
  '下一章需要把灯塔室内空间建立清楚。',
  '补一段港口潮汐时间表，作为行动限制。',
  '准备黎曜对“名字来源”的错误判断版本。'
];

const proseParagraphs = [
  '潮声是从木墙缝里先渗进来的，像一截被盐浸透的旧布，缓慢地擦过每一根神经。黎曜伏在窗边时，外港的雾还没有完全散开，灯塔只剩一个模糊的亮点，像有人把火苗按在玻璃背后。',
  '他本来只是想确认那封信是不是又被谁动过，可指尖刚碰到封口，耳边忽然有人很轻地叫了他的名字。不是码头上的吆喝，也不是楼下酒馆里常见的那种醉后胡言，而是贴着耳骨、像从水底翻上来的一个音节。',
  '那一瞬间，窗台上的铜钉同时发出细小的颤鸣。秦舟在桌边抬起头，像是察觉了什么，却只看见黎曜把手压在信上，肩线绷得很直，仿佛再迟半秒，屋里就会有别的东西顺着潮气一起进来。'
];

function NavigationList({ items }) {
  return (
    <div className="grid gap-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={[
            'appearance-none border-0 bg-transparent grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-l px-3 py-2.5 text-left transition',
            item.active
              ? 'border-[color:var(--brand)] bg-[color:color-mix(in_srgb,var(--brand-soft)_38%,var(--surface))]'
              : 'border-[color:transparent] hover:border-[color:var(--line-strong)] hover:bg-[color:color-mix(in_srgb,var(--muted-bg)_82%,var(--surface))]'
          ].join(' ')}
        >
          <MetaCode className="col-start-1 row-start-1 text-[9px]">{item.code}</MetaCode>
          <span className="col-start-2 row-span-2 row-start-1 self-center text-[11px] leading-5 text-[color:var(--muted)]">
            {item.status}
          </span>
          <span className="col-start-1 row-start-2 min-w-0 text-[13px] leading-6 text-[color:var(--text)]">
            {item.title}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function WorkbenchRedesignLab() {
  return (
    <main className="h-[calc(100vh-4rem)] bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="h-full p-3">
        <div className="grid h-full grid-rows-[54px_minmax(0,1fr)] overflow-hidden border border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--surface)_94%,white)]">
          <section className="flex items-center justify-between gap-4 border-b border-[color:color-mix(in_srgb,var(--line)_78%,transparent)] px-4">
            <div className="grid gap-0.5">
              <MetaCode>WORKBENCH REDESIGN LAB</MetaCode>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-[color:var(--muted)]">
                <span className="font-serif text-[15px] font-semibold text-[color:var(--text)]">《雾港旧神》</span>
                <span>/</span>
                <span>第三章</span>
                <span>/</span>
                <span className="text-[color:var(--brand-deep)]">正文优先</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 appearance-none rounded-[7px] border border-transparent px-2.5 text-[12px] shadow-none">
                只读样板
              </Button>
              <Button variant="secondary" size="sm" className="h-7 appearance-none rounded-[7px] border border-border bg-muted px-2.5 text-[12px] text-[color:var(--brand-deep)] shadow-none hover:bg-[color:color-mix(in_srgb,var(--brand-soft)_34%,var(--surface))]">
                中栏优先
              </Button>
            </div>
          </section>

          <div className="min-h-0 overflow-x-auto">
            <div className="grid h-full min-w-[1240px] grid-cols-[280px_minmax(0,1fr)_340px]">
              <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)] overflow-y-auto border-r border-[color:color-mix(in_srgb,var(--line)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--muted-bg)_72%,var(--surface))] px-3 py-4">
                <WorkbenchSection
                  code="PROJECT"
                  title="《雾港旧神》"
                  description="卷一 · 港口回声"
                  actions={<Button variant="ghost" size="sm" className="h-7 appearance-none rounded-[7px] border border-transparent px-2 text-[12px] shadow-none">切换</Button>}
                >
                  <div className="grid gap-2 text-[13px] leading-6 text-[color:var(--muted)]">
                    <div className="flex items-center justify-between gap-3">
                      <span>当前分卷</span>
                      <span className="text-[color:var(--text)]">卷一 / 港口回声</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>章节进度</span>
                      <span className="text-[color:var(--text)]">03 / 18</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>主线状态</span>
                      <span className="text-[color:var(--brand-deep)]">持续推进</span>
                    </div>
                  </div>
                </WorkbenchSection>

                <WorkbenchSection code="CHAPTER TREE" title="章节树">
                  <NavigationList items={chapterItems} />
                </WorkbenchSection>

                <WorkbenchSection code="STORYLINE" title="剧情线入口">
                  <div className="grid gap-3">
                    {storylineItems.map((item) => (
                      <div key={item.code} className="grid gap-1.5 border-b border-[color:color-mix(in_srgb,var(--line)_54%,transparent)] pb-3 last:border-b-0 last:pb-0">
                        <MetaCode className="text-[9px]">{item.code}</MetaCode>
                        <strong className="text-[14px] leading-6 text-[color:var(--text)]">{item.title}</strong>
                        <p className="text-[12px] leading-5 text-[color:var(--muted)]">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                </WorkbenchSection>

                <WorkbenchSection code="CAST" title="角色入口">
                  <div className="grid gap-3">
                    {castItems.map((item) => (
                      <div key={item.code} className="grid gap-1.5 border-b border-[color:color-mix(in_srgb,var(--line)_54%,transparent)] pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-[14px] leading-6 text-[color:var(--text)]">{item.title}</strong>
                          <MetaCode className="text-[9px]">{item.code}</MetaCode>
                        </div>
                        <p className="text-[12px] leading-5 text-[color:var(--muted)]">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                </WorkbenchSection>
              </aside>

              <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-[color:color-mix(in_srgb,var(--surface)_98%,white)]">
                <div className="grid gap-3 border-b border-[color:color-mix(in_srgb,var(--line)_78%,transparent)] px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="grid gap-2">
                      <MetaCode>CH.03 · DRAFT VIEW</MetaCode>
                      <h2 className="font-serif text-[1.5rem] font-semibold tracking-[-0.03em] text-[color:var(--text)]">
                        第三章 · 潮声里的名字
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[color:var(--muted)]">
                        <span>目标字数 3200</span>
                        <span>主线：旧神苏醒线</span>
                        <span>视角：黎曜</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 appearance-none rounded-[7px] border border-transparent px-2.5 text-[12px] shadow-none">章节任务</Button>
                      <Button variant="outline" size="sm" className="h-7 appearance-none rounded-[7px] border border-border bg-surface px-2.5 text-[12px] shadow-none">细纲</Button>
                      <Button size="sm" className="h-7 appearance-none rounded-[7px] border border-transparent px-2.5 text-[12px] shadow-none">正文</Button>
                    </div>
                  </div>
                  <Tabs defaultValue="prose" className="w-full">
                    <TabsList className="h-9 rounded-[10px] border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--muted-bg)_72%,var(--surface))]">
                      <TabsTrigger value="task" className="min-w-0 appearance-none border-0 px-3 text-[12px] shadow-none data-[state=active]:bg-[color:color-mix(in_srgb,var(--brand-soft)_38%,var(--surface))] data-[state=active]:text-primary">任务</TabsTrigger>
                      <TabsTrigger value="outline" className="min-w-0 appearance-none border-0 px-3 text-[12px] shadow-none data-[state=active]:bg-[color:color-mix(in_srgb,var(--brand-soft)_38%,var(--surface))] data-[state=active]:text-primary">细纲</TabsTrigger>
                      <TabsTrigger value="prose" className="min-w-0 appearance-none border-0 px-3 text-[12px] shadow-none data-[state=active]:bg-[color:color-mix(in_srgb,var(--brand-soft)_38%,var(--surface))] data-[state=active]:text-primary">正文</TabsTrigger>
                      <TabsTrigger value="feedback" className="min-w-0 appearance-none border-0 px-3 text-[12px] shadow-none data-[state=active]:bg-[color:color-mix(in_srgb,var(--brand-soft)_38%,var(--surface))] data-[state=active]:text-primary">反馈</TabsTrigger>
                    </TabsList>
                    <TabsContent value="task" className="hidden" />
                    <TabsContent value="outline" className="hidden" />
                    <TabsContent value="feedback" className="hidden" />
                    <TabsContent value="prose" className="hidden" />
                  </Tabs>
                </div>

                <div className="min-h-0 overflow-y-auto px-10 py-8">
                  <article className="mx-auto w-full max-w-[820px]">
                    <div className="mb-7 grid gap-3">
                      <p className="[font-family:var(--font-serif)] text-[17px] leading-[1.9] text-[color:var(--muted)]">
                        正文区直接铺在暖白背景上，只保留克制的章节元信息和少量工具，让阅读与写作成为第一视觉层。
                      </p>
                      <Separator className="bg-[color:color-mix(in_srgb,var(--line)_70%,transparent)]" />
                    </div>

                    <div className="grid gap-6">
                      {proseParagraphs.map((paragraph, index) => (
                        <p
                          key={index}
                          className="[font-family:var(--font-serif)] text-[17px] leading-[2.05] text-[color:var(--text)]"
                          style={{ textIndent: '2em' }}
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </article>
                </div>
              </section>

              <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)] overflow-y-auto border-l border-[color:color-mix(in_srgb,var(--line)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--muted-bg)_66%,var(--surface))] px-3 py-4">
                <div className="grid gap-4">
                  <div className="grid gap-1 px-1">
                    <MetaCode>INSPECTOR</MetaCode>
                    <p className="text-[12px] leading-5 text-[color:var(--muted)]">反馈、角色执行与下一章准备材料</p>
                  </div>

                  <WorkbenchSection code="FEEDBACK" title="章节反馈">
                    <div className="grid gap-3">
                      {feedbackItems.map((item, index) => (
                        <div key={index} className="grid gap-1.5 pb-2">
                          <MetaCode className="text-[9px]">{`NOTE 0${index + 1}`}</MetaCode>
                          <p className="text-[13px] leading-6 text-[color:var(--text)]">{item}</p>
                        </div>
                      ))}
                    </div>
                  </WorkbenchSection>

                  <WorkbenchSection code="ROLE EXECUTION" title="角色执行">
                    <div className="grid gap-3">
                      {roleExecution.map((item) => (
                        <div key={item.title} className="grid gap-1.5 border-b border-[color:color-mix(in_srgb,var(--line)_54%,transparent)] pb-2.5 last:border-b-0 last:pb-0">
                          <div className="grid gap-0.5">
                            <div className="flex items-center justify-between gap-3">
                              <strong className="text-[13px] leading-5 text-[color:var(--text)]">{item.title}</strong>
                              <span className="text-[11px] text-[color:var(--brand-deep)]">{item.value}</span>
                            </div>
                            <p className="text-[12px] leading-5 text-[color:var(--muted)]">{item.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </WorkbenchSection>

                <WorkbenchSection code="CONTEXT" title="上下文线索">
                  <ul className="grid gap-2 text-[13px] leading-6 text-[color:var(--text)]">
                    {contextClues.map((item) => (
                      <li key={item} className="border-b border-[color:color-mix(in_srgb,var(--line)_60%,transparent)] pb-2 last:border-b-0 last:pb-0">
                        {item}
                      </li>
                    ))}
                  </ul>
                </WorkbenchSection>

                <WorkbenchSection
                  code="NEXT CHAPTER"
                  title="下一章准备材料"
                  actions={<Button variant="outline" size="sm" className="h-7 appearance-none rounded-[7px] border border-border bg-surface px-2.5 text-[12px] shadow-none">准备清单</Button>}
                >
                  <ul className="grid gap-2 text-[13px] leading-6 text-[color:var(--text)]">
                    {nextPrep.map((item) => (
                      <li key={item} className="border-b border-[color:color-mix(in_srgb,var(--line)_60%,transparent)] pb-2 last:border-b-0 last:pb-0">
                        {item}
                      </li>
                    ))}
                  </ul>
                </WorkbenchSection>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
