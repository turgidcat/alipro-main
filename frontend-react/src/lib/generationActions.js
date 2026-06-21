import {
  buildConstraintBriefText,
  getGenerationChapterOutline,
  getPlanWordCount
} from './chapterPlan.js';

export async function generateChapterAction({
  selectedBookId,
  chapterNumber,
  planningState,
  draftChapterPlan,
  emptyChapterStructure,
  chapterContext,
  constraintOverrides,
  generationReadiness,
  missingRequiredItems,
  generationState,
  generationRiskReview,
  generationRiskConfirmed,
  generationRequiredItems,
  generationRecommendedItems,
  missingRecommendedItems,
  selectedMainStorylineLabel,
  selectedTargetStorylineLabel,
  storylineRhythmHints,
  setGenerationState,
  setIsGenerating,
  generateChapterContent,
  handlePersistChapterResultCycle
}) {
  const normalizedPlan = {
    ...draftChapterPlan,
    generation_settings: {
      ...(draftChapterPlan.generation_settings || {}),
      word_count: getPlanWordCount(draftChapterPlan)
    },
    structured_content: {
      ...(draftChapterPlan.structured_content || {}),
      generation_settings: {
        ...((draftChapterPlan.structured_content || {}).generation_settings || {}),
        word_count: getPlanWordCount(draftChapterPlan)
      }
    }
  };
  const chapterStructure = normalizedPlan.chapter_structure || emptyChapterStructure;
  const autoOutline = getGenerationChapterOutline(normalizedPlan);
  const constraintBrief = buildConstraintBriefText(chapterContext.generationConstraints, constraintOverrides);

  if (!generationReadiness?.canGenerate) {
    setGenerationState({
      ...generationState,
      statusKind: 'warning',
      statusTitle: generationReadiness?.title || '当前缺少生成锚点',
      statusText: generationReadiness?.text || '请先补齐章节细纲，或至少挂载一条剧情线。'
    });
    return false;
  }

  if (generationRiskReview.hasCritical && !generationRiskConfirmed) {
    setGenerationState({
      ...generationState,
      statusKind: 'warning',
      statusTitle: '请先确认高风险放开项',
      statusText: '你已经放开至少一条禁止项。先确认你知道这会明显降低剧情掌控度，再继续生成。'
    });
    return false;
  }

  setIsGenerating(true);
  setGenerationState({
    ...generationState,
    statusKind: 'info',
    statusTitle: '正在生成正文',
    statusText: '正在把本章计划送进生成链路。'
  });

  try {
    const chapterTitle = draftChapterPlan.chapter_name
      ? `第 ${chapterNumber} 章 ${draftChapterPlan.chapter_name}`
      : `第 ${chapterNumber} 章`;
    const targetWordCount = getPlanWordCount(normalizedPlan);
    const response = await generateChapterContent({
      bookId: selectedBookId,
      bookTitle: planningState.currentBook.title,
      genre: planningState.currentBook.genre,
      subgenre: planningState.currentBook.subgenre,
      platform: planningState.currentBook.platform,
      template: planningState.currentBook.template,
      chapterNumber,
      wordCount: targetWordCount,
      outline: autoOutline,
      chapterName: normalizedPlan.chapter_name || '',
      chapterTitle,
      chapterPlan: normalizedPlan,
      chapterStructure,
      generationBrief: {
        requiredItems: generationRequiredItems,
        recommendedItems: generationRecommendedItems,
        missingRequiredItems,
        missingRecommendedItems,
        riskItems: generationRiskReview.items.map((item) => ({
          label: item.title,
          value: item.text
        })),
        mainStoryline: selectedMainStorylineLabel,
        targetStorylines: selectedTargetStorylineLabel,
        wordCount: targetWordCount,
        rhythmHints: storylineRhythmHints.map((hint) => hint.text),
        constraintBrief
      },
      promptType: 'chapter'
    });
    const content = String(response?.content || response?.text || response || '').trim();
    if (!content) {
      throw new Error('生成接口已返回，但正文内容为空，已阻止写入。请检查后端 provider 返回结果。');
    }
    await handlePersistChapterResultCycle({
      content,
      normalizedPlan,
      chapterStructure,
      chapterTitle,
      targetWordCount,
      successTitle: '正文已生成',
      successText: '正文和本章反馈都已写回，下一章会自动读取这份承接信息。',
      openResultModal: true
    });
    return true;
  } catch (generateError) {
    setGenerationState({
      ...generationState,
      statusKind: 'error',
      statusTitle: '生成失败',
      statusText: generateError.message
    });
    return false;
  } finally {
    setIsGenerating(false);
  }
}
