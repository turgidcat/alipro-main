function normalizeText(value) {
  return String(value || '').trim();
}

function parseObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalizeRequirements(value) {
  return normalizeArray(value)
    .map((item) => normalizeText(typeof item === 'string' ? item : item?.summary || item?.title || item?.text))
    .filter(Boolean)
    .slice(0, 6);
}

function collectOpeningLocationCandidates(text = '') {
  const source = String(text || '');
  const found = [];
  const pattern = /([\u4e00-\u9fa5]{1,12}(?:镇|林地|树林|山道|山坡|街口|石门|甬道|院落|界碑|宗门|雾门|屋里|屋外|门口))/g;
  const genericLocations = new Set(['镇', '全镇', '本镇', '镇上', '镇里', '林地', '树林', '山道', '山坡', '街口', '石门', '甬道', '院落', '界碑', '宗门', '雾门', '屋里', '屋外', '门口', '前门口', '后门口']);
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const candidate = normalizeText((match[1] || '')
      .replace(/^.*(?:站在|坐在|走到|来到|赶往|前往|进入|回到|抵达|经过|离开|从|向|往|出|进|在|见|说)/, '')
      .replace(/^(这片|那片|这座|那座|这道|那道|这间|那间|这条|那条)/, ''));
    if (!candidate || genericLocations.has(candidate)) continue;
    if (/(?:我|你|他|她|它|谁|说|站|坐|走|出|进|回|到|在|见|看|听|没|有|是|把|被|让|从|向|今早|昨晚|的人)/.test(candidate)) continue;
    found.push(candidate);
  }
  return [...new Set(found)].slice(0, 6);
}

function isNoisyCountFactNoun(value = '') {
  return new Set(['人', '东西', '声音', '时候', '地方', '问题', '事情', '一点', '一下', '一眼', '下', '招', '步', '声', '遍', '回', '口', '眼', '息', '天', '年', '月', '日', '时']).has(normalizeText(value));
}

function formatAuditLedgerSnapshot(snapshot = {}) {
  const characterLines = (Array.isArray(snapshot.characterRows) ? snapshot.characterRows : []).slice(0, 12).map((item) =>
    `第${item.chapter_number}章｜角色 ${item.character_name}｜${[item.state_text, item.relationship_text, item.note_text].filter(Boolean).join('；')}`
  );
  const factLines = (Array.isArray(snapshot.continuityRows) ? snapshot.continuityRows : []).slice(0, 12).map((item) =>
    `第${item.chapter_number}章｜事实｜${item.fact_text}`
  );
  const hookLines = (Array.isArray(snapshot.foreshadowRows) ? snapshot.foreshadowRows : []).slice(0, 12).map((item) =>
    `第${item.chapter_number}章｜伏笔 ${item.foreshadow_key}｜${item.title}｜${item.state}`
  );
  return [...characterLines, ...factLines, ...hookLines].join('\n');
}

function isAffirmativeAuditRisk(value) {
  const text = normalizeText(value);
  if (!text) return false;
  const looksLikeOpenMystery = /(原因|缘由|身份|来历|真相|为何|为什么|记忆缺失).{0,30}(?:未.{0,8}(?:明确|解释|揭示|交代)|不明|缺乏直接证据)/.test(text)
    || /(?:未.{0,8}(?:明确|解释|揭示|交代)|不明|缺乏直接证据).{0,30}(原因|缘由|身份|来历|真相|为何|为什么|记忆缺失)/.test(text);
  const claimsContradiction = /(矛盾|冲突|与.{0,30}不一致|前文.{0,20}(?:明确|已经|曾经))/.test(text);
  if (looksLikeOpenMystery && !claimsContradiction) return false;
  return !(
    /(不构成|不属于|不算|无需|无须|未发现|可以排除|可排除).{0,12}(问题|风险|矛盾|冲突|异常|复核)/.test(text)
    || /无(?:任何|实质|明显|直接)?(?:问题|风险|矛盾|冲突)/.test(text)
    || /未与.{0,30}(?:事实)?(?:矛盾|冲突)/.test(text)
  );
}

