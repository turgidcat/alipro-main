import { initialGenerationState } from './constants.js';
import { buildQualityCheckState } from './generationActions.js';
import { normalizeChapterName } from './chapterName.js';
import {
  normalizeRoleList,
  normalizeRoleExecution,
  getPlanWordCount
} from './chapterPlan.js';
import { countPlatformEffectiveWords, formatWordCountProgress } from './textMetrics.js';

function sanitizeGeneratedText(value) {
  return String(value || '')
    .replace(/\uFFFD+/g, '')
    .replace(/�+/g, '')
    .trim();
}

export function normalizeChapterBundle(bundle, chapterNumber) {
  const plan = bundle?.chapterPlan || {};
  const context = bundle?.chapterContext || {};
  const content = sanitizeGeneratedText(plan.generatedContent);
  const effectiveWordCount = countPlatformEffectiveWords(content);
  const feedback = plan.chapterFeedback || {};
  const appearingRoles = normalizeRoleList(plan.appearingRoles);
  const targetWordCount = getPlanWordCount(plan);
  const deviationRatio = targetWordCount > 0 && content
    ? (effectiveWordCount - targetWordCount) / targetWordCount
    : 0;
  const deviationLabel = targetWordCount > 0 && content
    ? `，偏差 ${deviationRatio >= 0 ? '+' : ''}${(deviationRatio * 100).toFixed(1)}%`
    : '';

  return {
    context: {
      latestChapterLabel: context.latestChapterLabel || '还没有章节记录，建议从第 1 章开始。',
      suggestedChapterNumber: Number(context.suggestedChapterNumber || 1),
      existingChapterCount: Number(context.existingChapterCount || 0),
      totalChapterCount: Number(context.totalChapterCount || 0),
      chapterListItems: Array.isArray(context.chapterListItems) ? context.chapterListItems : [],
      volumeList: Array.isArray(context.volumeList) ? context.volumeList : [],
      previousFeedbackLabel: context.previousFeedbackLabel || '',
      previousFeedbackFocus: context.previousFeedbackFocus || '',
      generationConstraints: context.generationConstraints || {
        summary: '',
        anchors: [],
        allowed: [],
        blocked: [],
        rolePool: []
      }
    },
    draft: {
      volume_number: plan.volumeNumber || 1,
      chapter_name: normalizeChapterName(plan.chapterTitle),
      summary: plan.summary || '',
      chapter_mission: plan.chapterMission || '',
      emotion_target: plan.emotionTarget || '',
      previous_hook: plan.previousHook || context.previousFeedbackFocus || '',
      outline_text: plan.outlineText || '',
      source: plan.source || 'manual',
      character_notes: plan.characterNotes || '',
      plot_notes: plan.plotNotes || plan.structuredContent?.plot_notes || '',
      ending_hook: plan.endingHook || '',
      scene_outline: plan.sceneOutline || [],
      appearing_roles: appearingRoles,
      role_execution: normalizeRoleExecution(
        plan.roleExecution,
        appearingRoles,
        plan.characterNotes || '',
        plan.chapterMission || ''
      ),
      structured_content: plan.structuredContent || {},
      chapter_structure: {},
      generation_settings: plan.structuredContent?.generation_settings || { word_count: 3000 },
      main_storyline_id: plan.mainStorylineId || '',
      target_storylines: Array.isArray(plan.targetStorylines) ? plan.targetStorylines : []
    },
    view: {
      volumeLabel: plan.volumeLabel || `第 ${plan.volumeNumber || 1} 卷`,
      volumeSummary: plan.volumeSummary || '这一章还没有明确卷级推进说明。',
      mainStoryline: plan.mainStorylineLabel || '暂未指定叙事脉络',
      targetStorylinesLabel: Array.isArray(plan.targetStorylineLabels) && plan.targetStorylineLabels.length
        ? plan.targetStorylineLabels.join(' / ')
        : '暂未挂接并行叙事脉络'
    },
    storylineOptions: Array.isArray(bundle?.storylineOptions) ? bundle.storylineOptions : [],
    generation: content
      ? {
          hasContent: true,
          content,
          statusKind: 'success',
          statusTitle: '本章已有正文',
          statusText: '可以查看正文，也可以调整章节规划后重新生成。',
          metaText: `第 ${chapterNumber} 章 · ${normalizeChapterName(plan.chapterTitle) || '未命名章节'}`,
          wordCountLabel: `${formatWordCountProgress(effectiveWordCount, targetWordCount)}${deviationLabel}`,
          previewText: content.replace(/\s+/g, ' ').slice(0, 520),
          feedbackSummary: feedback.chapter_summary || '本章已有正文，生成反馈可后续继续增强。',
          feedbackFocus: feedback.next_chapter_focus || feedback.open_hooks || '下一章重点暂未整理。',
          qualityCheck: buildQualityCheckState(feedback),
          storylineProgress: feedback.storyline_progress || null,
          storylineProgressUpdated: !!feedback.storyline_progress,
          storylineProgressError: ''
        }
      : initialGenerationState
  };
}

export function mergeFeedbackIntoPlan(plan, chapterFeedback) {
  const structuredContent = {
    ...(plan.structured_content || {}),
    chapter_feedback: chapterFeedback,
    character_feedback: {
      ...((plan.structured_content || {}).character_feedback || {}),
      summary: chapterFeedback?.character_progress || '',
      characters: Array.isArray(chapterFeedback?.chapter_characters) ? chapterFeedback.chapter_characters : [],
      newCharacters: Array.isArray(chapterFeedback?.continuity_report?.new_characters)
        ? chapterFeedback.continuity_report.new_characters
        : [],
      updatedAt: chapterFeedback?.updated_at || new Date().toISOString(),
      source: chapterFeedback?.source || 'model_feedback'
    },
    plot_feedback: {
      ...((plan.structured_content || {}).plot_feedback || {}),
      chapterSummary: chapterFeedback?.chapter_summary || '',
      summary: chapterFeedback?.story_progress || '',
      openHooks: chapterFeedback?.open_hooks || '',
      nextChapterFocus: chapterFeedback?.next_chapter_focus || '',
      updatedAt: chapterFeedback?.updated_at || new Date().toISOString(),
      source: chapterFeedback?.source || 'model_feedback'
    }
  };
  return {
    ...plan,
    structured_content: structuredContent,
    structuredContent
  };
}
