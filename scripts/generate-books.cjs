/*
 * 批量重建书籍规划脚本（付费 API 生成）。
 *
 * 用法（在项目根目录执行）：
 *   node scripts/generate-books.cjs --only-delete   # 只备份 + 删除现有书籍
 *   node scripts/generate-books.cjs --only-generate # 只生成 4 本新书
 *   node scripts/generate-books.cjs                 # 删除 + 生成
 *
 * 说明：
 * - 数据库写入全部走运行中的后端 HTTP（127.0.0.1:3000），避免双实例写库冲突；
 * - 内容生成直接调用 DeepSeek API（backend/.env 的 DEEPSEEK_API_KEY，付费）；
 * - 每本书 4 次 API 调用：全书规划包 / 角色卡 / 剧情线 / 10 章章节规划。
 */
const fs = require('fs');
const path = require('path');

// 手动加载 backend/.env（dotenv 安装在 backend/node_modules 下，根目录脚本解析不到）
const envFile = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}
const deepseek = require('../backend/services/deepseek');

const API = 'http://127.0.0.1:3000/api';
const CHAPTER_COUNT = 10;

const BOOK_SPECS = [
  {
    genre: 'urban',
    subgenre: 'urban_business',
    genreLabel: '都市异能/商战流',
    hint: '现代都市生活与商业竞争题材，主角有现实向金手指，风格贴近都市爽文。'
  },
  {
    genre: 'scifi',
    subgenre: 'scifi_interstellar',
    genreLabel: '科幻末世/星际文明',
    hint: '星际文明题材，宏大世界观与硬核设定，兼顾人性与科技张力。'
  },
  {
    genre: 'xianxia',
    subgenre: 'xianxia_sect',
    genreLabel: '仙侠修真/宗门流',
    hint: '传统仙侠修真题材，宗门流成长线，境界体系与机缘冲突并重。'
  },
  {
    genre: 'history',
    subgenre: 'history_tang',
    genreLabel: '历史穿越/大唐流',
    hint: '历史穿越题材，穿越回大唐时代，利用现代知识与历史大势改变命运。'
  }
];

