import { initialGenerationState } from './constants.js';
import {
  normalizeRoleList,
  normalizeRoleExecution,
  buildChapterStructureFromPlan,
  getPlanWordCount
} from './chapterPlan.js';

export function normalizeChapterBundle(bundle, chapterNumber) {
  const plan = bundle?.chapterPlan || {};
  const context = bundle?.chapterContext || {};
  const content = String(plan.generatedContent || '').trim();
  const feedback = plan.chapterFeedback || {};
  const appearingRoles = normalizeRoleList(plan.appearingRoles);

  return {
    context: {
      latestChapterLabel: context.latestChapterLabel || '还没有章节记录，建议从第 1 章开始。',
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
      chapter_name: plan.chapterTitle || '',
      summary: plan.summary || '',
      chapter_mission: plan.chapterMission || '',
      emotion_target: plan.emotionTarget || '',
      previous_hook: plan.previousHook || context.previousFeedbackFocus || '',
      outline_text: plan.outlineText || '',
      character_notes: plan.characterNotes || '',
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
      chapter_structure: buildChapterStructureFromPlan(plan),
      generation_settings: plan.structuredContent?.generation_settings || { word_count: 3000 },
      main_storyline_id: plan.mainStorylineId || '',
      target_storylines: Array.isArray(plan.targetStorylines) ? plan.targetStorylines : []
    },
    view: {
      volumeLabel: plan.volumeLabel || `第 ${plan.volumeNumber || 1} 卷`,
      volumeSummary: plan.volumeSummary || '这一章还没有明确卷级推进说明。',
      mainStoryline: plan.mainStorylineLabel || '暂未指定剧情线',
      targetStorylinesLabel: Array.isArray(plan.targetStorylineLabels) && plan.targetStorylineLabels.length
        ? plan.targetStorylineLabels.join(' / ')
        : '暂未挂接并行剧情线'
    },
    storylineOptions: Array.isArray(bundle?.storylineOptions) ? bundle.storylineOptions : [],
    generation: content
      ? {
          hasContent: true,
          content,
          statusKind: 'success',
          statusTitle: '本章已有正文',
          statusText: '可以查看正文，也可以调整章节规划后重新生成。',
          metaText: `第 ${chapterNumber} 章 · ${plan.chapterTitle || '未命名章节'}`,
          wordCountLabel: `实际约 ${content.length} 字 / 目标 ${getPlanWordCount(plan)} 字`,
          previewText: content.replace(/\s+/g, ' ').slice(0, 520),
          feedbackSummary: feedback.chapter_summary || '本章已有正文，生成反馈可后续继续增强。',
          feedbackFocus: feedback.next_chapter_focus || feedback.open_hooks || '下一章重点暂未整理。'
        }
      : initialGenerationState
  };
}

export function mergeFeedbackIntoPlan(plan, chapterFeedback) {
  const structuredContent = {
    ...(plan.structured_content || {}),
    chapter_feedback: chapterFeedback
  };
  return {
    ...plan,
    structured_content: structuredContent,
    structuredContent
  };
}
