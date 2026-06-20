export function normalizeParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}|\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function splitRevisionParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}|\r?\n/)
    .map((line) => line.trim());
}

export function applyRevisionSuggestionToDraft({
  revisionDraft,
  revisionOriginal,
  suggestion
}) {
  const baseContent = String(revisionDraft || revisionOriginal || '').trim();
  if (!baseContent) {
    return { error: '没有可编辑的正文。' };
  }

  const paragraphs = splitRevisionParagraphs(baseContent);
  const mode = suggestion?.action;
  const replacement = String(suggestion?.suggested_text || '').trim();
  const focusParagraph = Number(suggestion?.paragraph || suggestion?.afterParagraph || 1) || 1;
  let nextParagraphs = [...paragraphs];

  if (mode === 'replace') {
    if (!replacement) {
      return { error: '这条修改没有可写入的正文。' };
    }
    const paragraphIndex = Number(suggestion?.paragraph || 0) - 1;
    if (paragraphIndex < 0 || paragraphIndex >= nextParagraphs.length) {
      return { error: '替换段落编号超出范围。' };
    }
    nextParagraphs[paragraphIndex] = replacement;
  } else if (mode === 'insert_after') {
    if (!replacement) {
      return { error: '这条新增没有可写入的正文。' };
    }
    const anchorIndex = Number(suggestion?.afterParagraph || suggestion?.paragraph || 0) - 1;
    if (anchorIndex < 0 || anchorIndex >= nextParagraphs.length) {
      return { error: '插入位置超出范围。' };
    }
    nextParagraphs.splice(anchorIndex + 1, 0, replacement);
  } else if (mode === 'delete') {
    const paragraphIndex = Number(suggestion?.paragraph || 0) - 1;
    if (paragraphIndex < 0 || paragraphIndex >= nextParagraphs.length) {
      return { error: '删除段落编号超出范围。' };
    }
    nextParagraphs[paragraphIndex] = '';
  } else {
    return { error: '不支持的建议类型。' };
  }

  return {
    nextDraft: nextParagraphs.join('\n\n'),
    focusParagraph
  };
}

export function buildRevisionSessionState(content) {
  const currentContent = String(content || '');
  return {
    revisionOriginal: currentContent,
    revisionDraft: currentContent,
    revisionSuggestions: null,
    revisionError: '',
    revisionNotice: '',
    revisionFocusIndex: 0,
    revisionAppliedChangeKeys: []
  };
}

export function resolveRevisionSuggestionsResponse(response) {
  const suggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];
  const hasUsablePayload = Boolean(
    response && (
      suggestions.length > 0
      || response.regeneration_notes
      || response.raw_content
    )
  );

  if (!hasUsablePayload) {
    return { error: '校改接口没有返回可用建议。' };
  }

  return {
    suggestions,
    notice: '已生成局部修改建议，正文不会自动替换，请挑选可用改动手动写入校改稿。'
  };
}

