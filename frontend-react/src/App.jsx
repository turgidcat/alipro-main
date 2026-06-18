import { Fragment } from 'react';
import {
  createDemoWorkspace,
  fetchChapterSetupBundle,
  generateChapterContent,
  generateChapterFeedback,
  polishChapterContent,
  saveChapterPlan,
  saveStoryline,
  upsertGeneratedChapter
} from './workbenchApi.js';
import './app-shell.css';
import {
  emptyChapterStructure,
  emptyStorylineDraft,
  ROLE_EXECUTION_DIMENSIONS,
  ROLE_EXECUTION_DIRECTIONS,
  ROLE_EXECUTION_SCOPES,
  ROLE_EXECUTION_CONFIDENCE,
  ROLE_DIMENSION_LABELS,
  ROLE_DIRECTION_LABELS,
  ROLE_SCOPE_LABELS,
  ROLE_CONFIDENCE_LABELS,
  PLATFORM_LABELS,
  GENRE_LABELS,
  SUBGENRE_LABELS,
  TEMPLATE_LABELS
} from './lib/constants.js';
import {
  buildSvgDataUrl,
  createBookCoverDataUrl,
  createVolumePosterDataUrl,
  createCharacterBadgeDataUrl,
  buildCharacterSubtitle
} from './lib/assets.js';
import {
  normalizeLines,
  normalizeRoleName,
  normalizeRoleList,
  summarizeText,
  buildConstraintBriefText,
  composeStructuredOutline,
  composeSceneOutlineText,
  buildChapterStructureFromPlan,
  normalizeRoleExecution,
  describeRoleExecutionMeta,
  buildGenerationRiskReview,
  getPlanWordCount,
  normalizeChapterStructureForSave,
  prepareOutlineModalPlan,
  withStructuredChapterPlan,
  hasText
} from './lib/chapterPlan.js';
import {
  normalizeParagraphs,
  splitRevisionParagraphs,
  normalizeRevisionText,
  normalizeSentences,
  similarityScore,
  buildRevisionDiff,
  buildRevisionSentenceDiff,
  buildRevisionEvaluation,
  buildLocalChapterFeedback
} from './lib/revisionDiff.js';
import { normalizeChapterBundle, mergeFeedbackIntoPlan } from './lib/chapterBundle.js';
import WorkflowTabs from './components/workbench/WorkflowTabs.jsx';
import PanelCard from './components/workbench/PanelCard.jsx';
import Modal from './components/workbench/Modal.jsx';
import BlockedConstraints from './components/workbench/BlockedConstraints.jsx';
import { useWorkbench } from './hooks/useWorkbench.js';

