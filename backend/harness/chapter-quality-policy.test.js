const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectLedgerDenialConflicts,
  collectOpeningLocationCandidates,
  evaluateChapterPlanQuality,
  evaluatePreviousChapterRelease,
  formatAuditLedgerSnapshot,
  isAffirmativeAuditRisk,
  isNoisyCountFactNoun,
  qualityGateScore,
  shouldAcceptQualityRepair
} = require('../services/chapter-quality-policy');

test('开头地点提取不会把普通动作句误判成新地点', () => {
  const opening = '林烬站在后门口，问道：“我今早没见韩崇烈的人出镇。”随后赶往黑水镇街口，全镇开始搜捕。';
  const candidates = collectOpeningLocationCandidates(opening);
  assert.ok(!candidates.some((item) => item.includes('后门口')));
  assert.ok(!candidates.includes('我今早没见韩崇烈的人出镇'));
  assert.ok(!candidates.includes('全镇'));
  assert.ok(candidates.some((item) => item.includes('黑水镇街口')));
});

test('动作次数不会被当成跨章实体数量冲突', () => {
  assert.equal(isNoisyCountFactNoun('下'), true);
  assert.equal(isNoisyCountFactNoun('招'), true);
  assert.equal(isNoisyCountFactNoun('守卒'), false);
});

test('长期事实账本会进入 Judge 可读文本', () => {
  const text = formatAuditLedgerSnapshot({
    characterRows: [{ chapter_number: 1, character_name: '裴玄度', state_text: '与林烬在茶摊交锋', relationship_text: '彼此认识' }],
    continuityRows: [{ chapter_number: 1, fact_text: '林烬已经听过裴玄度的名字' }]
  });
  assert.match(text, /裴玄度/);
  assert.match(text, /彼此认识/);
  assert.match(text, /已经听过/);
});

function validPlan(overrides = {}) {
  return {
    chapter_mission: '主角查清密信来源并锁定内鬼范围',
    outline_text: '主角根据上一章留下的密信进入旧档案室，通过守卫口供和残缺印章交叉验证，最终锁定两名嫌疑人。',
    appearing_roles: '["林川","周宁"]',
    structured_content: JSON.stringify({
      storyline_context: {
        mustAdvance: ['主角取得守卫口供并锁定两名嫌疑人'],
        mustNotHappen: ['本章不得直接揭露最终内鬼'],
        isFallback: false
      }
    }),
    ...overrides
  };
}

test('完整章节规划允许生成', () => {
  const result = evaluateChapterPlanQuality({ chapterPlan: validPlan(), chapterNumber: 8 });
  assert.equal(result.status, 'passed');
  assert.equal(result.can_generate, true);
});

test('Judge 自己明确否定的问题不得进入正式风险', () => {
  assert.equal(isAffirmativeAuditRisk('时间跳跃通过上下文自然衔接，不构成实质问题。'), false);
  assert.equal(isAffirmativeAuditRisk('线索已建立，不构成矛盾。'), false);
  assert.equal(isAffirmativeAuditRisk('与上一章威胁形成合理延续，无冲突。'), false);
  assert.equal(isAffirmativeAuditRisk('门印幻象属于后续伏笔，无实质风险。'), false);
  assert.equal(isAffirmativeAuditRisk('线索逐步推进，未与上一章事实冲突。'), false);
  assert.equal(isAffirmativeAuditRisk('上一章黑鸦已死，本章却描述其飞入院中，存在事实冲突。'), true);
});

test('尚未揭晓的谜团不得被当成连续性风险', () => {
  assert.equal(isAffirmativeAuditRisk('林禾失踪原因未在正文中明确，缺乏直接证据。'), false);
  assert.equal(isAffirmativeAuditRisk('记忆缺失原因尚未解释，可能引发疑问。'), false);
  assert.equal(isAffirmativeAuditRisk('前文已明确林禾自行离开，本章却称她被掳走，存在事实冲突。'), true);
});