export function normalizeRevisionText(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

export function normalizeSentences(text) {
  return normalizeParagraphs(text)
    .flatMap((paragraph) => paragraph.match(/[^。！？!?]+[。！？!?]?/g) || [paragraph])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function similarityScore(left, right) {
  const leftSet = new Set(String(left || '').replace(/\s+/g, '').split(''));
  const rightSet = new Set(String(right || '').replace(/\s+/g, '').split(''));
  if (leftSet.size === 0 || rightSet.size === 0) return 0;
  let overlap = 0;
  leftSet.forEach((char) => {
    if (rightSet.has(char)) overlap += 1;
  });
  return overlap / Math.max(leftSet.size, rightSet.size);
}

export function buildRevisionDiff(original, draft) {
  const originalParagraphs = normalizeParagraphs(original);
  const draftParagraphs = normalizeParagraphs(draft);
  const maxLength = Math.max(originalParagraphs.length, draftParagraphs.length);

  return Array.from({ length: maxLength }, (_, index) => {
    const before = originalParagraphs[index] || '';
    const after = draftParagraphs[index] || '';
    if (before && after && before === after) {
      return { id: index, type: 'same', label: '未改', before, after };
    }
    if (!before && after) {
      return { id: index, type: 'added', label: '新增', before, after };
    }
    if (before && !after) {
      return { id: index, type: 'removed', label: '删除', before, after };
    }
    const score = similarityScore(before, after);
    return {
      id: index,
      type: score > 0.45 ? 'changed' : 'rewritten',
      label: score > 0.45 ? '改写' : '重写',
      before,
      after
    };
  });
}

export function buildRevisionSentenceDiff(original, draft) {
  const originalSentences = normalizeSentences(original);
  const draftSentences = normalizeSentences(draft);
  const maxLength = Math.max(originalSentences.length, draftSentences.length);

  return Array.from({ length: maxLength }, (_, index) => {
    const before = originalSentences[index] || '';
    const after = draftSentences[index] || '';
    if (before && after && before === after) {
      return { id: index, type: 'same', label: '未改', before, after };
    }
    if (!before && after) {
      return { id: index, type: 'added', label: '新增', before, after };
    }
    if (before && !after) {
      return { id: index, type: 'removed', label: '删除', before, after };
    }
    const score = similarityScore(before, after);
    return {
      id: index,
      type: score > 0.5 ? 'changed' : 'rewritten',
      label: score > 0.5 ? '改写' : '重写',
      before,
      after
    };
  });
}

export function buildRevisionEvaluation(original, draft, diffItems) {
  const originalLength = String(original || '').length;
  const draftLength = String(draft || '').length;
  const originalParagraphs = normalizeParagraphs(original).length;
  const draftParagraphs = normalizeParagraphs(draft).length;
  const changedItems = diffItems.filter((item) => item.type !== 'same');
  const changedRatio = diffItems.length ? changedItems.length / diffItems.length : 0;
  const lengthRatio = originalLength ? draftLength / originalLength : 1;
  const issues = [];
  const gains = [];

  if (changedRatio < 0.12) {
    issues.push('变化幅度很小，可能只是替换措辞，整体价值有限。');
  } else if (changedRatio > 0.65) {
    issues.push('变化幅度很大，建议重点检查剧情事实、人物语气和节奏是否被改偏。');
  } else {
    gains.push('有一定实质改动，适合人工挑选保留。');
  }

  if (lengthRatio > 1.18) {
    issues.push('校改稿明显变长，可能增加解释和赘述。');
  } else if (lengthRatio < 0.82) {
    issues.push('校改稿明显变短，可能删掉了铺垫、情绪或动作细节。');
  } else {
    gains.push('字数变化较克制，没有明显膨胀或缩水。');
  }

  if (Math.abs(draftParagraphs - originalParagraphs) >= 3) {
    issues.push('段落结构变化较大，阅读节奏可能已经被重排。');
  }

  const verdict = issues.length === 0
    ? '值得保留'
    : changedRatio < 0.12
      ? '价值偏低'
      : '只适合参考';
  const action = verdict === '值得保留'
    ? '可以通读全文后决定是否保留。'
    : '不建议整版直接保存，先挑选局部可用改动。';

  return {
    verdict,
    action,
    changedCount: changedItems.length,
    totalCount: diffItems.length,
    originalLength,
    draftLength,
    originalParagraphs,
    draftParagraphs,
    gains: gains.slice(0, 3),
    issues: issues.slice(0, 3)
  };
}

export function buildLocalChapterFeedback({
  content,
  plan,
  chapterStructure,
  mainStorylineLabel,
  targetStorylineLabel,
  rhythmHints
}) {
  const contentPreview = String(content || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const storyProgress = [
    chapterStructure.chapter_goal ? `完成本章目标：${chapterStructure.chapter_goal}` : '',
    mainStorylineLabel && mainStorylineLabel !== '暂未指定' ? `主线推进：${mainStorylineLabel}` : '',
    targetStorylineLabel && targetStorylineLabel !== '暂未挂接' ? `关联剧情线：${targetStorylineLabel}` : ''
  ].filter(Boolean);
  const rhythmText = Array.isArray(rhythmHints)
    ? rhythmHints.map((hint) => hint.text).filter(Boolean).join('\n')
    : '';

  return {
    chapter_summary: contentPreview || '本章已生成正文。',
    story_progress: storyProgress.join('\n') || chapterStructure.key_scenes || '',
    character_changes: chapterStructure.character_change || plan.character_notes || '',
    emotion_result: chapterStructure.reader_payoff || plan.emotion_target || '',
    open_hooks: chapterStructure.ending_hook || plan.ending_hook || '',
    next_chapter_focus: chapterStructure.ending_hook || plan.ending_hook || '承接本章结果，继续推进主要冲突。',
    continuity_report: {
      new_characters: [],
      new_elements: [],
      must_carry_forward: [chapterStructure.ending_hook || plan.ending_hook || '承接本章结果，继续推进主要冲突。'].filter(Boolean),
      continuity_risks: []
    },
    rhythm_notes: rhythmText,
    source: 'local_generation',
    generated_at: new Date().toISOString()
  };
}