async function callApi(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let body = {};
  try {
    body = await response.json();
  } catch (_) {
    body = {};
  }
  if (!response.ok || body.success === false) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${body.error || response.statusText}`);
  }
  return body.data;
}

async function generateJson({ prompt, temperature = 0.75, maxTokens = 3000 }) {
  const result = await deepseek.generate({
    prompt,
    temperature,
    maxTokens,
    responseFormat: { type: 'json_object' }
  });
  if (!result.success) {
    throw new Error(`DeepSeek 生成失败: ${result.error}`);
  }
  let parsed = null;
  try {
    parsed = JSON.parse(String(result.content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, ''));
  } catch (error) {
    throw new Error(`JSON 解析失败: ${error.message}\n原始内容前 400 字：\n${String(result.content || '').slice(0, 400)}`);
  }
  return parsed;
}

async function deleteAllBooks() {
  const books = await callApi('/books');
  console.log(`当前书籍 ${books.length} 本，开始删除...`);
  for (const book of books) {
    try {
      const audioList = await callApi(`/tts/books/${book.id}/audio`).catch(() => []);
      for (const entry of audioList) {
        await callApi(`/tts/audio/${entry.id}`, { method: 'DELETE' }).catch(() => {});
      }
    } catch (_) {
      // TTS 清理失败不影响书籍删除
    }
    await callApi(`/books/${book.id}`, { method: 'DELETE' });
    console.log(`  已删除《${book.title}》(${book.id})`);
  }
  const remaining = await callApi('/books');
  console.log(`删除完成，剩余书籍 ${remaining.length} 本。`);
}

function buildBookPlanPrompt(spec) {
  return [
    '你是一位资深网文策划编辑。请为一本全新的短篇网文设计完整规划。',
    '',
    `题材：${spec.genreLabel}`,
    `规模：全书 ${CHAPTER_COUNT} 章（单卷），每章约 3000 有效字。`,
    `创作要求：${spec.hint}`,
    '不要套用任何已知作品的现成设定，书名与内容必须原创。',
    '',
    '严格输出 JSON，字段如下：',
    '{',
    '  "book_title": "书名（4-8 字，有网文辨识度）",',
    '  "description": "150 字以内作品简介",',
    '  "premise": "作品前提/核心创意，1-2 句",',
    '  "main_goal": "全书主目标",',
    '  "core_conflict": "全书核心冲突",',
    '  "world_rules": "世界观规则，3-5 条，用分号分隔",',
    '  "role_summary": "角色底盘摘要：主角定位、核心配角、关系变化、冲突支点",',
    '  "main_outline": "全书主线大纲，3-5 句话",',
    '  "volume_outline": "本卷（全 10 章）的推进说明",',
    '  "detailed_outline": "10 章逐章推进，每章一句话，用换行分隔",',
    '  "volume_plan": {',
    '    "volume_name": "卷名（4-10 字）",',
    '    "volume_theme": "本卷气质或主题",',
    '    "stage_goal": "本卷阶段目标",',
    '    "core_conflict": "本卷最核心冲突",',
    '    "start_role_state": "卷开始时关键角色的大状态",',
    '    "end_role_state": "卷结束时关键角色的大状态",',
    '    "notes": "卷内推进、关键转折与收束方向"',
    '  }',
    '}',
    '',
    '要求：10 章要有完整起承转合（开篇引入→矛盾升级→高潮→收束），结尾留续集钩子；',
    '不要输出任何解释文字。'
  ].join('\n');
}

function buildCharactersPrompt(spec, bookPlan) {
  return [
    '你是一位小说角色设定助手。请为下面这本书生成 6 个角色卡（主角 1 个、重要配角 3 个、次要角色 2 个）。',
    '',
    `书名：${bookPlan.book_title}`,
    `题材：${spec.genreLabel}`,
    `简介：${bookPlan.description}`,
    `作品前提：${bookPlan.premise}`,
    `主线目标：${bookPlan.main_goal}`,
    `核心冲突：${bookPlan.core_conflict}`,
    `全书大纲：${bookPlan.main_outline}`,
    '',
    '严格输出 JSON 数组，每个对象字段固定为：',
    '{',
    '  "name": "角色名（贴合题材，互不重复）",',
    '  "role_tier": "protagonist | supporting_major | supporting_secondary | supporting_minor 之一",',
    '  "personality": "长期稳定的核心性格底色，1-2 句",',
    '  "background": "身份背景、阵营位置、出身或社会位置，1-2 句",',
    '  "appearance": "最有辨识度的外形标记，1 句"',
    '}',
    '',
    '要求：所有角色必须能嵌入上述规划，不能生成与小说背景无关的人；',
    'role_tier 必须使用英文枚举值，不要返回中文。'
  ].join('\n');
}

function buildStorylinesPrompt(spec, bookPlan) {
  return [
    '你是一位小说结构师。请为下面这本书规划 2-3 条剧情线（1 条主线 + 1-2 条支线/感情线），覆盖第 1 到第 10 章。',
    '',
    `书名：${bookPlan.book_title}`,
    `题材：${spec.genreLabel}`,
    `简介：${bookPlan.description}`,
    `全书主线：${bookPlan.main_outline}`,
    `分卷推进：${bookPlan.volume_outline}`,
    `详细推进：\n${bookPlan.detailed_outline}`,
    '',
    '严格输出 JSON 数组，每个对象：',
    '{',
    '  "storyline_name": "剧情线名称（4-8 字）",',
    '  "storyline_type": "main | branch | romance 之一",',
    '  "description": "这条线 1-2 句话说明",',
    '  "core_conflict": "该线核心冲突/驱动力",',
    '  "involved_characters": ["涉及角色名"],',
    '  "start_chapter": 1,',
    '  "end_chapter": 10,',
    '  "key_nodes": ["第X章：节点事件", ...]',
    '}',
    '',
    '要求：主线贯穿全卷，支线错峰推进，不同线的高潮不要挤在同一章；key_nodes 覆盖 1-10 章的主要节点。'
  ].join('\n');
}

function buildChapterPlansPrompt(spec, bookPlan, storylines) {
  const storylineLines = storylines
    .map((item, index) => `${index + 1}. ${item.storyline_name}（${item.storyline_type}）：${item.description}`)
    .join('\n');
  return [
    `你是一位章节细纲编辑。请为《${bookPlan.book_title}》规划正好 ${CHAPTER_COUNT} 章章节细纲。`,
    '',
    `题材：${spec.genreLabel}`,
    `简介：${bookPlan.description}`,
    `全书主线：${bookPlan.main_outline}`,
    `详细推进：\n${bookPlan.detailed_outline}`,
    `剧情线规划：\n${storylineLines}`,
    '',
    `严格输出 JSON 数组，共 ${CHAPTER_COUNT} 项，每项：`,
    '{',
    '  "chapter_number": 1,',
    '  "chapter_name": "章名（4-8 字）",',
    '  "summary": "本章概括（1-2 句）",',
    '  "chapter_mission": "本章必须完成的剧情推进（1 句）",',
    '  "emotion_target": "本章情绪基调（如：压迫→爆发）",',
    '  "outline_text": "本章细纲，3-5 句，按因果推进",',
    '  "scene_outline": ["场景1", "场景2", "场景3"],',
    '  "character_notes": "本章角色刻画要点（1-2 句）",',
    '  "appearing_roles": ["本章出场角色名"],',
    '  "previous_hook": "承接上一章结尾的悬念（第1章写故事开场背景）",',
    '  "ending_hook": "章末为下一章埋的钩子（第10章写全书收束与续集钩子）"',
    '}',
    '',
    '要求：章节间因果连续、矛盾逐章升级，第 7-8 章进入高潮，第 10 章收束；'
    + '场景要给出明确产出；不要超出上述规划新增大型设定。'
  ].join('\n');
}

async function generateBook(spec) {
  console.log(`\n===== 生成《${spec.genreLabel}》=====`);

  const bookPlan = await generateJson({ prompt: buildBookPlanPrompt(spec), temperature: 0.8, maxTokens: 2800 });
  if (!bookPlan.book_title || !bookPlan.main_outline) {
    throw new Error('规划包缺少 book_title 或 main_outline');
  }

  const book = await callApi('/books', {
    method: 'POST',
    body: JSON.stringify({
      title: bookPlan.book_title,
      genre: spec.genre,
      subgenre: spec.subgenre,
      description: bookPlan.description || '',
      author: 'AI 规划',
      status: 'writing'
    })
  });
  console.log(`  已创建《${book.title}》(${book.id})`);

  await callApi(`/books/${book.id}/book-plan`, {
    method: 'POST',
    body: JSON.stringify({
      premise: bookPlan.premise || '',
      main_goal: bookPlan.main_goal || '',
      core_conflict: bookPlan.core_conflict || '',
      world_rules: bookPlan.world_rules || '',
      role_summary: bookPlan.role_summary || '',
      main_outline: bookPlan.main_outline || '',
      volume_outline: bookPlan.volume_outline || '',
      detailed_outline: bookPlan.detailed_outline || '',
      source: 'ai',
      status: 'generated'
    })
  });

  const vp = bookPlan.volume_plan || {};
  await callApi(`/books/${book.id}/volume-plans/1`, {
    method: 'POST',
    body: JSON.stringify({
      volume_number: 1,
      volume_name: vp.volume_name || `卷一 · ${book.title}`,
      volume_theme: vp.volume_theme || '',
      stage_goal: vp.stage_goal || '',
      core_conflict: vp.core_conflict || '',
      start_role_state: vp.start_role_state || '',
      end_role_state: vp.end_role_state || '',
      estimated_chapters: CHAPTER_COUNT,
      storyline_quota: 3,
      notes: vp.notes || '',
      source: 'ai',
      status: 'generated'
    })
  });
  console.log(`  全书规划 + 分卷（1 卷 ${CHAPTER_COUNT} 章）已写入`);

  const characters = await generateJson({
    prompt: buildCharactersPrompt(spec, bookPlan),
    temperature: 0.8,
    maxTokens: 2200
  });
  const characterList = Array.isArray(characters) ? characters : characters.characters || [];
  if (characterList.length === 0) {
    throw new Error('角色生成结果为空');
  }
  for (const character of characterList) {
    await callApi(`/books/${book.id}/characters`, {
      method: 'POST',
      body: JSON.stringify({
        name: character.name,
        personality: character.personality || '',
        background: character.background || '',
        appearance: character.appearance || '',
        role_tier: ['protagonist', 'supporting_major', 'supporting_secondary', 'supporting_minor'].includes(character.role_tier)
          ? character.role_tier
          : 'supporting_major',
        character_type: 'main_character'
      })
    });
  }
  console.log(`  ${characterList.length} 个角色已写入`);

  const storylines = await generateJson({
    prompt: buildStorylinesPrompt(spec, bookPlan),
    temperature: 0.75,
    maxTokens: 2600
  });
  const storylineList = Array.isArray(storylines) ? storylines : storylines.storylines || [];
  if (storylineList.length === 0) {
    throw new Error('剧情线生成结果为空');
  }
  const savedStorylines = [];
  for (const storyline of storylineList) {
    const saved = await callApi(`/storyline-workbench/${book.id}/storylines`, {
      method: 'POST',
      body: JSON.stringify({
        volume_number: 1,
        storyline_name: storyline.storyline_name,
        storyline_type: storyline.storyline_type || 'branch',
        description: storyline.description || '',
        core_conflict: storyline.core_conflict || '',
        involved_characters: Array.isArray(storyline.involved_characters) ? storyline.involved_characters : [],
        start_chapter: Number(storyline.start_chapter || 1),
        end_chapter: Number(storyline.end_chapter || CHAPTER_COUNT),
        key_nodes: Array.isArray(storyline.key_nodes) ? storyline.key_nodes : []
      })
    });
    savedStorylines.push(saved);
  }
  console.log(`  ${savedStorylines.length} 条剧情线已写入`);

  const mainStoryline = savedStorylines.find((item) => String(item.storyline_type || '').toLowerCase() === 'main')
    || savedStorylines[0];
  const mainStorylineId = String(mainStoryline?.id || '');
  const targetStorylineIds = savedStorylines.map((item) => String(item.id || '')).filter(Boolean);

  const chapterPlans = await generateJson({
    prompt: buildChapterPlansPrompt(spec, bookPlan, savedStorylines),
    temperature: 0.7,
    maxTokens: 6000
  });
  const chapterList = Array.isArray(chapterPlans) ? chapterPlans : chapterPlans.chapters || [];
  if (chapterList.length !== CHAPTER_COUNT) {
    throw new Error(`章节规划数量异常：期望 ${CHAPTER_COUNT}，实际 ${chapterList.length}`);
  }
  for (const chapter of chapterList) {
    const chapterNumber = Number(chapter.chapter_number) || 0;
    await callApi(`/books/${book.id}/chapter-plans/${chapterNumber}`, {
      method: 'POST',
      body: JSON.stringify({
        volume_number: 1,
        chapter_name: chapter.chapter_name || '',
        summary: chapter.summary || '',
        chapter_mission: chapter.chapter_mission || '',
        emotion_target: chapter.emotion_target || '',
        outline_text: chapter.outline_text || '',
        scene_outline: Array.isArray(chapter.scene_outline) ? chapter.scene_outline : [],
        character_notes: chapter.character_notes || '',
        appearing_roles: Array.isArray(chapter.appearing_roles) ? chapter.appearing_roles : [],
        previous_hook: chapter.previous_hook || '',
        ending_hook: chapter.ending_hook || '',
        main_storyline_id: mainStorylineId,
        target_storylines: targetStorylineIds,
        source: 'ai',
        status: 'draft'
      })
    });
  }
  console.log(`  ${CHAPTER_COUNT} 章章节规划已写入`);

  return { book, characterCount: characterList.length, storylineCount: savedStorylines.length };
}

async function main() {
  const args = process.argv.slice(2);
  const onlyDelete = args.includes('--only-delete');
  const onlyGenerate = args.includes('--only-generate');

  try {
    const health = await fetch(`${API.replace('/api', '')}/health`);
    if (!health.ok) {
      throw new Error('后端未启动');
    }
  } catch (error) {
    console.error(`无法连接本地后端 ${API}，请先启动后端（nodemon 正在运行即可）。`);
    process.exit(1);
  }

  if (!onlyGenerate) {
    await deleteAllBooks();
    if (onlyDelete) {
      console.log('仅删除模式完成。');
      return;
    }
  }

  const results = [];
  for (const spec of BOOK_SPECS) {
    // 每本独立 try，避免一本失败中断全部
    try {
      results.push(await generateBook(spec));
    } catch (error) {
      console.error(`《${spec.genreLabel}》生成失败：`, error.message);
    }
  }

  console.log('\n===== 汇总 =====');
  const allBooks = await callApi('/books');
  for (const book of allBooks) {
    const plan = await callApi(`/books/${book.id}/book-plan`).catch(() => null);
    const volumes = await callApi(`/books/${book.id}/volume-plans`).catch(() => []);
    const chapters = await callApi(`/books/${book.id}/chapter-plans`).catch(() => []);
    const characters = await callApi(`/books/${book.id}/characters`).catch(() => []);
    const storylines = await callApi(`/storyline-workbench/${book.id}/storylines`).catch(() => []);
    console.log(
      `《${book.title}》[${book.genre}/${book.subgenre}] 全书规划:${plan ? '有' : '无'} `
      + `分卷:${volumes.length} 章节规划:${chapters.length} 角色:${characters.length} 剧情线:${storylines.length}`
    );
  }
}

main().catch((error) => {
  console.error('脚本执行失败：', error);
  process.exit(1);
});