test('当前章否认认识已接触角色时由确定性检查兜底', () => {
  const risks = collectLedgerDenialConflicts(
    '林烬说药铺学徒宁秋替他上过药。石伯点头，随后说：“前面就是裴玄度的地盘。你听过这个名字没有？”\n\n林烬摇头。',
    {
      characterRows: [
        {
          chapter_number: 1,
          character_name: '裴玄度',
          state_text: '与林烬在茶摊短暂交锋',
          relationship_text: '双方已经接触'
        },
        {
          chapter_number: 1,
          character_name: '宁秋',
          state_text: '与林烬见面并交谈',
          relationship_text: '从小认识'
        }
      ]
    }
  );
  assert.equal(risks.length, 1);
  assert.match(risks[0], /第1章/);
  assert.match(risks[0], /裴玄度/);
});

test('上一章需要人工复核时阻止继续批量生成', () => {
  const result = evaluatePreviousChapterRelease({
    chapterNumber: 9,
    previousChapter: { content: '上一章正文。' },
    previousFeedback: {
      quality_check: {
        status: 'warning',
        verdict: 'needs_review',
        needs_human_review: true,
        plan_anchor_audit: { status: 'needs_review' },
        word_count_audit: { status: 'passed' },
        storyline_audit: { status: 'passed' }
      }
    }
  });
  assert.equal(result.can_continue, false);
  assert.ok(result.blocking_issue_codes.includes('PREVIOUS_CHAPTER_REVIEW_REQUIRED'));
});

test('上一章全部通过后允许生成下一章', () => {
  const result = evaluatePreviousChapterRelease({
    chapterNumber: 9,
    previousChapter: { content: '上一章正文。' },
    previousFeedback: {
      quality_check: {
        status: 'passed',
        verdict: 'stable',
        needs_human_review: false,
        plan_anchor_audit: { status: 'passed' },
        word_count_audit: { status: 'passed' },
        storyline_audit: { status: 'passed' }
      }
    }
  });
  assert.equal(result.can_continue, true);
});

test('缺少可验收推进目标时阻止生成', () => {
  const result = evaluateChapterPlanQuality({
    chapterPlan: validPlan({ chapter_mission: '', summary: '', structured_content: '{}' }),
    chapterNumber: 8
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.can_generate, false);
  assert.ok(result.blocking_issue_codes.includes('PLAN_MUST_ADVANCE_MISSING'));
});

test('旧规划可用明确章节任务补齐 mustAdvance', () => {
  const result = evaluateChapterPlanQuality({
    chapterPlan: validPlan({ structured_content: '{}' }),
    chapterNumber: 8
  });
  assert.equal(result.can_generate, true);
  assert.equal(result.must_advance_source, 'chapter_mission');
  assert.equal(result.status, 'review');
});

test('空泛推进目标不得通过规划门禁', () => {
  const plan = validPlan({
    structured_content: JSON.stringify({ storyline_context: { mustAdvance: ['推进剧情'] } })
  });
  const result = evaluateChapterPlanQuality({ chapterPlan: plan, chapterNumber: 8 });
  assert.ok(result.blocking_issue_codes.includes('PLAN_MUST_ADVANCE_VAGUE'));
});

test('修复稿只有明确降低质量风险才被采用', () => {
  const before = { verdict: 'needs_review', risks: ['衔接不足', '任务未完成'], deterministic_check: { status: 'passed' }, plan_anchor_audit: { status: 'needs_review' } };
  const after = { verdict: 'stable', risks: [], deterministic_check: { status: 'passed' }, plan_anchor_audit: { status: 'passed' } };
  assert.ok(qualityGateScore(after) < qualityGateScore(before));
  assert.equal(shouldAcceptQualityRepair(before, after), true);
  assert.equal(shouldAcceptQualityRepair(after, before), false);
});
