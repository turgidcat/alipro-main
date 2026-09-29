const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../routes/ai.js'), 'utf8');
function fixture(reply) {
  let calls = 0;
  const scope = {
    normalizeText: value => String(value ?? '').trim(),
    normalizeJsonArray: value => Array.isArray(value) ? value : [],
    buildPersistedStorylineContext: value => value,
    ROLE_TIER_LABELS: { protagonist: '主角' },
    tryParseJsonObject: value => { try { return JSON.parse(value); } catch { return null; } },
    runTextGeneration: async () => { calls++; return reply; }
  };
  vm.createContext(scope);
  for (const name of ['buildOutlineCharacterCards', 'buildOutlineStorylineConstraintText', 'buildDraftStorylineConstraintText', 'mergeOutlineContextNotes', 'getOutlineInputLimitError', 'formatOutlineInput', 'buildOutlinePrompt', 'auditGeneratedOutlineAgainstStorylineContext', 'auditOutlineEventDensity', 'auditOutlineRoleContinuity', 'handleOutlineGeneration']) {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    const rest = source.slice(start);
    const end = rest.search(/\n(?:async )?function /);
    vm.runInContext(rest.slice(0, end), scope);
  }
  return { scope, calls: () => calls };
}
test('length bounds are deterministic and do not ask a model', async () => {
  const f = fixture({ success: true, content: '{}' });
  for (const size of [0, 219, 401, 1100]) assert.equal((await f.scope.auditOutlineEventDensity('字'.repeat(size))).status, 'overloaded');
  assert.equal(f.calls(), 0);
});
test('audit failures and malformed JSON never pass', async () => {
  for (const reply of [{ success: false, error: 'offline' }, { success: true, content: '{}' }, { success: true, content: 'invalid' }]) {
    const { scope } = fixture(reply);
    assert.equal((await scope.auditGeneratedOutlineAgainstStorylineContext('细纲', { mustAdvance: ['救援'] }, 12)).status, 'unverified');
    assert.equal((await scope.auditOutlineEventDensity('字'.repeat(220))).status, 'unverified');
    assert.equal((await scope.auditOutlineRoleContinuity('细纲')).status, 'unverified');
  }
});
test('planning conflicts and unsupported abilities override claimed approval', async () => {
  let f = fixture({ success: true, content: JSON.stringify({ status: 'passed', missingSetup: [], triggeredForbidden: [], planningConflicts: ['被俘角色不能同时救援'] }) });
  assert.equal((await f.scope.auditGeneratedOutlineAgainstStorylineContext('细纲', { mustAdvance: ['救援'] }, 12)).status, 'needs_revision');
  f = fixture({ success: true, content: JSON.stringify({ status: 'ok', airdropRoles: [], stateConflicts: [], unsupportedSettings: ['洞箫定位没有依据'], suggestions: [] }) });
  assert.equal((await f.scope.auditOutlineRoleContinuity('细纲')).status, 'needs_revision');
});
test('event count overrides contradictory approval', async () => {
  const { scope } = fixture({ success: true, content: JSON.stringify({ status: 'ok', eventCount: 5, suggestedCarryover: [] }) });
  assert.equal((await scope.auditOutlineEventDensity('字'.repeat(220))).status, 'overloaded');
});
test('prompt distinguishes facts from planning and has no template character', () => {
  const { scope } = fixture({});
  const prompt = scope.buildOutlinePrompt({ chapterNumber: 12, characters: '殷寂川 / 卓清晏', contextNotes: '正文事实' });
  assert.match(prompt, /规划属于未来安排/);
  assert.match(prompt, /不得擅改节点/);
  assert.doesNotMatch(prompt, /林越/);
});
test('user context is not appended repeatedly', () => {
  const { scope } = fixture({});
  assert.equal(scope.mergeOutlineContextNotes('事实甲\n事实乙', '事实甲\n事实乙'), '事实甲\n事实乙');
  const merged = scope.mergeOutlineContextNotes('事实甲', '事实甲\n补充乙\n补充乙');
  assert.equal(merged.match(/补充乙/g).length, 1);
});
test('generation route rejects conflicts and failed audits before persistence', async () => {
  for (const mode of ['conflict', 'offline', 'unresolved']) {
    const { scope } = fixture({});
    let saves = 0;
    Object.assign(scope, {
      logger: { error: () => {} },
      ensureChapterPlanForOutlineGeneration: async () => ({ chapterPlan: { main_storyline_id: 'main' } }),
      loadBookGenerationContext: async () => ({ contextNotes: '角色被俘', outlineCharacters: '谢藏锋', chapterStorylineContext: { mustAdvance: ['谢藏锋救援'] } }),
      buildOutlineStorylineConstraintText: () => '谢藏锋救援',
      collectPriorRoleContext: async () => ({ priorRoles: ['谢藏锋'], libraryRoles: ['谢藏锋'] }),
      saveChapterStorylineContext: async () => { saves++; return {}; },
      runTextGeneration: async (_prompt, options) => {
        if (options.monitorPoint === 'outline.story-audit') {
          if (mode === 'offline') return { success: false, error: 'offline' };
          if (mode === 'unresolved' && _prompt.includes('这是生成前规划检查')) return { success: true, content: JSON.stringify({ status: 'passed', missingSetup: [], triggeredForbidden: [], planningConflicts: [] }) };
          return { success: true, content: JSON.stringify({ status: 'needs_revision', missingSetup: mode === 'unresolved' ? ['救援'] : [], triggeredForbidden: [], planningConflicts: mode === 'conflict' ? ['被俘不能直接救援'] : [], summary: '未通过' }) };
        }
        if (options.monitorPoint === 'outline.density') return { success: true, content: JSON.stringify({ status: 'ok', eventCount: 2, suggestedCarryover: [] }) };
        if (options.monitorPoint === 'outline.roles') return { success: true, content: JSON.stringify({ status: 'ok', airdropRoles: [], stateConflicts: [], unsupportedSettings: [], suggestions: [] }) };
        return { success: true, content: '字'.repeat(220) };
      }
    });
    let statusCode;
    let body;
    const res = { status: code => { statusCode = code; return res; }, json: data => { body = data; return res; } };
    await scope.handleOutlineGeneration({ body: { bookId: 'book', chapterNumber: 12 } }, res);
    assert.equal(statusCode, mode === 'offline' ? 502 : 422);
    assert.equal(body.success, false);
    if (mode === "unresolved") assert.ok(body.data.draftContent);
    else assert.equal(body.data.draftContent, undefined);
    assert.equal(body.data.content, undefined);
    assert.equal(saves, 0);
  }
});
test('outline cards omit chapter history and unrelated future cast', () => {
  const { scope } = fixture({});
  const cards = scope.buildOutlineCharacterCards([
    { name: '主角甲', role_tier: 'protagonist', background: '已有规则。', notes: '远期死亡。\n【第1章角色速查】旧状态' },
    { name: '救援乙', background: '已有能力。', notes: '【第1章角色速查】旧状态' },
    { name: '远期丙', background: '尚未相关。' },
    { name: '本章新增角色', background: '聚合历史' }
  ], '救援乙参与本章', []);
  assert.match(cards, /主角甲/);
  assert.match(cards, /救援乙/);
  assert.doesNotMatch(cards, /远期丙|角色速查|远期死亡|聚合历史/);
});
test('raw storyline context is normalized before compact rendering', () => {
  const { scope } = fixture({});
  scope.buildPersistedStorylineContext = raw => {
    assert.equal(raw.storylineContexts[0].beatTitle, '反噬');
    return { usedBeatIds: ['beat'], currentBeats: [{ title: '反噬', summary: '不应重复' }], mustAdvance: ['卓清晏与谢藏锋联手压制'], mustNotHappen: ['第16章正式节点不得提前发生：经脉恢复', '经脉恢复'] };
  };
  const text = scope.buildOutlineStorylineConstraintText({ storylineContexts: [{ beatTitle: '反噬', beatSummary: '联手压制', beatStep: 1, beatSpan: 4, mustInclude: ['保留伤势限制'] }] });
  assert.match(text, /卓清晏与谢藏锋联手压制/);
  assert.match(text, /跨章节点总目标/);
  assert.match(text, /本章任务未拆分/);
  assert.doesNotMatch(text, /第1\/4段/);
  assert.match(text, /保留伤势限制/);
  assert.equal(text.match(/经脉恢复/g).length, 1);
  assert.doesNotMatch(text, /不应重复/);
});
test('oversized initial and repair inputs must stop before model submission', () => {
  const { scope } = fixture({});
  assert.equal(scope.getOutlineInputLimitError('字'.repeat(6000)), '');
  assert.match(scope.getOutlineInputLimitError('字'.repeat(6001)), /已停止发送/);
});
test('input layout has clear sections and no empty lines without changing evidence', () => {
  const { scope } = fixture({});
  const prompt = scope.buildOutlinePrompt({ chapterNumber: 12, contextNotes: '事实甲\r\n\r\n事实乙', chapterStorylinePrompt: '【本章剧情线约束】\n- 必需节点' });
  assert.doesNotMatch(prompt, /\n\s*\n/);
  assert.match(prompt, /【3\. 资料与前章事实】\n事实甲\n事实乙/);
  assert.match(prompt, /【4\. 本章正式规划】\n- 必需节点/);
});
