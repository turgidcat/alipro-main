import {
  buildConstraintBriefText,
  getGenerationChapterOutline,
  getPlanWordCount
} from './chapterPlan.js';

const STREAM_DRAFT_STORAGE_PREFIX = 'alipro:stream-chapter-draft';

function canUseSessionStorage() {
  return typeof window !== 'undefined' && !!window.sessionStorage;
}

export function buildStreamDraftStorageKey(bookId, chapterNumber) {
  const safeBookId = String(bookId || '').trim();
  const safeChapterNumber = Number(chapterNumber || 0);
  if (!safeBookId || !safeChapterNumber) return '';
  return `${STREAM_DRAFT_STORAGE_PREFIX}:${safeBookId}:${safeChapterNumber}`;
}

export function readStreamDraftCache({ bookId, chapterNumber }) {
  const storageKey = buildStreamDraftStorageKey(bookId, chapterNumber);
  if (!storageKey || !canUseSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function writeStreamDraftCache({ bookId, chapterNumber, draft }) {
  const storageKey = buildStreamDraftStorageKey(bookId, chapterNumber);
  if (!storageKey || !canUseSessionStorage()) return;

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      ...draft,
      updatedAt: new Date().toISOString()
    }));
  } catch (_) {}
}

export function clearStreamDraftCache({ bookId, chapterNumber }) {
  const storageKey = buildStreamDraftStorageKey(bookId, chapterNumber);
  if (!storageKey || !canUseSessionStorage()) return;

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch (_) {}
}

function buildAuditSummaryText(auditResult) {
  if (!auditResult || typeof auditResult !== 'object') {
    return '正文生成完成后，这里会整理本章推进结果。';
  }

  const verdict = String(auditResult.verdict || '').trim();
  const riskCount = Array.isArray(auditResult.risks) ? auditResult.risks.length : 0;

  if (!verdict && !riskCount) {
    return '全文审计已完成，等待保存结果写回。';
  }

  return [
    verdict ? `审计结论：${verdict}` : '',
    `风险项：${riskCount} 条`
  ].filter(Boolean).join(' / ');
}

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
  streamChapterContent,
  abortController,
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
  setGenerationState((prev) => ({
    ...prev,
    hasContent: false,
    content: '',
    statusKind: 'info',
    statusTitle: '正在流式生成正文',
    statusText: '正文会一段一段返回，全部结束后才会继续审计、保存和写回本章反馈。',
    metaText: `第 ${chapterNumber} 章`,
    wordCountLabel: `目标 ${getPlanWordCount(normalizedPlan)} 字`,
    previewText: '模型开始返回正文后，这里会实时显示内容。',
    feedbackSummary: '全文生成完成后，这里会先显示审计状态，再进入保存和反馈写回。',
    feedbackFocus: '如果中途中断，未保存草稿会保留在当前会话里。'
  }));

  try {
    const chapterTitle = draftChapterPlan.chapter_name
      ? `第 ${chapterNumber} 章 ${draftChapterPlan.chapter_name}`
      : `第 ${chapterNumber} 章`;
    const targetWordCount = getPlanWordCount(normalizedPlan);
    let streamedContent = '';
    let latestAudit = null;

    writeStreamDraftCache({
      bookId: selectedBookId,
      chapterNumber,
      draft: {
        chapterTitle,
        content: ''
      }
    });

    const response = await streamChapterContent({
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
    }, {
      signal: abortController?.signal,
      onDelta: ({ content, contentLength }) => {
        streamedContent = String(content || '');
        writeStreamDraftCache({
          bookId: selectedBookId,
          chapterNumber,
          draft: {
            chapterTitle,
            content: streamedContent
          }
        });
        setGenerationState((prev) => ({
          ...prev,
          hasContent: true,
          content: streamedContent,
          statusKind: 'info',
          statusTitle: '正在流式生成正文',
          statusText: '正文正在实时返回。生成结束后才会继续审计和保存，所以现在看到的不代表已经真正写进系统。',
          metaText: chapterTitle,
          wordCountLabel: `实时约 ${contentLength} 字 / 目标 ${targetWordCount} 字`,
          previewText: streamedContent
        }));
      },
      onAudit: (auditPayload) => {
        latestAudit = auditPayload;
        setGenerationState((prev) => ({
          ...prev,
          statusKind: 'info',
          statusTitle: '正文生成完成，正在审计',
          statusText: '已经拿到完整正文，正在执行全文审计。审计完成后才会继续保存正文和本章反馈。',
          feedbackSummary: buildAuditSummaryText(auditPayload)
        }));
      },
      onDone: ({ content }) => {
        streamedContent = String(content || streamedContent || '');
        setGenerationState((prev) => ({
          ...prev,
          hasContent: true,
          content: streamedContent,
          statusKind: 'info',
          statusTitle: '正文生成完成，正在保存',
          statusText: '正文已生成，接下来会沿用旧链路保存正文、生成反馈并刷新章节承接信息。',
          metaText: chapterTitle,
          wordCountLabel: `实际约 ${streamedContent.length} 字 / 目标 ${targetWordCount} 字`,
          previewText: streamedContent,
          feedbackSummary: buildAuditSummaryText(latestAudit),
          feedbackFocus: '保存完成后，这里会更新成真正写回后的下一章关注点。'
        }));
      }
    });
    const content = response?.content || streamedContent || '';
    if (!content) {
      throw new Error('流式生成结束了，但没有收到正文内容。');
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
    clearStreamDraftCache({
      bookId: selectedBookId,
      chapterNumber
    });
    return true;
  } catch (generateError) {
    const draftContent = readStreamDraftCache({
      bookId: selectedBookId,
      chapterNumber
    })?.content || '';
    const recoveredContent = draftContent || '';
    const stoppedByUser = generateError?.name === 'AbortError';

    setGenerationState((prev) => ({
      ...prev,
      hasContent: !!recoveredContent,
      content: recoveredContent || prev.content || '',
      statusKind: stoppedByUser ? 'warning' : 'error',
      statusTitle: stoppedByUser ? '已停止生成' : '生成失败',
      statusText: stoppedByUser
        ? '本次流式生成已停止。当前未保存草稿已保留在本页和 sessionStorage 里，你可以稍后继续处理。'
        : generateError.message,
      previewText: recoveredContent || prev.previewText,
      wordCountLabel: recoveredContent
        ? `保留了约 ${recoveredContent.length} 字的未保存草稿`
        : prev.wordCountLabel
    }));
    return false;
  } finally {
    setIsGenerating(false);
  }
}
