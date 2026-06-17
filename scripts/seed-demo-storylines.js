const DEMO_BOOK_ID = '84f598e7-59bc-494d-80ba-dfe6cfda7967';
const API_BASE = 'http://127.0.0.1:3000/api/storyline-workbench';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data.data;
}

async function saveVolumeSetting(volume) {
  return request(`/${DEMO_BOOK_ID}/volume-settings`, {
    method: 'POST',
    body: JSON.stringify(volume)
  });
}

async function fetchStorylines() {
  return request(`/${DEMO_BOOK_ID}/storylines`);
}

async function saveStoryline(storyline) {
  return request(`/${DEMO_BOOK_ID}/storylines`, {
    method: 'POST',
    body: JSON.stringify(storyline)
  });
}

async function saveChapterPlan(chapterNumber, payload) {
  const response = await fetch(`http://127.0.0.1:3000/api/books/${DEMO_BOOK_ID}/chapter-plans/${chapterNumber}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data.data;
}

async function main() {
  await saveVolumeSetting({
    volume_number: 1,
    volume_name: '血月初醒',
    volume_theme: '主角被迫暴露禁血之力，从逃亡者变成各方势力锁定的目标。',
    estimated_chapters: 12,
    volume_position: 'start',
    storyline_count: 3,
    notes: '这一卷重点是暴露、追猎、初次觉醒，以及把血月之力和主角命运正式绑死。'
  });

  let storylines = await fetchStorylines();
  const byName = new Map(storylines.map((item) => [item.storyline_name, item]));

  async function ensureStoryline(payload) {
    const existing = byName.get(payload.storyline_name);
    const saved = await saveStoryline({
      ...(existing ? { id: existing.id } : {}),
      ...payload
    });
    storylines = await fetchStorylines();
    const refreshed = storylines.find((item) => item.storyline_name === payload.storyline_name);
    byName.set(payload.storyline_name, refreshed);
    return refreshed;
  }

  const bloodMoonMain = await ensureStoryline({
    volume_number: 1,
    storyline_name: '血月之力暴露线',
    storyline_type: 'main',
    description: '围绕殷寂川如何在一次次追杀中暴露并失控使用血月之力展开。',
    involved_characters: ['殷寂川', '卓清晏', '牧云昭'],
    start_chapter: 1,
    end_chapter: 6,
    key_nodes: ['荒原血祭', '祭坛回响', '身份锁定', '禁力失控升级'],
    core_conflict: '主角越想保护同伴，就越必须动用会吞噬自己的禁血之力。'
  });

  const pursuitLine = await ensureStoryline({
    volume_number: 1,
    storyline_name: '旧势力追猎线',
    storyline_type: 'villain',
    description: '旧势力根据血月异象逐步缩小包围圈，最终锁定主角身份。',
    involved_characters: ['牧云昭', '殷寂川', '追猎者'],
    start_chapter: 1,
    end_chapter: 8,
    key_nodes: ['荒原设伏', '祭坛感应', '远程追踪', '亲自出手'],
    core_conflict: '敌方从模糊追查转为精准围猎，主角的生存空间持续被压缩。'
  });

  const bondLine = await ensureStoryline({
    volume_number: 1,
    storyline_name: '殷寂川与卓清晏牵引线',
    storyline_type: 'romance',
    description: '通过保护、隐瞒与代价，逐步建立两人的情感牵引和命运绑定。',
    involved_characters: ['殷寂川', '卓清晏'],
    start_chapter: 1,
    end_chapter: 10,
    key_nodes: ['带伤逃亡', '第一次失控救人', '秘密加深', '关系绑定'],
    core_conflict: '主角越想把对方推出危险，越会因为救对方而陷得更深。'
  });

  await saveChapterPlan(1, {
    volume_number: 1,
    chapter_name: '荒原血祭',
    summary: '荒原遇伏，禁血觉醒，行踪暴露。',
    chapter_mission: '逼主角为了救人首次在明面上动用禁血之力。',
    emotion_target: '压抑中带决绝',
    outline_text: '荒原设伏先压出危险，再让主角被迫动用禁力反杀，最后把行踪暴露和更大追杀一起留下。',
    character_notes: '殷寂川负责行动与抉择，卓清晏承接情感牵引，追猎者负责压迫感。',
    previous_hook: '追猎者已经逼近，卓清晏伤势恶化。',
    ending_hook: '血月异象被远处祭坛感应到。',
    main_storyline_id: bloodMoonMain?.id || '',
    target_storylines: [pursuitLine?.id, bondLine?.id].filter(Boolean),
    source: 'manual',
    status: 'draft'
  });

  await saveChapterPlan(2, {
    volume_number: 1,
    chapter_name: '祭坛回响',
    summary: '暴露反噬，敌方锁定，追猎升级。',
    chapter_mission: '让上一章的暴露开始反噬，推进敌方真正锁定主角。',
    emotion_target: '紧绷、逼近、危险升级',
    outline_text: '祭坛异动引出更高层追踪者，主角一边转移一边意识到自己已被更大的力量盯上。',
    character_notes: '主角与卓清晏继续同行，并补一个真正感知到血月波动的敌方视角。',
    previous_hook: '血月异象已经暴露位置。',
    ending_hook: '牧云昭确认主角身份后亲自出手。',
    main_storyline_id: pursuitLine?.id || bloodMoonMain?.id || '',
    target_storylines: [bloodMoonMain?.id, bondLine?.id].filter(Boolean),
    source: 'manual',
    status: 'draft'
  });

  console.log('Demo storyline data seeded successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
