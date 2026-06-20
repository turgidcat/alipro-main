import {
  buildGenerationRiskReview,
  getGenerationChapterOutline,
  getLatestChapterOutline,
  hasMountedStorylineAnchor,
  hasText,
  hasUsableChapterOutline
} from '../lib/chapterPlan.js';
import { formatStorylineTypeLabel } from '../lib/storylineLabel.js';

export function useChapterWorkbenchViewModel({
  chapterNumber,
  draftChapterPlan,
  chapterView,
  chapterContext,
  storylineOptions,
  constraintOverrides,
  emptyChapterStructure
}) {
  const selectedMainStoryline = storylineOptions.find((item) => item.id === draftChapterPlan.main_storyline_id);
  const selectedTargetStorylineIds = Array.isArray(draftChapterPlan.target_storylines) ? draftChapterPlan.target_storylines : [];
  const selectedTargetStorylines = storylineOptions.filter((item) =>
    selectedTargetStorylineIds.includes(item.id)
    || (!!draftChapterPlan.main_storyline_id && item.id === draftChapterPlan.main_storyline_id)
  );

  const selectedMainStorylineLabel = selectedMainStoryline
    ? `${selectedMainStoryline.name} · ${formatStorylineTypeLabel(selectedMainStoryline.type)}`
    : chapterView.mainStoryline || '暂未指定';
  const selectedTargetStorylineLabel = selectedTargetStorylines.length > 0
    ? selectedTargetStorylines.map((item) => item.name).join(' / ')
    : chapterView.targetStorylinesLabel || '暂未挂接';

  const latestOutline = getLatestChapterOutline(draftChapterPlan);
  const generationOutline = getGenerationChapterOutline(draftChapterPlan);
  const outlineItems = [
    {
      key: 'outline',
      label: latestOutline ? '章节细纲' : '结构化任务锚点',
      value: latestOutline || generationOutline
    }
  ];
  const hasOutlineAnchor = hasUsableChapterOutline(draftChapterPlan);
  const hasStorylineAnchor = hasMountedStorylineAnchor(draftChapterPlan);
  const generationRequiredItems = hasOutlineAnchor
    ? outlineItems
    : hasStorylineAnchor
      ? [{ key: 'storyline', label: '剧情线挂载', value: selectedTargetStorylineLabel || selectedMainStorylineLabel }]
      : [{ key: 'anchor', label: '章节细纲或剧情线挂载', value: '' }];
  const generationRecommendedItems = [
    ...(!hasOutlineAnchor ? outlineItems : []),
    { key: 'summary', label: '章节摘要', value: draftChapterPlan.summary },
    { key: 'hook', label: '承接钩子', value: draftChapterPlan.previous_hook || draftChapterPlan.ending_hook },
    ...(hasOutlineAnchor ? [{ key: 'storyline', label: '剧情线承接', value: selectedTargetStorylines.length > 0 ? selectedTargetStorylineLabel : '' }] : [])
  ];

  const missingRequiredItems = generationRequiredItems.filter((item) => !hasText(item.value));
  const missingRecommendedItems = generationRecommendedItems.filter((item) => !hasText(item.value));
  const canGenerate = hasOutlineAnchor || hasStorylineAnchor;
  const generationReadiness = !canGenerate
    ? {
        canGenerate,
        kind: 'warning',
        title: '当前缺少生成锚点',
        text: '请先补齐章节细纲，或至少挂载一条剧情线。'
      }
    : !hasOutlineAnchor && hasStorylineAnchor
      ? {
          canGenerate,
          kind: 'warning',
          title: '可以生成，但将依赖剧情线挂载',
          text: '当前没有章节细纲，系统会按已挂载剧情线、卷任务和上下文约束生成。'
        }
      : missingRecommendedItems.length > 0
      ? {
          canGenerate,
          kind: 'warning',
          title: '可以生成，但建议再补充',
          text: `建议补充：${missingRecommendedItems.map((item) => item.label).join('、')}。`
        }
      : {
          canGenerate,
          kind: 'success',
          title: '生成简报已就绪',
          text: '当前章节细纲和生成锚点都已就位。'
      };

  const generationRiskReview = buildGenerationRiskReview(
    draftChapterPlan,
    chapterContext.generationConstraints,
    constraintOverrides
  );

  const storylineRhythmHints = selectedTargetStorylines.map((storyline) => {
    if (chapterNumber < storyline.startChapter) {
      return {
        id: storyline.id,
        text: storyline.name + ' 预计从第 ' + storyline.startChapter + ' 章开始，现在提前使用，适合做伏笔或预热。',
        actionLabel: '改为本章启动',
        actionField: 'start',
        storyline
      };
    }
    if (chapterNumber > storyline.endChapter) {
      return {
        id: storyline.id,
        text: storyline.name + ' 预计第 ' + storyline.endChapter + ' 章前后收束，现在继续使用，建议确认是否延后回收。',
        actionLabel: '延后到本章',
        actionField: 'end',
        storyline
      };
    }
    return null;
  });

  return {
    chapterStructure: draftChapterPlan.chapter_structure || emptyChapterStructure,
    generationReadiness,
    generationRecommendedItems,
    generationRequiredItems,
    hasOutlineAnchor,
    hasStorylineAnchor,
    canGenerate,
    generationRiskReview,
    missingRecommendedItems,
    missingRequiredItems,
    selectedMainStoryline,
    selectedMainStorylineLabel,
    selectedTargetStorylineLabel,
    selectedTargetStorylines,
    storylineRhythmHints: storylineRhythmHints.filter(Boolean)
  };
}
