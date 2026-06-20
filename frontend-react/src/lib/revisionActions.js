import {
  applyRevisionSuggestionToDraft,
  buildRevisionSessionState,
  resolveRevisionSuggestionsResponse
} from './revisionDiff.js';

export function openRevisionEditorSession({
  content,
  revisionParagraphRefs,
  revisionChangeRefs,
  setRevisionOriginal,
  setRevisionDraft,
  setRevisionSuggestions,
  setRevisionError,
  setRevisionNotice,
  setRevisionFocusIndex,
  setRevisionAppliedChangeKeys,
  setResultModalOpen
}) {
  const revisionSessionState = buildRevisionSessionState(content || '');
  revisionParagraphRefs.current = new Map();
  revisionChangeRefs.current = new Map();
  setRevisionOriginal(revisionSessionState.revisionOriginal);
  setRevisionDraft(revisionSessionState.revisionDraft);
  setRevisionSuggestions(revisionSessionState.revisionSuggestions);
  setRevisionError(revisionSessionState.revisionError);
  setRevisionNotice(revisionSessionState.revisionNotice);
  setRevisionFocusIndex(revisionSessionState.revisionFocusIndex);
  setRevisionAppliedChangeKeys(revisionSessionState.revisionAppliedChangeKeys);
  setResultModalOpen(true);
}

export function applyRevisionSuggestionAction({
  revisionDraft,
  revisionOriginal,
  suggestion,
  changeKey,
  setRevisionError,
  setRevisionDraft,
  setRevisionAppliedChangeKeys,
  setRevisionNotice,
  focusRevisionParagraph
}) {
  const result = applyRevisionSuggestionToDraft({
    revisionDraft,
    revisionOriginal,
    suggestion
  });
  if (result.error) {
    setRevisionError(result.error);
    return false;
  }

  setRevisionDraft(result.nextDraft);
  if (changeKey) {
    setRevisionAppliedChangeKeys((current) => (current.includes(changeKey) ? current : [...current, changeKey]));
  }
  setRevisionNotice(`已应用第 ${suggestion?.paragraph || suggestion?.afterParagraph || '?'} 条建议到校改稿。`);
  window.setTimeout(() => focusRevisionParagraph(result.focusParagraph), 0);
  return true;
}

export async function polishRevisionAction({
  revisionDraft,
  revisionRequirement,
  polishChapterContent,
  setRevisionPolishing,
  setRevisionError,
  setRevisionNotice,
  setRevisionSuggestions
}) {
  const sourceContent = String(revisionDraft || '').trim();
  if (sourceContent.length < 5) {
    setRevisionError('正文太短，暂时无法生成校改稿。');
    return false;
  }

  setRevisionPolishing(true);
  setRevisionError('');
  setRevisionNotice('');
  setRevisionSuggestions(null);
  try {
    const response = await polishChapterContent(sourceContent, revisionRequirement, {
      mode: 'revision_suggestions',
      maxChangeCount: 6
    });
    const result = resolveRevisionSuggestionsResponse(response);
    if (result.error) {
      setRevisionError(result.error);
      return false;
    }
    setRevisionSuggestions(response);
    setRevisionNotice(result.notice);
    return true;
  } catch (polishError) {
    setRevisionError(polishError.message);
    return false;
  } finally {
    setRevisionPolishing(false);
  }
}

export async function saveRevisionAction({
  revisionDraft,
  draftChapterPlan,
  chapterNumber,
  emptyChapterStructure,
  withStructuredChapterPlan,
  getPlanWordCount,
  handlePersistChapterResultCycle,
  setRevisionSaving,
  setRevisionError,
  setResultModalOpen
}) {
  const nextContent = String(revisionDraft || '').trim();
  if (!nextContent) {
    setRevisionError('正文不能为空。');
    return false;
  }

  setRevisionSaving(true);
  setRevisionError('');
  try {
    const normalizedPlan = withStructuredChapterPlan(
      draftChapterPlan,
      draftChapterPlan.chapter_structure || emptyChapterStructure
    );
    const chapterStructure = normalizedPlan.chapter_structure || emptyChapterStructure;
    const chapterTitle = draftChapterPlan.chapter_name
      ? `第 ${chapterNumber} 章 ${draftChapterPlan.chapter_name}`
      : `第 ${chapterNumber} 章`;
    await handlePersistChapterResultCycle({
      content: nextContent,
      normalizedPlan,
      chapterStructure,
      chapterTitle,
      targetWordCount: getPlanWordCount(normalizedPlan),
      successTitle: '正文已校改',
      successText: '校改后的正文、反馈和剧情线承接都已同步写回。'
    });
    setResultModalOpen(false);
    return true;
  } catch (saveError) {
    setRevisionError(saveError.message);
    return false;
  } finally {
    setRevisionSaving(false);
  }
}