function collectLedgerDenialConflicts(content = '', snapshot = {}) {
  const text = normalizeText(content);
  if (!text) return [];
  const contactPattern = /(交锋|接触|见过|会面|相识|认识|对话|碰面|见面|打过交道|有交集)/;
  const denialPattern = /(?:听过.{0,10}(?:这个)?名字.{0,10}(?:没有|吗)|听说过.{0,10}(?:没有|吗)|认不认识|认识吗)[\s\S]{0,40}(?:摇头|没听过|未听过|不认识|第一次听)/g;
  const rows = Array.isArray(snapshot.characterRows) ? snapshot.characterRows : [];
  const earliestContacts = new Map();

  rows.forEach((item) => {
    const name = normalizeText(item.character_name);
    const priorState = [item.state_text, item.relationship_text, item.note_text].map(normalizeText).join('；');
    if (!name || !contactPattern.test(priorState)) return;
    const chapterNumber = Number(item.chapter_number || 0) || 0;
    const existing = earliestContacts.get(name);
    if (!existing || (chapterNumber > 0 && chapterNumber < existing.chapterNumber)) {
      earliestContacts.set(name, { chapterNumber, priorState });
    }
  });

  const risks = [];
  let denialMatch;
  while ((denialMatch = denialPattern.exec(text)) !== null) {
    const nearest = [...earliestContacts.entries()].map(([name, contact]) => ({
      name,
      contact,
      index: text.lastIndexOf(name, denialMatch.index)
    })).filter((item) => item.index >= 0 && denialMatch.index - item.index <= 120)
      .sort((left, right) => right.index - left.index)[0];
    if (!nearest) continue;
    risks.push(`当前章称对“${nearest.name}”没听过或不认识，但第${nearest.contact.chapterNumber}章账本记录双方已接触。`);
  }
  return risks.slice(0, 5);
}

function isVagueRequirement(value) {
  const text = normalizeText(value).replace(/[，。！？、；：,.!?;:\s]/g, '');
  if (text.length < 6) return true;
  return /^(推进|继续|发展|过渡|铺垫|承接|剧情推进|故事发展|人物成长|制造冲突|展开剧情)$/.test(text);
}

function evaluateChapterPlanQuality({ chapterPlan = {}, outline = '', chapterNumber = 0 } = {}) {
  const structured = parseObject(chapterPlan.structured_content);
  const storyline = parseObject(structured.storyline_context);
  const finalOutline = normalizeText(outline || chapterPlan.outline_text);
  const mission = normalizeText(chapterPlan.chapter_mission || structured.chapter_mission || chapterPlan.summary);
  const explicitMustAdvance = normalizeRequirements(
    storyline.mustAdvance || storyline.must_advance || structured.mustAdvance || structured.must_advance
  );
  const mustAdvance = explicitMustAdvance.length > 0 ? explicitMustAdvance : (mission ? [mission] : []);
  const mustNotHappen = normalizeRequirements(
    storyline.mustNotHappen || storyline.must_not_happen || structured.mustNotHappen || structured.must_not_happen
  );
  const appearingRoles = normalizeArray(chapterPlan.appearing_roles).map(normalizeText).filter(Boolean);
  const issues = [];
  const add = (code, severity, message, evidence = '') => issues.push({ code, severity, message, evidence });

  if (!finalOutline) {
    add('PLAN_OUTLINE_MISSING', 'block', '章节细纲为空，无法约束正文生成。');
  } else if (finalOutline.replace(/\s/g, '').length < 40) {
    add('PLAN_OUTLINE_TOO_THIN', 'block', '章节细纲过短，缺少可执行的场景与事件。', finalOutline);
  }
  if (!mission) add('PLAN_MISSION_MISSING', 'block', '章节任务为空，无法判断本章是否真正推进。');
  if (mustAdvance.length === 0) {
    add('PLAN_MUST_ADVANCE_MISSING', 'block', '本章没有 mustAdvance，无法建立可验收的推进目标。');
  } else if (explicitMustAdvance.length === 0) {
    add('PLAN_MUST_ADVANCE_DERIVED', 'review', '旧规划未单独填写 mustAdvance，已使用明确章节任务作为验收目标。', mission);
  }
  mustAdvance.filter(isVagueRequirement).forEach((item) => {
    add('PLAN_MUST_ADVANCE_VAGUE', 'block', 'mustAdvance 过于空泛，必须改成可观察的动作或结果。', item);
  });
  const contradictions = mustAdvance.filter((advance) => mustNotHappen.some((forbidden) => (
    advance.includes(forbidden) || forbidden.includes(advance)
  )));
  contradictions.forEach((item) => {
    add('PLAN_CONSTRAINT_CONFLICT', 'block', 'mustAdvance 与 mustNotHappen 相互冲突。', item);
  });
  if (Number(chapterNumber || 0) > 1 && appearingRoles.length === 0) {
    add('PLAN_ROLES_MISSING', 'review', '章节没有挂接出场角色，人物状态检查可能失去依据。');
  }
  if (storyline.isFallback) {
    add('PLAN_STORYLINE_FALLBACK', 'review', '剧情线约束来自降级数据，建议人工确认后再批量生成。');
  }

  const blockingIssues = issues.filter((item) => item.severity === 'block');
  return {
    status: blockingIssues.length > 0 ? 'blocked' : (issues.length > 0 ? 'review' : 'passed'),
    can_generate: blockingIssues.length === 0,
    mission,
    must_advance: mustAdvance,
    must_advance_source: explicitMustAdvance.length > 0 ? 'storyline_context' : (mustAdvance.length > 0 ? 'chapter_mission' : 'missing'),
    must_not_happen: mustNotHappen,
    appearing_roles: appearingRoles,
    issues,
    blocking_issue_codes: blockingIssues.map((item) => item.code)
  };
}