export default function App() {
  const {
    books,
    selectedBookId,
    setSelectedBookId,
    planningState,
    loadingBooks,
    loadingPlanning,
    error,
    reloadPlanning,
    reloadBooks,
    activeStep, setActiveStep,
    planningModal, setPlanningModal,
    chapterModal, setChapterModal,
    savingState, setSavingState,
    planningNotice, setPlanningNotice,
    chapterNumber, setChapterNumber,
    chapterContext, setChapterContext,
    chapterView, setChapterView,
    storylineOptions, setStorylineOptions,
    draftChapterPlan, setDraftChapterPlan,
    constraintOverrides, setConstraintOverrides,
    generationRiskConfirmed, setGenerationRiskConfirmed,
    draftStoryline, setDraftStoryline,
    generationState, setGenerationState,
    loadingChapter, setLoadingChapter,
    isGenerating, setIsGenerating,
    resultModalOpen, setResultModalOpen,
    revisionOriginal, setRevisionOriginal,
    revisionDraft, setRevisionDraft,
    revisionRequirement, setRevisionRequirement,
    revisionSuggestions, setRevisionSuggestions,
    revisionSaving, setRevisionSaving,
    revisionPolishing, setRevisionPolishing,
    revisionError, setRevisionError,
    revisionNotice, setRevisionNotice,
    revisionFocusIndex, setRevisionFocusIndex,
    revisionAppliedChangeKeys, setRevisionAppliedChangeKeys,
    revisionParagraphRefs,
    revisionChangeRefs,
    promptPreviewOpen, setPromptPreviewOpen
  } = useWorkbench();

  function setConstraintOverride(key, mode) {
    setConstraintOverrides((prev) => ({
      ...prev,
      [key]: mode
    }));
  }

  async function handleSaveChapterPlan() {
    setSavingState({ loading: true, error: '' });
    try {
      await saveChapterPlan(
        selectedBookId,
        chapterNumber,
        prepareOutlineModalPlan(draftChapterPlan)
      );
      const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
      const normalized = normalizeChapterBundle(bundle, chapterNumber);
      setChapterContext(normalized.context);
      setChapterView(normalized.view);
      setStorylineOptions(normalized.storylineOptions);
      setDraftChapterPlan(normalized.draft);
      setGenerationState(normalized.generation);
      setChapterModal(null);
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      return;
    }
    setSavingState({ loading: false, error: '' });
  }

  async function handleSaveChapterOutline() {
    setSavingState({ loading: true, error: '' });
    try {
      const outlinePlan = prepareOutlineModalPlan(draftChapterPlan);
      await saveChapterPlan(selectedBookId, chapterNumber, outlinePlan);
      const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
      const normalized = normalizeChapterBundle(bundle, chapterNumber);
      setChapterContext(normalized.context);
      setChapterView(normalized.view);
      setStorylineOptions(normalized.storylineOptions);
      setDraftChapterPlan(normalized.draft);
      setGenerationState(normalized.generation);
      setChapterModal(null);
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      return;
    }
    setSavingState({ loading: false, error: '' });
  }

  async function reloadChapterSetup(overrideDraft = null) {
    if (!selectedBookId) return;
    const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
    const normalized = normalizeChapterBundle(bundle, chapterNumber);
    setChapterContext(normalized.context);
    setChapterView(normalized.view);
    setStorylineOptions(normalized.storylineOptions);
    setDraftChapterPlan(overrideDraft || normalized.draft);
    setGenerationState(normalized.generation);
    return normalized;
  }

  async function persistChapterResultCycle({
    content,
    normalizedPlan,
    chapterStructure,
    chapterTitle,
    targetWordCount,
    successTitle,
    successText,
    openResultModal = false
  }) {
    await upsertGeneratedChapter(selectedBookId, {
      title: chapterTitle,
      chapterName: normalizedPlan.chapter_name || '',
      chapterNumber,
      content
    });

    let chapterFeedback = null;
    try {
      const feedbackResponse = await generateChapterFeedback({
        bookId: selectedBookId,
        chapterNumber,
        chapterTitle,
        content,
        outline: String(normalizedPlan.outline_text || composeStructuredOutline(chapterStructure)).trim()
      });
      chapterFeedback = feedbackResponse?.feedback || null;
    } catch (_) {
      chapterFeedback = null;
    }

    if (!chapterFeedback) {
      chapterFeedback = buildLocalChapterFeedback({
        content,
        plan: normalizedPlan,
        chapterStructure,
        mainStorylineLabel: selectedMainStorylineLabel,
        targetStorylineLabel: selectedTargetStorylineLabel,
        rhythmHints: storylineRhythmHints
      });
    }

    const feedbackPlan = mergeFeedbackIntoPlan(normalizedPlan, chapterFeedback);
    await saveChapterPlan(selectedBookId, chapterNumber, feedbackPlan);
    setDraftChapterPlan(feedbackPlan);
    setGenerationState({
      hasContent: true,
      content,
      statusKind: 'success',
      statusTitle: successTitle,
      statusText: successText,
      metaText: chapterTitle,
      wordCountLabel: `实际约 ${content.length} 字 / 目标 ${targetWordCount} 字`,
      previewText: String(content).replace(/\s+/g, ' ').slice(0, 520),
      feedbackSummary: chapterFeedback.chapter_summary || '',
      feedbackFocus: chapterFeedback.next_chapter_focus || chapterFeedback.open_hooks || ''
    });
    setRevisionOriginal(String(content || ''));
    setRevisionDraft(String(content || ''));
    setRevisionSuggestions(null);
    setRevisionError('');
    if (openResultModal) {
      setResultModalOpen(true);
    }
    return { feedbackPlan, chapterFeedback };
  }

  function goToPreviousChapter() {
    setChapterNumber((current) => Math.max(1, Number(current || 1) - 1));
  }

  function goToNextChapter() {
    setChapterNumber((current) => Math.max(1, Number(current || 1) + 1));
  }

  function openRevisionEditor() {
    const currentContent = generationState.content || '';
    revisionParagraphRefs.current = new Map();
    revisionChangeRefs.current = new Map();
    setRevisionOriginal(currentContent);
    setRevisionDraft(currentContent);
    setRevisionSuggestions(null);
    setRevisionError('');
    setRevisionNotice('');
    setRevisionFocusIndex(0);
    setRevisionAppliedChangeKeys([]);
    setResultModalOpen(true);
  }

  function registerRevisionParagraphRef(paragraphNumber, element) {
    const refs = revisionParagraphRefs.current;
    if (!refs) return;
    if (element) {
      refs.set(paragraphNumber, element);
    } else {
      refs.delete(paragraphNumber);
    }
  }

  function focusRevisionParagraph(paragraphNumber) {
    const target = revisionParagraphRefs.current.get(Number(paragraphNumber));
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('is-revision-focus');
      window.setTimeout(() => {
        target.classList.remove('is-revision-focus');
      }, 1200);
    }
  }

  function registerRevisionChangeRef(changeKey, element) {
    if (!changeKey) return;
    const refs = revisionChangeRefs.current;
    if (!refs) return;
    if (element) {
      refs.set(changeKey, element);
    } else {
      refs.delete(changeKey);
    }
  }

  function focusRevisionChangeItem(changeItem) {
    if (!changeItem) return;
    const target = revisionChangeRefs.current.get(changeItem.key);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('is-revision-focus');
      window.setTimeout(() => {
        target.classList.remove('is-revision-focus');
      }, 1200);
    }
  }

  function focusRevisionChange(direction) {
    if (revisionChangeItems.length === 0) return;
    const currentIndex = Math.min(revisionFocusIndex, revisionChangeItems.length - 1);
    const nextIndex = direction > 0
      ? (currentIndex + 1) % revisionChangeItems.length
      : (currentIndex - 1 + revisionChangeItems.length) % revisionChangeItems.length;
    setRevisionFocusIndex(nextIndex);
    focusRevisionChangeItem(revisionChangeItems[nextIndex]);
  }

  function applyRevisionSuggestion(suggestion, changeKey) {
    const baseContent = String(revisionDraft || revisionOriginal || '').trim();
    if (!baseContent) {
      setRevisionError('没有可编辑的正文。');
      return;
    }

    const paragraphs = splitRevisionParagraphs(baseContent);
    const mode = suggestion?.action;
    const replacement = String(suggestion?.suggested_text || '').trim();

    let nextParagraphs = [...paragraphs];
    if (mode === 'replace') {
      if (!replacement) {
        setRevisionError('这条修改没有可写入的正文。');
        return;
      }
      const paragraphIndex = Number(suggestion?.paragraph || 0) - 1;
      if (paragraphIndex < 0 || paragraphIndex >= nextParagraphs.length) {
        setRevisionError('替换段落编号超出范围。');
        return;
      }
      nextParagraphs[paragraphIndex] = replacement;
    } else if (mode === 'insert_after') {
      if (!replacement) {
        setRevisionError('这条新增没有可写入的正文。');
        return;
      }
      const anchorIndex = Number(suggestion?.afterParagraph || suggestion?.paragraph || 0) - 1;
      if (anchorIndex < 0 || anchorIndex >= nextParagraphs.length) {
        setRevisionError('鎻掑叆浣嶇疆瓒呭嚭鑼冨洿銆?');
        return;
      }
      nextParagraphs.splice(anchorIndex + 1, 0, replacement);
    } else if (mode === 'delete') {
      const paragraphIndex = Number(suggestion?.paragraph || 0) - 1;
      if (paragraphIndex < 0 || paragraphIndex >= nextParagraphs.length) {
        setRevisionError('删除段落编号超出范围。');
        return;
      }
      nextParagraphs[paragraphIndex] = '';
    } else {
      setRevisionError('涓嶆敮鎸佺殑寤鸿绫诲瀷銆?');
      return;
    }

    setRevisionDraft(nextParagraphs.join('\n\n'));
    if (changeKey) {
      setRevisionAppliedChangeKeys((current) => (current.includes(changeKey) ? current : [...current, changeKey]));
    }
    setRevisionNotice(`已应用第 ${suggestion?.paragraph || suggestion?.afterParagraph || '?'} 条建议到校改稿。`);
    window.setTimeout(() => focusRevisionParagraph(suggestion?.paragraph || suggestion?.afterParagraph || 1), 0);
  }

  async function handlePolishRevision() {
    const sourceContent = String(revisionDraft || '').trim();
    if (sourceContent.length < 5) {
      setRevisionError('正文太短，暂时无法生成校改稿。');
      return;
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
      const suggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];
      if (!response || (!suggestions.length && !response.regeneration_notes && !response.raw_content)) {
        setRevisionError('校改接口没有返回可用建议。');
        return;
      }
      setRevisionSuggestions(response);
      setRevisionNotice('已生成局部修改建议，正文不会自动替换，请挑选可用改动手动写入校改稿。');
    } catch (polishError) {
      setRevisionError(polishError.message);
    } finally {
      setRevisionPolishing(false);
    }
  }

  async function handleSaveRevision() {
    const nextContent = String(revisionDraft || '').trim();
    if (!nextContent) {
      setRevisionError('正文不能为空。');
      return;
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
      await persistChapterResultCycle({
        content: nextContent,
        normalizedPlan,
        chapterStructure,
        chapterTitle,
        targetWordCount: getPlanWordCount(normalizedPlan),
        successTitle: '正文已校改',
        successText: '校改后的正文、反馈和剧情线承接都已同步写回。'
      });
      setResultModalOpen(false);
    } catch (saveError) {
      setRevisionError(saveError.message);
    } finally {
      setRevisionSaving(false);
    }
  }

  function openStorylineCreator() {
    setDraftStoryline({
      ...emptyStorylineDraft,
      volume_number: draftChapterPlan.volume_number || 1,
      start_chapter: chapterNumber,
      end_chapter: Math.max(chapterNumber + 6, chapterNumber)
    });
    setSavingState({ loading: false, error: '' });
    setChapterModal('storyline');
  }

  function openStorylineEditor(storyline) {
    setDraftStoryline({
      id: storyline.id,
      volume_number: storyline.volumeNumber || 1,
      storyline_name: storyline.name || '',
      storyline_type: storyline.type || 'branch',
      description: storyline.description || '',
      core_conflict: storyline.coreConflict || '',
      start_chapter: storyline.startChapter || chapterNumber,
      end_chapter: storyline.endChapter || Math.max(chapterNumber + 6, chapterNumber)
    });
    setSavingState({ loading: false, error: '' });
    setChapterModal('storyline');
  }

  function updateDraftStorylineField(field, value) {
    setDraftStoryline((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveStoryline() {
    if (!selectedBookId) return;
    if (!draftStoryline.storyline_name.trim()) {
      setSavingState({ loading: false, error: '剧情线名称不能为空。' });
      return;
    }

    setSavingState({ loading: true, error: '' });
    try {
      const created = await saveStoryline(selectedBookId, draftStoryline);
      const savedId = draftStoryline.id || created?.id || '';
      const currentTargets = Array.isArray(draftChapterPlan.target_storylines) ? draftChapterPlan.target_storylines : [];
      const nextPlan = savedId
        ? {
            ...draftChapterPlan,
            main_storyline_id: draftChapterPlan.main_storyline_id || savedId,
            target_storylines: currentTargets.includes(savedId) ? currentTargets : [...currentTargets, savedId]
          }
        : draftChapterPlan;
      if (savedId && !draftStoryline.id) {
        await saveChapterPlan(
          selectedBookId,
          chapterNumber,
          withStructuredChapterPlan(nextPlan, nextPlan.chapter_structure || emptyChapterStructure)
        );
      }
      await reloadChapterSetup(nextPlan);
      setChapterModal(null);
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      return;
    }
    setSavingState({ loading: false, error: '' });
  }

  async function handleGenerateChapter() {
    const normalizedPlan = withStructuredChapterPlan(
      draftChapterPlan,
      draftChapterPlan.chapter_structure || emptyChapterStructure
    );
    const chapterStructure = normalizedPlan.chapter_structure || emptyChapterStructure;
    const autoOutline = String(normalizedPlan.outline_text || composeStructuredOutline(chapterStructure)).trim();
    const constraintBrief = buildConstraintBriefText(chapterContext.generationConstraints, constraintOverrides);

    if (missingRequiredItems.length > 0) {
      setGenerationState({
        ...generationState,
        statusKind: 'warning',
        statusTitle: '缺少章节必填信息',
        statusText: `请先补齐：${missingRequiredItems.map((item) => item.label).join('、')}。`
      });
      setActiveStep('chapter');
      return;
    }

    if (generationRiskReview.hasCritical && !generationRiskConfirmed) {
      setGenerationState({
        ...generationState,
        statusKind: 'warning',
        statusTitle: '请先确认高风险放开项',
        statusText: '你已经放开至少一条禁止项。先确认你知道这会明显降低剧情掌控度，再继续生成。'
      });
      return;
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
      const content = response?.content || response?.text || response || '';
      await persistChapterResultCycle({
        content,
        normalizedPlan,
        chapterStructure,
        chapterTitle,
        targetWordCount,
        successTitle: '正文已生成',
        successText: '正文和本章反馈都已写回，下一章会自动读取这份承接信息。',
        openResultModal: true
      });
    } catch (generateError) {
      setGenerationState({
        ...generationState,
        statusKind: 'error',
        statusTitle: '生成失败',
        statusText: generateError.message
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function updateDraftChapterPlanField(field, value) {
    setDraftChapterPlan((prev) => ({ ...prev, [field]: value }));
  }

  function updateChapterStructureField(field, value) {
    setDraftChapterPlan((prev) => {
      const nextStructure = {
        ...(prev.chapter_structure || emptyChapterStructure),
        [field]: value
      };
      return withStructuredChapterPlan(prev, nextStructure);
    });
  }

  function updateGenerationSetting(field, value) {
    setDraftChapterPlan((prev) => ({
      ...prev,
      generation_settings: {
        ...(prev.generation_settings || {}),
        [field]: value
      },
      structured_content: {
        ...(prev.structured_content || {}),
        generation_settings: {
          ...((prev.structured_content || {}).generation_settings || {}),
          [field]: value
        }
      }
    }));
  }

  function toggleTargetStoryline(storylineId) {
    setDraftChapterPlan((prev) => {
      const current = Array.isArray(prev.target_storylines) ? prev.target_storylines : [];
      const next = current.includes(storylineId)
        ? current.filter((id) => id !== storylineId)
        : [...current, storylineId];
      return { ...prev, target_storylines: next };
    });
  }

  function selectMainStoryline(storylineId) {
    setDraftChapterPlan((prev) => {
      const currentTargets = Array.isArray(prev.target_storylines) ? prev.target_storylines : [];
      return {
        ...prev,
        main_storyline_id: storylineId,
        target_storylines: storylineId && !currentTargets.includes(storylineId)
          ? [...currentTargets, storylineId]
          : currentTargets
      };
    });
  }

  function clearStorylineSelection() {
    setDraftChapterPlan((prev) => ({
      ...prev,
      main_storyline_id: '',
      target_storylines: []
    }));
  }

  async function adjustStorylineRange(storyline, field) {
    if (!selectedBookId) return;
    setSavingState({ loading: true, error: '' });
    try {
      await saveStoryline(selectedBookId, {
        id: storyline.id,
        volume_number: storyline.volumeNumber,
        storyline_name: storyline.name,
        storyline_type: storyline.type,
        description: storyline.description,
        core_conflict: storyline.coreConflict,
        start_chapter: field === 'start' ? chapterNumber : storyline.startChapter,
        end_chapter: field === 'end' ? chapterNumber : storyline.endChapter
      });
      await reloadChapterSetup(draftChapterPlan);
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      return;
    }
    setSavingState({ loading: false, error: '' });
  }

  const selectedMainStoryline = storylineOptions.find((item) => item.id === draftChapterPlan.main_storyline_id);
  const selectedTargetStorylines = storylineOptions.filter((item) =>
    Array.isArray(draftChapterPlan.target_storylines) && draftChapterPlan.target_storylines.includes(item.id)
  );
  const selectedMainStorylineLabel = selectedMainStoryline
    ? `${selectedMainStoryline.name} 路 ${selectedMainStoryline.type}`
    : chapterView.mainStoryline || '暂未指定';
  const selectedTargetStorylineLabel = selectedTargetStorylines.length > 0
    ? selectedTargetStorylines.map((item) => item.name).join(' / ')
    : chapterView.targetStorylinesLabel || '暂未挂接';
  const chapterStructure = draftChapterPlan.chapter_structure || emptyChapterStructure;
  const generationRequiredItems = [
    { key: 'goal', label: '本章目标', value: chapterStructure.chapter_goal },
    { key: 'scenes', label: '关键场景', value: chapterStructure.key_scenes },
    { key: 'ending', label: '结尾钩子', value: chapterStructure.ending_hook || draftChapterPlan.ending_hook }
  ];
  const generationRecommendedItems = [
    { key: 'conflict', label: '冲突升级', value: chapterStructure.conflict_escalation },
    { key: 'character', label: '角色变化', value: chapterStructure.character_change },
    { key: 'payoff', label: '情绪落点', value: chapterStructure.reader_payoff },
    { key: 'storyline', label: '剧情线承接', value: selectedTargetStorylines.length > 0 ? selectedTargetStorylineLabel : '' }
  ];
  const missingRequiredItems = generationRequiredItems.filter((item) => !hasText(item.value));
  const missingRecommendedItems = generationRecommendedItems.filter((item) => !hasText(item.value));
  const revisionOriginalParagraphs = normalizeParagraphs(revisionOriginal);
  const revisionSuggestionItems = Array.isArray(revisionSuggestions?.suggestions) ? revisionSuggestions.suggestions : [];
  const revisionSuggestionMarks = revisionSuggestionItems.reduce((acc, item) => {
    const action = String(item?.action || '').trim();
    const paragraph = Number(item?.paragraph || 0);
    const afterParagraph = Number(item?.afterParagraph || item?.paragraph || 0);
    if (action === 'replace' && paragraph > 0) {
      acc.replaceByParagraph.set(paragraph, item);
    } else if (action === 'delete' && paragraph > 0) {
      acc.deleteByParagraph.set(paragraph, item);
    } else if (action === 'insert_after' && afterParagraph > 0) {
      if (!acc.insertAfterParagraph.has(afterParagraph)) {
        acc.insertAfterParagraph.set(afterParagraph, []);
      }
      acc.insertAfterParagraph.get(afterParagraph).push(item);
    }
    return acc;
  }, {
    replaceByParagraph: new Map(),
    deleteByParagraph: new Map(),
    insertAfterParagraph: new Map()
  });
  const revisionChangeItems = revisionOriginalParagraphs.reduce((items, _, index) => {
    const paragraphNumber = index + 1;
    if (revisionSuggestionMarks.replaceByParagraph.has(paragraphNumber)) {
      items.push({
        key: `replace-${paragraphNumber}`,
        kind: 'replace',
        paragraphNumber,
        label: `第 ${paragraphNumber} 段修改`
      });
    }
    if (revisionSuggestionMarks.deleteByParagraph.has(paragraphNumber)) {
      items.push({
        key: `delete-${paragraphNumber}`,
        kind: 'delete',
        paragraphNumber,
        label: `第 ${paragraphNumber} 段删除`
      });
    }
    const insertSuggestions = revisionSuggestionMarks.insertAfterParagraph.get(paragraphNumber) || [];
    insertSuggestions.forEach((item, insertIndex) => {
      items.push({
        key: `insert-${paragraphNumber}-${insertIndex}`,
        kind: 'insert',
        paragraphNumber,
        label: `第 ${paragraphNumber} 段后新增`
      });
    });
    return items;
  }, []);
  const revisionCurrentFocusIndex = revisionChangeItems.length > 0
    ? Math.min(revisionFocusIndex, revisionChangeItems.length - 1)
    : 0;
  const revisionCurrentChange = revisionChangeItems[revisionCurrentFocusIndex] || null;
  const generationReadiness = missingRequiredItems.length > 0
    ? {
        kind: 'warning',
        title: '生成前还有必填信息缺失',
        text: `建议先补齐：${missingRequiredItems.map((item) => item.label).join('、')}。`
      }
    : missingRecommendedItems.length > 0
      ? {
          kind: 'warning',
          title: '可以生成，但建议再补充',
          text: `建议补充：${missingRecommendedItems.map((item) => item.label).join('、')}。`
        }
      : {
          kind: 'success',
          title: '生成简报已就绪',
          text: '本章目标、关键场景、冲突推进和收尾信息都已就位。'
      };
  const generationRiskReview = buildGenerationRiskReview(
    draftChapterPlan,
    chapterContext.generationConstraints,
    constraintOverrides
  );
  const storylineRhythmHints = selectedTargetStorylines
    .map((storyline) => {
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
      return {
        id: storyline.id,
        text: storyline.name + ' 正处在预计活跃范围内。',
        actionLabel: '',
        actionField: '',
        storyline
      };
    });

  return (
    <main className="app-shell">
      <header className="hero-section">
        <div>
          <span className="hero-eyebrow">React Workbench Prototype</span>
          <h1>创作台新架构</h1>
          <p>这一版先把全书规划、单章设置、正文生成收拢成一个清晰的业务区，继续复用现有后端接口。</p>
        </div>
        <div className="hero-note-card">
          <strong>当前阶段</strong>
          <p>先保证 React 工作台能稳定读写，再继续补复杂交互。</p>
        </div>
      </header>

      <WorkflowTabs activeStep={activeStep} onChange={setActiveStep} />

      {error ? <div className="global-banner is-error">{error}</div> : null}
      {loadingBooks ? <div className="global-banner">正在读取书籍列表...</div> : null}
      <section className="workbench-stage">
        {activeStep === 'book' ? (
          <div className="panel-grid panel-grid-book">
            <PanelCard
              className="book-planning-card book-planning-card-entry"
              eyebrow=""
              title=""
              description=""
            >
              <div className="book-planning-entry-badge">书籍操作</div>
              <div className="book-planning-entry-row">
                <button
                  type="button"
                  className="solid-btn action-btn"
                  onClick={() => { window.location.href = '/books?action=create'; }}
                >
                  新建书籍
                </button>
                <button
                  type="button"
                  className="ghost-btn nav-btn"
                  onClick={() => {
                    const target = selectedBookId ? `/books?bookId=${encodeURIComponent(selectedBookId)}` : '/books';
                    window.location.href = target;
                  }}
                  disabled={!selectedBookId}
                >
                  编辑书籍
                </button>
                <label className="select-wrap book-planning-entry-select">
                  <select
                    className="book-select"
                    value={selectedBookId}
                    onChange={(event) => setSelectedBookId(event.target.value)}
                    disabled={loadingBooks || books.length === 0}
                  >
                    {books.length === 0 ? <option value="">暂无书籍</option> : null}
                    {books.map((book) => (
                      <option key={book.id} value={book.id}>{book.title}</option>
                    ))}
                  </select>
                </label>
              </div>
            </PanelCard>

            <PanelCard
              className="book-planning-card book-planning-card-book"
              eyebrow="书籍"
              title={planningState.currentBook.title || '未命名书籍'}
              description=""
            >
              <div className="book-planning-hero">
                <div className="book-planning-cover-frame">
                  <img
                    className="book-planning-cover-image"
                    src={planningState.currentBook.coverImage || createBookCoverDataUrl(planningState.currentBook.title)}
                    alt={`${planningState.currentBook.title}封面示意图`}
                  />
                </div>
                <div className="book-planning-book-copy">
                  <p>{planningState.currentBook.author ? `作者：${planningState.currentBook.author}` : '作者：未填写'}</p>
                  <div className="book-planning-book-summary-card">
                    <span className="book-planning-book-summary-label">书籍简介</span>
                    <p>{planningState.currentBook.description || '这本书的基础设定和定位会从这里开始进入后续创作链路。'}</p>
                  </div>
                </div>
                <div className="book-planning-meta-grid">
                  <div className="book-planning-meta-item">
                    <span>平台</span>
                    <strong>{PLATFORM_LABELS[planningState.currentBook.platform] || planningState.currentBook.platform || '未设置'}</strong>
                  </div>
                  <div className="book-planning-meta-item">
                    <span>题材</span>
                    <strong>{GENRE_LABELS[planningState.currentBook.genre] || planningState.currentBook.genre || '未设置'}</strong>
                  </div>
                  <div className="book-planning-meta-item">
                    <span>子分类</span>
                    <strong>{SUBGENRE_LABELS[planningState.currentBook.subgenre] || planningState.currentBook.subgenre || '未设置'}</strong>
                  </div>
                  <div className="book-planning-meta-item">
                    <span>写法模板</span>
                    <strong>{TEMPLATE_LABELS[planningState.currentBook.template] || planningState.currentBook.template || '未设置'}</strong>
                  </div>
                </div>
              </div>
            </PanelCard>

            <PanelCard
              className="book-planning-card book-planning-card-character"
              eyebrow="角色"
              title="主要角色"
              description=""
            >
              <div className="book-planning-character-list">
                {(planningState.bookPlanning.characters || []).slice(0, 6).map((character) => (
                  <article key={character.id || character.name} className="book-planning-character-card character-card-standard">
                    <img
                      className="book-planning-character-avatar"
                      src={character.avatar_image || createCharacterBadgeDataUrl(character.name)}
                      alt={`${character.name}头像示意图`}
                    />
                    <div className="book-planning-character-copy">
                      <strong>{character.name}</strong>
                      <p>{buildCharacterSubtitle(character)}</p>
                    </div>
                  </article>
                ))}
                {(planningState.bookPlanning.characters || []).length === 0 ? (
                  <div className="book-planning-empty-note">
                    <p className="summary-state">暂无主体角色明细</p>
                  </div>
                ) : (
                  null
                )}
              </div>
            </PanelCard>

            <PanelCard
              className="book-planning-card book-planning-card-outline"
              eyebrow="大纲"
              title="分卷概览"
              description=""
            >
              <div className="book-planning-outline-layout">
                <div className="book-planning-volume-grid">
                  {(planningState.bookPlanning.volumePlans || []).slice(0, 6).map((plan) => (
                    <article key={plan.id || plan.volumeNumber} className="book-planning-volume-card">
                      <img
                        className="book-planning-volume-image"
                        src={plan.cover_image || createVolumePosterDataUrl(`第${plan.volumeNumber}卷`)}
                        alt={`第${plan.volumeNumber}卷示意图`}
                      />
                      <div className="book-planning-volume-copy">
                        <strong>{`第 ${plan.volumeNumber} 卷`}</strong>
                        <p>{plan.volume_name || '未命名分卷'}</p>
                      </div>
                    </article>
                  ))}
                </div>
                {(planningState.bookPlanning.volumePlans || []).length === 0 ? (
                  <div className="book-planning-empty-note">
                    <p className="summary-state">暂无分卷信息</p>
                  </div>
                ) : (
                  null
                )}
              </div>
            </PanelCard>
          </div>
        ) : null}

        {activeStep === 'chapter' ? (
          <div className="panel-grid panel-grid-chapter">
            <PanelCard
              eyebrow="章节入口"
              title={'第 ' + chapterNumber + ' 章 · ' + (draftChapterPlan.chapter_name || '未命名章节')}
              description="这一层只处理本章要写什么。"
            >
              <div className="chapter-control-row">
                <label className="editor-field chapter-number-field">
                  <span>当前章号</span>
                  <input
                    className="chapter-number-input"
                    type="number"
                    min="1"
                    value={chapterNumber}
                    onChange={(event) => setChapterNumber(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <div className="chapter-context-note">{loadingChapter ? '正在读取本章计划...' : chapterContext.latestChapterLabel}</div>
              </div>
              <ul className="meta-list">
                <li>当前卷：{chapterView.volumeLabel || '第 1 卷'}</li>
                <li>主剧情线：{selectedMainStorylineLabel}</li>
                <li>章节任务：{draftChapterPlan.chapter_mission || '建议补充本章推进目标'}</li>
                <li>情绪目标：{draftChapterPlan.emotion_target || '建议补充本章情绪方向'}</li>
              </ul>
              {(chapterContext.previousFeedbackLabel || chapterContext.previousFeedbackFocus) ? (
                <div className="chapter-feedback-carryover">
                  <span>上一章反馈</span>
                  {chapterContext.previousFeedbackLabel ? <p>{chapterContext.previousFeedbackLabel}</p> : null}
                  {chapterContext.previousFeedbackFocus ? <p>{chapterContext.previousFeedbackFocus}</p> : null}
                </div>
              ) : null}
            </PanelCard>

            <PanelCard
              eyebrow="卷与剧情线"
              title="本章承接哪一层推进"
              description="主线像本章主任务，关联线像顺手推进的支线。"
              actions={
                <>
                  <button type="button" className="ghost-btn" onClick={openStorylineCreator} disabled={!selectedBookId}>
                    新建剧情线
                  </button>
                  <button type="button" className="ghost-btn" onClick={clearStorylineSelection} disabled={!selectedBookId || selectedTargetStorylines.length === 0}>
                    清空选择
                  </button>
                  <button type="button" className="solid-btn" onClick={handleSaveChapterPlan} disabled={!selectedBookId || savingState.loading}>
                    保存剧情线选择
                  </button>
                </>
              }
            >
              <ul className="meta-list">
                <li>卷级定位：{chapterView.volumeLabel || '第 1 卷'}</li>
                <li>卷内目标：{chapterView.volumeSummary || '暂无卷级说明'}</li>
                <li>主剧情线：{selectedMainStorylineLabel}</li>
                <li>关联剧情线：{selectedTargetStorylineLabel}</li>
              </ul>
              <div className="storyline-picker">
                <label className="editor-field">
                  <span>主推进剧情线</span>
                  <select
                    className="book-select storyline-select"
                    value={draftChapterPlan.main_storyline_id}
                    onChange={(event) => selectMainStoryline(event.target.value)}
                    disabled={storylineOptions.length === 0}
                  >
                    <option value="">暂不指定</option>
                    {storylineOptions.map((storyline) => (
                      <option key={storyline.id} value={storyline.id}>
                        第 {storyline.volumeNumber} 卷 · {storyline.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="editor-field">
                  <span>关联剧情线</span>
                  {storylineOptions.length > 0 ? (
                    <div className="storyline-checkbox-list">
                      {storylineOptions.map((storyline) => (
                        <label key={storyline.id} className="storyline-checkbox-item">
                          <input
                            type="checkbox"
                            checked={Array.isArray(draftChapterPlan.target_storylines) && draftChapterPlan.target_storylines.includes(storyline.id)}
                            onChange={() => toggleTargetStoryline(storyline.id)}
                          />
                          <span>
                            第 {storyline.volumeNumber} 卷 · {storyline.name}
                            <em>{storyline.type} · 预计第 {storyline.startChapter}-{storyline.endChapter} 章</em>
                          </span>
                          <button
                            type="button"
                            className="inline-link-btn storyline-edit-btn"
                            onClick={(event) => {
                              event.preventDefault();
                              openStorylineEditor(storyline);
                            }}
                          >
                            编辑
                          </button>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="excerpt-text">当前书籍还没有剧情线。可以先用演示书籍测试，再继续接剧情线创建入口。</p>
                  )}
                </div>
                {storylineRhythmHints.length > 0 ? (
                  <div className="storyline-rhythm-hints">
                    <span>节奏提示</span>
                    {storylineRhythmHints.map((hint) => (
                      <div key={hint.id} className="storyline-rhythm-hint-row">
                        <p>{hint.text}</p>
                        {hint.actionLabel ? (
                          <button
                            type="button"
                            className="inline-link-btn storyline-rhythm-action"
                            onClick={() => adjustStorylineRange(hint.storyline, hint.actionField)}
                            disabled={savingState.loading}
                          >
                            {hint.actionLabel}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </PanelCard>

            <PanelCard
              eyebrow="章节大纲"
              title="本章计划说明"
              description="正文生成前最重要的信息。"
              actions={<button type="button" className="solid-btn" onClick={() => setChapterModal('outline')}>编辑大纲</button>}
            >
              <span className="info-chip info-chip-required">必要信息</span>
              <p className="summary-state">{draftChapterPlan.outline_text ? '已填写' : '未填写'}</p>
              {draftChapterPlan.outline_text ? (
                <div className="structured-outline-summary">
                  <p><strong>本章目标：</strong>{draftChapterPlan.chapter_structure?.chapter_goal || draftChapterPlan.chapter_mission || '未填写'}</p>
                  <p><strong>关键场景：</strong>{draftChapterPlan.chapter_structure?.key_scenes || '未填写'}</p>
                  <p><strong>冲突升级：</strong>{draftChapterPlan.chapter_structure?.conflict_escalation || '未填写'}</p>
                  <p><strong>结尾钩子：</strong>{draftChapterPlan.chapter_structure?.ending_hook || draftChapterPlan.ending_hook || '未填写'}</p>
                </div>
              ) : (
                <p className="excerpt-text">还没有章节任务表。建议先写本章目标、关键场景、冲突升级和结尾钩子。</p>
              )}
            </PanelCard>

            <PanelCard
              eyebrow="章节角色"
              title="本章出场角色"
              description="有人物变化或新角色登场时再补。"
              actions={<button type="button" className="solid-btn" onClick={() => setChapterModal('character')}>编辑角色</button>}
            >
              <span className="info-chip info-chip-optional">建议信息</span>
              <p className="summary-state">{draftChapterPlan.character_notes ? '已补充' : '可留空'}</p>
              <p className="excerpt-text">{draftChapterPlan.character_notes || '还没有本章角色说明。'}</p>
              {Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0 ? (
                <div className="structured-outline-summary">
                  {draftChapterPlan.role_execution.slice(0, 3).map((item, index) => (
                    <div key={`${item.role || 'role'}-${index}`} className="role-execution-summary-item">
                      <p>
                        <strong>{item.role || '未命名角色'}：</strong>
                        {item.chapter_function || item.allowed_change || '本章角色执行要求待补充'}
                      </p>
                      <p className="summary-meta-text">{describeRoleExecutionMeta(item)}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </PanelCard>
          </div>
        ) : null}

        {activeStep === 'generate' ? (
          <div className="panel-grid panel-grid-generation">
            <PanelCard
              eyebrow="生成前"
              title={'开始第 ' + chapterNumber + ' 章'}
              description="按第二步的章节计划生成正文，这里只处理生成控制与生成前检查。"
              actions={
                <>
                  <button type="button" className="ghost-btn" onClick={() => setPromptPreviewOpen(true)}>查看生成摘要</button>
                  <button
                    type="button"
                    className="solid-btn"
                    onClick={handleGenerateChapter}
                    disabled={isGenerating || (generationRiskReview.hasCritical && !generationRiskConfirmed)}
                  >
                    {isGenerating ? '正在生成...' : '生成章节'}
                  </button>
                </>
              }
            >
              <div className="generation-chapter-switcher">
                <button type="button" className="ghost-btn" onClick={goToPreviousChapter} disabled={chapterNumber <= 1 || loadingChapter || isGenerating}>
                  上一章
                </button>
                <label className="editor-field generation-chapter-number-field">
                  <span>当前章号</span>
                  <input
                    className="chapter-number-input"
                    type="number"
                    min="1"
                    value={chapterNumber}
                    onChange={(event) => setChapterNumber(Math.max(1, Number(event.target.value) || 1))}
                    disabled={loadingChapter || isGenerating}
                  />
                </label>
                <button type="button" className="ghost-btn" onClick={goToNextChapter} disabled={loadingChapter || isGenerating}>
                  下一章
                </button>
              </div>
              <section className={'inline-status-banner is-' + generationReadiness.kind}>
                <strong>{generationReadiness.title}</strong>
                <span>{generationReadiness.text}</span>
              </section>
              <div className="generation-settings-row">
                <label className="editor-field generation-word-count-field">
                  <span>目标字数</span>
                  <input
                    className="chapter-number-input"
                    type="number"
                    min="500"
                    max="10000"
                    step="500"
                    value={getPlanWordCount(draftChapterPlan)}
                    onChange={(event) => updateGenerationSetting('word_count', Math.min(10000, Math.max(500, Number(event.target.value) || 3000)))}
                    disabled={loadingChapter || isGenerating}
                  />
                </label>
              </div>
              <BlockedConstraints
                generationConstraints={chapterContext.generationConstraints}
                constraintOverrides={constraintOverrides}
                setConstraintOverride={setConstraintOverride}
              />
              {generationRiskReview.items.length > 0 ? (
                <div className="generation-risk-review">
                  <div className="generation-risk-review-head">
                    <span>关键控制端点</span>
                    <p>这些地方一旦放松，最容易让章节失控、空降大设定或把人物推得过头。</p>
                  </div>
                  <div className="generation-risk-review-list">
                    {generationRiskReview.items.map((item, index) => (
                      <article key={`${item.title}-${index}`} className={`generation-risk-item is-${item.level}`}>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                        <p className="generation-risk-action">{item.action}</p>
                      </article>
                    ))}
                  </div>
                  {generationRiskReview.hasCritical ? (
                    <label className="generation-risk-confirm">
                      <input
                        type="checkbox"
                        checked={generationRiskConfirmed}
                        onChange={(event) => setGenerationRiskConfirmed(event.target.checked)}
                        disabled={isGenerating}
                      />
                      <span>我确认：本章已主动放开高风险禁止项，接受剧情掌控度会明显下降。</span>
                    </label>
                  ) : null}
                </div>
              ) : null}
              <div className="generation-brief">
                <div className="summary-group">
                  <p className="summary-group-title">计划引用</p>
                  <p className="excerpt-text">本次会直接按第二步已保存的章节计划生成；如需改目标、场景、角色或钩子，请先回第二步调整。</p>
                </div>
                <div className="summary-group">
                  <p className="summary-group-title">必填信息</p>
                  <div className="brief-check-list">
                    {generationRequiredItems.map((item) => (
                      <span key={item.key} className={'brief-check-item' + (hasText(item.value) ? ' is-ready' : ' is-missing')}>
                        {item.label}：{hasText(item.value) ? '已填写' : '未填写'}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="summary-group">
                  <p className="summary-group-title">建议补充</p>
                  <div className="brief-check-list">
                    {generationRecommendedItems.map((item) => (
                      <span key={item.key} className={'brief-check-item' + (hasText(item.value) ? ' is-ready' : ' is-missing')}>
                        {item.label}：{hasText(item.value) ? '已填写' : '可补充'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </PanelCard>

            <PanelCard
              eyebrow="生成后"
              title={generationState.hasContent ? '正文与下一章衔接' : '生成结果'}
              description="这里集中查看正文结果和下一章承接。"
              actions={<button type="button" className="solid-btn" onClick={openRevisionEditor} disabled={!generationState.hasContent}>查看/校改正文</button>}
            >
              <p className="summary-state">{generationState.metaText}</p>
              <p className="summary-substate">{generationState.wordCountLabel}</p>
              <p className="excerpt-text preview-excerpt-text">{generationState.previewText}</p>
              <span className="info-chip info-chip-optional">反馈来源：本地整理</span>
              <p className="excerpt-text">{generationState.feedbackSummary}</p>
              <p className="excerpt-text">{generationState.feedbackFocus}</p>
            </PanelCard>
          </div>
        ) : null}
      </section>

      {chapterModal === 'outline' ? (
        <Modal
          title={'编辑第 ' + chapterNumber + ' 章任务表'}
          description="把本章目标、关键场景、冲突升级和结尾钩子拆开写。系统会自动合成旧版章节大纲文本。"
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveChapterOutline} disabled={savingState.loading}>
                {savingState.loading ? '正在保存...' : '保存章节任务表'}
              </button>
            </>
          }
        >
          <div className="chapter-task-editor">
            <label className="editor-field">
              <span>章名</span>
              <input className="chapter-number-input text-input" value={draftChapterPlan.chapter_name} onChange={(event) => updateDraftChapterPlanField('chapter_name', event.target.value)} />
            </label>
            <label className="editor-field">
              <span>本章目标</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.chapter_goal || ''}
                onChange={(event) => updateChapterStructureField('chapter_goal', event.target.value)}
                placeholder="这一章必须完成什么推进？例如：逼主角首次公开动用禁血之力。"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>章节摘要</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.summary || ''}
                onChange={(event) => updateDraftChapterPlanField('summary', event.target.value)}
                placeholder="用一小段话概括本章实际会发生什么。"
              />
            </label>
            <label className="editor-field">
              <span>读者爽点 / 情绪落点</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.reader_payoff || ''}
                onChange={(event) => updateChapterStructureField('reader_payoff', event.target.value)}
                placeholder="这一章要给读者什么情绪？例如：压抑、反杀、危机升级、关系撕裂。"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>承接上一章</span>
              <textarea className="modal-textarea modal-textarea-compact" value={draftChapterPlan.previous_hook} onChange={(event) => updateDraftChapterPlanField('previous_hook', event.target.value)} />
            </label>
            <label className="editor-field editor-field-full">
              <span>关键场景</span>
              <textarea
                className="modal-textarea"
                value={draftChapterPlan.chapter_structure?.key_scenes || ''}
                onChange={(event) => updateChapterStructureField('key_scenes', event.target.value)}
                placeholder="一行一个场景。例如：荒原伏击压出危机；护人暴露能力；远处祭坛感应血月。"
              />
            </label>
            <label className="editor-field">
              <span>冲突升级</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.conflict_escalation || ''}
                onChange={(event) => updateChapterStructureField('conflict_escalation', event.target.value)}
                placeholder="这一章如何让矛盾变得更危险？"
              />
            </label>
            <label className="editor-field">
              <span>角色变化</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.character_change || ''}
                onChange={(event) => updateChapterStructureField('character_change', event.target.value)}
                placeholder="人物立场、关系、状态或认知发生什么变化？"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>本章出场角色</span>
              <textarea
                className="modal-textarea"
                value={normalizeRoleList(draftChapterPlan.appearing_roles).join('\n')}
                onChange={(event) => updateDraftChapterPlanField('appearing_roles', normalizeLines(event.target.value))}
                placeholder="每行一个角色名，或简单写角色组合。"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>结尾钩子</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.ending_hook || ''}
                onChange={(event) => updateChapterStructureField('ending_hook', event.target.value)}
                placeholder="这一章最后把读者钩在哪个点上？"
              />
            </label>
            <section className="outline-preview-block editor-field-full">
              <span>自动合成的大纲预览</span>
              <pre className="modal-pre">{draftChapterPlan.outline_text || '填完上面的结构化字段后，这里会自动生成章节大纲文本。'}</pre>
            </section>
            <label className="editor-field editor-field-full">
              <span>原始大纲微调</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.outline_text}
                onChange={(event) => updateDraftChapterPlanField('outline_text', event.target.value)}
                placeholder="一般不需要手改。只有想覆盖自动合成文本时再改这里。"
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {chapterModal === 'character' ? (
        <Modal
          title={'编辑第 ' + chapterNumber + ' 章角色'}
          description="只写这一章真正会出场、会影响推进的人物。"
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveChapterPlan} disabled={savingState.loading}>
                {savingState.loading ? '正在保存...' : '保存本章角色'}
              </button>
            </>
          }
        >
          <div className="outline-preview-stack">
            <textarea
              className="modal-textarea"
              value={draftChapterPlan.character_notes}
              onChange={(event) => updateDraftChapterPlanField('character_notes', event.target.value)}
              placeholder="例如：主角当前状态、关键配角立场、新增人物的作用。"
            />
            <section className="outline-preview-block editor-field-full">
              <span>章节角色执行层（v2）</span>
              <pre className="modal-pre">
                {Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0
                  ? draftChapterPlan.role_execution.map((item) => [
                    `角色：${item.role || '未命名角色'}`,
                    `当前底色：${item.baseline || '未填写'}`,
                    `本章功能：${item.chapter_function || '未填写'}`,
                    `参数层：${describeRoleExecutionMeta(item)}`,
                    `允许变化：${item.allowed_change || '未填写'}`,
                    `禁止变化：${item.forbidden_change || '未填写'}`
                  ].join('\n')).join('\n\n')
                  : '当前还没有角色执行拆解。系统会先按出场角色生成兜底版本，后续再接模型生成草稿。'}
              </pre>
            </section>
          </div>
        </Modal>
      ) : null}

      {chapterModal === 'storyline' ? (
        <Modal
          title={draftStoryline.id ? '编辑剧情线' : '新建剧情线'}
          description={draftStoryline.id
            ? '调整这条剧情线的预计节奏和核心冲突。章节范围只作参考，不会强制限制使用。'
            : '先创建这本书的一条主线或支线，然后自动挂到当前章节。章节范围只作节奏参考，不会强制限制剧情线使用。'}
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveStoryline} disabled={savingState.loading}>
                {savingState.loading
                  ? '正在保存...'
                  : draftStoryline.id ? '保存剧情线' : '创建并挂到当前章节'}
              </button>
            </>
          }
        >
          <div className="storyline-editor-grid">
            <label className="editor-field editor-field-full">
              <span>剧情线名称</span>
              <input
                className="chapter-number-input text-input"
                value={draftStoryline.storyline_name}
                onChange={(event) => updateDraftStorylineField('storyline_name', event.target.value)}
                placeholder="例如：血月之力暴露线"
              />
            </label>
            <label className="editor-field">
              <span>剧情线类型</span>
              <select
                className="book-select storyline-select"
                value={draftStoryline.storyline_type}
                onChange={(event) => updateDraftStorylineField('storyline_type', event.target.value)}
              >
                <option value="main">主线</option>
                <option value="branch">支线</option>
                <option value="emotion">情感线</option>
                <option value="conflict">冲突线</option>
              </select>
            </label>
            <label className="editor-field">
              <span>所属卷号</span>
              <input
                className="chapter-number-input text-input"
                type="number"
                min="1"
                value={draftStoryline.volume_number}
                onChange={(event) => updateDraftStorylineField('volume_number', Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label className="editor-field">
              <span>预计起始章</span>
              <input
                className="chapter-number-input text-input"
                type="number"
                min="1"
                value={draftStoryline.start_chapter}
                onChange={(event) => updateDraftStorylineField('start_chapter', Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label className="editor-field">
              <span>预计结束章</span>
              <input
                className="chapter-number-input text-input"
                type="number"
                min="1"
                value={draftStoryline.end_chapter}
                onChange={(event) => updateDraftStorylineField('end_chapter', Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>节奏说明</span>
              <p className="form-helper-text">
                这里填的是预计活跃范围。后续如果剧情提前爆发、延后回收或需要拆分，可以再调整，不会卡住正文生成。
              </p>
            </label>
            <label className="editor-field editor-field-full">
              <span>核心冲突</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftStoryline.core_conflict}
                onChange={(event) => updateDraftStorylineField('core_conflict', event.target.value)}
                placeholder="例如：主角越想隐藏力量，越会被逼在救人时暴露。"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>简要说明</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftStoryline.description}
                onChange={(event) => updateDraftStorylineField('description', event.target.value)}
                placeholder="这条线主要推进什么、牵涉哪些人物、最后落到什么结果。"
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {resultModalOpen ? (
        <Modal
          title={'第 ' + chapterNumber + ' 章正文校改'}
          description="直接修改当前章节正文，保存后会写回章节记录。"
          onClose={() => setResultModalOpen(false)}
          actions={
            <>
              {revisionError ? <div className="modal-error">{revisionError}</div> : null}
              {revisionNotice ? <div className="modal-success">{revisionNotice}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setResultModalOpen(false)}>取消</button>
              <button type="button" className="ghost-btn" onClick={handlePolishRevision} disabled={revisionPolishing || revisionSaving}>
                {revisionPolishing ? '正在分析...' : '生成局部建议'}
              </button>
              <button type="button" className="solid-btn" onClick={handleSaveRevision} disabled={revisionSaving}>
                {revisionSaving ? '正在保存...' : '保存校改'}
              </button>
            </>
          }
        >
          <div className="revision-editor">
            <label className="editor-field">
              <span>校改目标</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={revisionRequirement}
                onChange={(event) => setRevisionRequirement(event.target.value)}
                placeholder="例如：增强画面感、删除重复解释、加强结尾钩子。"
              />
            </label>
            <div className="revision-editor-meta">
              <span>原文 {revisionOriginal.length} 字</span>
              <span>校改稿 {revisionDraft.length} 字</span>
              <span>{generationState.metaText}</span>
            </div>
            {revisionChangeItems.length > 0 ? (
              <div className="revision-change-nav">
              <div className="revision-change-nav-info">
                  <strong>修改导航</strong>
                  <span>{revisionCurrentChange ? revisionCurrentChange.label : '已找到修改点'}</span>
                  <em>{revisionCurrentFocusIndex + 1} / {revisionChangeItems.length}</em>
                </div>
                <div className="revision-change-nav-actions">
                  <button type="button" className="ghost-btn" onClick={() => focusRevisionChange(-1)}>
                    上一处修改
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => focusRevisionChange(1)}>
                    下一处修改
                  </button>
                </div>
              </div>
            ) : null}
            <section className="revision-original-panel">
              <div className="revision-original-head">
                <span>原文标注</span>
                <em>{revisionOriginal.length} 字</em>
              </div>
              <div className="revision-original-list">
                {revisionOriginalParagraphs.length > 0 ? revisionOriginalParagraphs.map((paragraph, index) => {
                  const paragraphNumber = index + 1;
                  const replaceSuggestion = revisionSuggestionMarks.replaceByParagraph.get(paragraphNumber);
                  const deleteSuggestion = revisionSuggestionMarks.deleteByParagraph.get(paragraphNumber);
                  const insertSuggestions = revisionSuggestionMarks.insertAfterParagraph.get(paragraphNumber) || [];
                  const hasReplace = !!replaceSuggestion;
                  const hasDelete = !!deleteSuggestion;
                  const hasInsert = insertSuggestions.length > 0;
                  const changeKey = hasDelete
                    ? 'delete-' + paragraphNumber
                    : hasReplace
                      ? 'replace-' + paragraphNumber
                      : null;
                  const insertChangeKeys = insertSuggestions.map((_, insertIndex) => 'insert-' + paragraphNumber + '-' + insertIndex);
                  const isCurrentChange = changeKey && revisionCurrentChange?.key === changeKey;
                  const originalText = paragraph || '（空段）';
                  return (
                    <Fragment key={index + '-' + paragraph.slice(0, 16)}>
                      <article
                        className={'revision-original-paragraph' + (hasReplace ? ' is-replace' : '') + (hasDelete ? ' is-delete' : '') + (isCurrentChange ? ' is-revision-focus' : '')}
                        ref={(element) => {
                          registerRevisionChangeRef(changeKey, element);
                          registerRevisionParagraphRef(paragraphNumber, element);
                        }}
                      >
                        <div className="revision-original-paragraph-head">
                          <span className="revision-paragraph-tag">第 {paragraphNumber} 段</span>
                          <div className="revision-paragraph-badges">
                            {hasReplace ? <strong className="revision-paragraph-badge is-replace">修改</strong> : null}
                            {hasDelete ? <strong className="revision-paragraph-badge is-delete">删除</strong> : null}
                            {!hasReplace && !hasDelete && hasInsert ? <strong className="revision-paragraph-badge is-insert">新增</strong> : null}
                          </div>
                          <div className="revision-paragraph-actions">
                            {replaceSuggestion ? (
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={revisionAppliedChangeKeys.includes(changeKey)}
                                onClick={() => applyRevisionSuggestion(replaceSuggestion, changeKey)}
                              >
                                {revisionAppliedChangeKeys.includes(changeKey) ? '已应用修改' : '应用修改'}
                              </button>
                            ) : null}
                            {deleteSuggestion ? (
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={revisionAppliedChangeKeys.includes(changeKey)}
                                onClick={() => applyRevisionSuggestion(deleteSuggestion, changeKey)}
                              >
                                {revisionAppliedChangeKeys.includes(changeKey) ? '已应用删除' : '应用删除'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {hasDelete ? (
                          <div className="revision-original-change is-delete">
                            <p className="revision-original-change-original"><s>{originalText}</s></p>
                            <p className="revision-original-change-new">（删除后保留空段）</p>
                          </div>
                        ) : hasReplace ? (
                          <div className="revision-original-change is-replace">
                            <p className="revision-original-change-original"><s>{originalText}</s></p>
                            <p className="revision-original-change-new">{replaceSuggestion.suggested_text}</p>
                          </div>
                        ) : (
                          <p className="revision-paragraph-text">{originalText}</p>
                        )}
                      </article>
                      {hasInsert ? insertSuggestions.map((suggestion, insertIndex) => (
                        (() => {
                          const insertChangeKey = insertChangeKeys[insertIndex];
                          const isCurrentInsertChange = revisionCurrentChange?.key === insertChangeKey;
                          return (
                        <article
                          className={'revision-original-paragraph is-insert' + (isCurrentInsertChange ? ' is-revision-focus' : '')}
                          key={paragraphNumber + '-insert-' + insertIndex}
                          ref={(element) => registerRevisionChangeRef(insertChangeKey, element)}
                        >
                          <div className="revision-original-paragraph-head">
                            <span className="revision-paragraph-tag">第 {paragraphNumber} 段后新增</span>
                            <div className="revision-paragraph-badges">
                               <strong className="revision-paragraph-badge is-insert">新增</strong>
                            </div>
                            <div className="revision-paragraph-actions">
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={revisionAppliedChangeKeys.includes(insertChangeKey)}
                                onClick={() => applyRevisionSuggestion(suggestion, insertChangeKey)}
                              >
                                {revisionAppliedChangeKeys.includes(insertChangeKey) ? '已应用新增' : '应用新增'}
                              </button>
                            </div>
                          </div>
                          <div className="revision-original-change is-insert">
                            <p className="revision-original-change-new">{suggestion.suggested_text}</p>
                          </div>
                        </article>
                          );
                        })()
                      )) : null}
                    </Fragment>
                  );
                }) : (
                  <p className="revision-original-empty">当前还没有正文结果。</p>
                )}
              </div>
            </section>
          </div>
        </Modal>
      ) : null}

      {promptPreviewOpen ? (
        <Modal
          title={'第 ' + chapterNumber + ' 章生成摘要'}
          description="这里展示生成前会优先参考的核心上下文。"
          onClose={() => setPromptPreviewOpen(false)}
          actions={<button type="button" className="solid-btn" onClick={() => setPromptPreviewOpen(false)}>知道了</button>}
        >
          <div className="outline-preview-stack prompt-preview-stack">
              <section className={'inline-status-banner is-' + generationReadiness.kind}>
              <strong>{generationReadiness.title}</strong>
              <span>{generationReadiness.text}</span>
            </section>
            <section className="outline-preview-block">
              <span>章节目标</span>
              <pre className="modal-pre">
                {[
                  '章名：' + (draftChapterPlan.chapter_name || '未命名章节'),
                  '本章目标：' + (chapterStructure.chapter_goal || '暂无填写'),
                  '关键场景：' + (chapterStructure.key_scenes || '暂无填写'),
                  '冲突升级：' + (chapterStructure.conflict_escalation || '暂无填写'),
                  '角色变化：' + (chapterStructure.character_change || '暂无填写'),
                  '情绪落点：' + (chapterStructure.reader_payoff || '暂无填写'),
                  '结尾钩子：' + (chapterStructure.ending_hook || draftChapterPlan.ending_hook || '暂无填写')
                ].join('\n')}
              </pre>
            </section>
            <section className="outline-preview-block">
              <span>剧情线承接</span>
              <pre className="modal-pre">
                {[
                  '主剧情线：' + selectedMainStorylineLabel,
                  '关联剧情线：' + selectedTargetStorylineLabel,
                  '节奏提示：' + (storylineRhythmHints.length > 0 ? storylineRhythmHints.map((hint) => '- ' + hint.text).join(' | ') : '暂无挂接剧情线')
                ].join('\n')}
              </pre>
            </section>
            <section className="outline-preview-block">
              <span>自动合成大纲</span>
              <pre className="modal-pre">{draftChapterPlan.outline_text || '暂无填写本章大纲。'}</pre>
            </section>
            <section className="outline-preview-block">
              <span>本章角色</span>
              <pre className="modal-pre">
                {[
                  draftChapterPlan.character_notes || '暂无补充本章角色说明。',
                  '',
                  '角色执行参数：',
                  Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0
                    ? draftChapterPlan.role_execution.map((item) => `- ${item.role || '未命名角色'}｜${describeRoleExecutionMeta(item)}｜${item.forbidden_change || '暂无禁止项'}`).join('\n')
                    : '- 暂无角色执行参数'
                ].join('\n')}
              </pre>
            </section>
            <section className="outline-preview-block">
              <span>高风险提醒</span>
              <pre className="modal-pre">
                {generationRiskReview.items.length > 0
                  ? generationRiskReview.items.map((item) => `- [${item.level === 'critical' ? '高风险' : '提醒'}] ${item.title}：${item.text}`).join('\n')
                  : '当前没有额外高风险提醒。'}
              </pre>
            </section>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
