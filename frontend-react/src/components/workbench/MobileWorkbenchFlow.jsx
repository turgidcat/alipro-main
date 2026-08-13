import { formatChapterLabel } from '../../lib/chapterName.js';

function getStep({ hasOutline, hasContent, isGenerating, needsReview }) {
  if (isGenerating) return 2;
  if (!hasOutline) return 1;
  if (!hasContent) return 2;
  if (needsReview) return 3;
  return 4;
}

export default function MobileWorkbenchFlow({
  chapterNumber,
  chapterName,
  bookTitle,
  selectedBookId,
  bookSelectItems = [],
  onSelectBook,
  generationChecklistItems = [],
  chapterCharacterCount = 0,
  generationState,
  canGenerate,
  isGenerating,
  loadingChapter,
  onOpenOutlineModal,
  onOpenStorylinePicker,
  onGenerateChapter,
  onStopGeneration,
  onOpenReader,
  onOpenRevisionEditor,
  onOpenVersionHistory,
  onSetPromptPreview,
  onOpenCharacterModal,
  onPrevChapter,
  onNextChapter
}) {
  const hasContent = Boolean(generationState?.hasContent || String(generationState?.content || '').trim());
  const hasOutline = Boolean(generationChecklistItems.find((item) => item.key === 'outline')?.done);
  const hasStoryline = Boolean(generationChecklistItems.find((item) => item.key === 'storyline')?.done);
  const needsReview = String(generationState?.statusKind || '').toLowerCase() === 'warning';
  const currentStep = getStep({ hasOutline, hasContent, isGenerating, needsReview });
  const chapterTitle = formatChapterLabel(chapterNumber, chapterName);
  const chapterResources = [
    {
      key: 'outline',
      marker: '纲',
      label: '章节细纲',
      detail: hasOutline ? '已保存，点击可继续调整' : '本章剧情摘要，生成前必填',
      status: hasOutline ? '已就绪' : '必填',
      done: hasOutline,
      onClick: onOpenOutlineModal
    },
    {
      key: 'characters',
      marker: '角',
      label: '出场角色',
      detail: chapterCharacterCount > 0 ? `本章已安排 ${chapterCharacterCount} 位角色` : '安排本章人物与当前状态',
      status: chapterCharacterCount > 0 ? `${chapterCharacterCount} 人` : '按需',
      done: chapterCharacterCount > 0,
      onClick: onOpenCharacterModal
    },
    {
      key: 'storyline',
      marker: '线',
      label: '叙事脉络',
      detail: hasStoryline ? '已挂载主支线承接关系' : '衔接前后章节，建议挂载',
      status: hasStoryline ? '已挂载' : '推荐',
      done: hasStoryline,
      onClick: onOpenStorylinePicker
    },
    {
      key: 'prompt',
      marker: '阅',
      label: '生成依据',
      detail: '预览模型将读取的本章资料',
      status: '查看',
      done: false,
      onClick: onSetPromptPreview
    }
  ];

  let action = {
    eyebrow: '开始前先准备',
    title: '补齐本章细纲',
    text: '先把这一章要发生什么写清楚，正文生成才有可靠依据。',
    label: '完善细纲',
    onClick: onOpenOutlineModal,
    tone: 'warning'
  };

  if (loadingChapter) {
    action = { eyebrow: '正在读取', title: '整理本章资料', text: '正在确认细纲、正文和审校状态。', label: '', onClick: null, tone: 'info' };
  } else if (isGenerating) {
    action = { eyebrow: '正文生成中', title: '先留在这里', text: '生成完成后会自动保存，并刷新审校状态。', label: '停止生成', onClick: onStopGeneration, tone: 'info' };
  } else if (!hasContent && canGenerate) {
    action = {
      eyebrow: hasStoryline ? '生成简报已就绪' : '可以生成了',
      title: '生成本章正文',
      text: hasStoryline ? '章节细纲和叙事脉络都已就位。' : '章节细纲已保存，可以直接开始生成。',
      label: '生成正文',
      onClick: onGenerateChapter,
      tone: 'ready'
    };
  }

  const steps = [
    ['准备', 1],
    ['生成', 2],
    ['审校', 3],
    ['下一章', 4]
  ];

  return (
    <section className="mobile-workbench-flow" aria-label="移动端创作流程">
      <header className="mobile-flow-book-head">
        <div>
          <span>创作台</span>
          <h1>{chapterTitle}</h1>
        </div>
        <div className="mobile-flow-chapter-actions">
          <button type="button" onClick={onPrevChapter} disabled={chapterNumber <= 1} aria-label="上一章">‹</button>
          <button type="button" onClick={onNextChapter} aria-label="下一章">›</button>
        </div>
      </header>

      <div className="mobile-flow-book-switcher">
        <div>
          <span>当前作品</span>
          <strong>{bookTitle || '未选择作品'}</strong>
        </div>
        <select
          value={selectedBookId || ''}
          onChange={(event) => onSelectBook?.(event.target.value)}
          aria-label="切换作品"
        >
          {bookSelectItems.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      <div className="mobile-flow-stepper" aria-label={`当前第 ${currentStep} 步，共 4 步`}>
        {steps.map(([label, number], index) => (
          <div className={`mobile-flow-step${number < currentStep ? ' is-done' : ''}${number === currentStep ? ' is-current' : ''}`} key={label}>
            <span>{number < currentStep ? '✓' : number}</span>
            <strong>{label}</strong>
            {index < steps.length - 1 ? <i aria-hidden="true" /> : null}
          </div>
        ))}
      </div>

      {hasContent ? (
        <article className={`mobile-flow-content-card mobile-flow-content-card-primary${needsReview ? ' is-warning' : ''}`}>
          <div className="mobile-flow-content-kicker">
            <span>{needsReview ? '建议先复核' : '本章已完成'}</span>
            <em>{generationState?.wordCountLabel || '正文已保存'}</em>
          </div>
          <h2>{needsReview ? '校改本章正文' : '进入正文阅读'}</h2>
          <p>{needsReview ? (generationState?.statusTitle || '正文已保存，建议校改后再继续。') : '正文已保存，可以直接阅读或继续完善。'}</p>
          <div className="mobile-flow-content-actions">
            {needsReview ? (
              <>
                <button type="button" className="is-primary" onClick={onOpenRevisionEditor}>校改正文</button>
                <button type="button" onClick={onOpenReader}>阅读</button>
              </>
            ) : (
              <>
                <button type="button" className="is-primary" onClick={onOpenReader}>阅读正文</button>
                <button type="button" onClick={onOpenRevisionEditor}>校改</button>
              </>
            )}
            <button type="button" onClick={onOpenVersionHistory}>历史版本</button>
          </div>
        </article>
      ) : (
        <article className={`mobile-flow-next-card is-${action.tone}`}>
          <span>{action.eyebrow}</span>
          <h2>{action.title}</h2>
          <p>{action.text}</p>
          {action.label ? <button type="button" onClick={action.onClick} disabled={loadingChapter}>{action.label}<b>→</b></button> : null}
        </article>
      )}

      <section className="mobile-flow-resource-hub">
        <div className="mobile-flow-section-head">
          <div><h2>本章资料</h2><p>正文生成会读取这些内容</p></div>
          <span className={hasOutline ? 'is-ready' : 'is-required'}>{hasOutline ? (hasStoryline ? '资料就绪' : '可以生成') : '还差细纲'}</span>
        </div>
        <div className="mobile-flow-resource-list">
          {chapterResources.map((resource) => (
            <button type="button" className={`mobile-flow-resource-item${resource.done ? ' is-done' : ''}${resource.key === 'outline' && !resource.done ? ' is-required' : ''}`} onClick={resource.onClick} key={resource.key}>
              <span className="mobile-flow-resource-marker">{resource.done ? '✓' : resource.marker}</span>
              <span className="mobile-flow-resource-copy"><strong>{resource.label}</strong><small>{resource.detail}</small></span>
              <em>{resource.status}</em>
              <b aria-hidden="true">›</b>
            </button>
          ))}
        </div>
      </section>

    </section>
  );
}