function qualityGateScore(audit = {}) {
  const verdict = normalizeText(audit.verdict).toLowerCase();
  const planStatus = normalizeText(audit?.plan_anchor_audit?.status).toLowerCase();
  const outlineStatus = normalizeText(audit?.outline_coverage_audit?.status).toLowerCase();
  const deterministicStatus = normalizeText(audit?.deterministic_check?.status).toLowerCase();
  const rank = verdict === 'stable' ? 0 : (verdict === 'needs_review' ? 1 : 2);
  const planRank = planStatus === 'passed' || planStatus === 'not_applicable' ? 0 : (planStatus === 'needs_review' ? 1 : 2);
  const outlineRank = outlineStatus === 'passed' || outlineStatus === 'not_applicable' ? 0 : (outlineStatus === 'needs_review' ? 1 : 2);
  const deterministicRank = deterministicStatus === 'passed' ? 0 : (deterministicStatus === 'review' ? 1 : 2);
  return rank * 100 + planRank * 20 + outlineRank * 20 + deterministicRank * 20 + normalizeArray(audit.risks).length;
}

function shouldAcceptQualityRepair(before = {}, after = {}) {
  return qualityGateScore(after) < qualityGateScore(before)
    && normalizeText(after?.deterministic_check?.status).toLowerCase() !== 'blocked';
}

function evaluatePreviousChapterRelease({ chapterNumber = 0, previousChapter = null, previousFeedback = null } = {}) {
  if (Number(chapterNumber || 0) <= 1) return { status: 'not_applicable', can_continue: true, issues: [] };
  const issues = [];
  const add = (code, message) => issues.push({ code, severity: 'block', message });
  if (!previousChapter || !normalizeText(previousChapter.content)) {
    add('PREVIOUS_CHAPTER_MISSING', '上一章正文不存在，不能跳章自动生成。');
  }
  const quality = parseObject(previousFeedback?.quality_check);
  if (Object.keys(quality).length === 0) {
    add('PREVIOUS_CHAPTER_AUDIT_MISSING', '上一章尚未完成质量审计。');
  } else {
    // 用户已在创作台人工确认放行：跳过上一章质量门禁
    if (quality.human_confirmed) {
      return {
        status: 'passed',
        can_continue: true,
        issues: [],
        human_confirmed: true
      };
    }
    if (normalizeText(quality.status) !== 'passed' || normalizeText(quality.verdict) !== 'stable') {
      add('PREVIOUS_CHAPTER_QUALITY_NOT_PASSED', '上一章质量审计未通过。');
    }
    if (quality.needs_human_review) add('PREVIOUS_CHAPTER_REVIEW_REQUIRED', '上一章仍需人工复核。');
    const planStatus = normalizeText(quality?.plan_anchor_audit?.status);
    if (!['passed', 'not_applicable'].includes(planStatus)) add('PREVIOUS_CHAPTER_PLAN_NOT_PASSED', '上一章计划锚点未通过。');
    const wordStatus = normalizeText(quality?.word_count_audit?.status);
    if (!['passed', 'not_applicable'].includes(wordStatus)) add('PREVIOUS_CHAPTER_WORD_COUNT_NOT_PASSED', '上一章字数门禁未通过。');
    const storylineStatus = normalizeText(quality?.storyline_audit?.status);
    if (!['passed', 'advanced', 'not_applicable'].includes(storylineStatus)) add('PREVIOUS_CHAPTER_STORYLINE_NOT_PASSED', '上一章剧情线推进未通过。');
  }
  return {
    status: issues.length > 0 ? 'blocked' : 'passed',
    can_continue: issues.length === 0,
    issues,
    blocking_issue_codes: issues.map((item) => item.code)
  };
}

module.exports = {
  collectLedgerDenialConflicts,
  collectOpeningLocationCandidates,
  evaluateChapterPlanQuality,
  evaluatePreviousChapterRelease,
  formatAuditLedgerSnapshot,
  isAffirmativeAuditRisk,
  isNoisyCountFactNoun,
  qualityGateScore,
  shouldAcceptQualityRepair
};
