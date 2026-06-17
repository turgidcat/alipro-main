const DEMO_BOOK_ID = '84f598e7-59bc-494d-80ba-dfe6cfda7967';
const API_BASE = 'http://127.0.0.1:3000/api';

async function api(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

async function main() {
  await api(`/books/${DEMO_BOOK_ID}/character-summary`, {
    summary: [
      '殷寂川：命不久矣的禁血之子，越动用血月之力，寿命流逝越快。',
      '卓清晏：主角必须护住的人，也是他保留人性的锚点。',
      '牧云昭：始终追索血月真相的旧势力代言人，既是敌手也是真相入口。'
    ].join('\n')
  });

  await api(`/books/${DEMO_BOOK_ID}/outline`, {
    main_outline: '前期围绕逃亡、觉醒与暴露，中期进入势力交锋与血脉真相，后期推进血月源头与命运反杀。',
    volume_outline: '第一卷写主角被迫暴露血月之力并卷入追猎，第二卷写真相逼近与阵营撕裂，第三卷写命运反杀与代价兑现。',
    detailed_outline: '每卷都要确保主角能力更强、代价更重、关系更撕裂，最终把力量成长和命运压迫绑在一起。'
  });

  await api(`/books/${DEMO_BOOK_ID}/chapter-plans/1`, {
    chapter_name: '荒原血祭',
    summary: '荒原遇伏，禁血觉醒，行踪暴露。',
    chapter_mission: '逼主角为了救人首次在明面上动用禁血之力。',
    emotion_target: '压抑中带决绝',
    outline_text: '荒原设伏先压出危险，再让主角被迫动用禁力反杀，最后把行踪暴露和更大追杀一起留下。',
    character_notes: '殷寂川负责行动与抉择，卓清晏承接情感牵引，追猎者负责压迫感。',
    previous_hook: '追猎者已经逼近，卓清晏伤势恶化。',
    ending_hook: '血月异象被远处祭坛感应到。',
    main_storyline_id: '',
    target_storylines: [],
    source: 'manual',
    status: 'draft'
  });

  await api(`/books/${DEMO_BOOK_ID}/chapter-plans/2`, {
    chapter_name: '祭坛回响',
    summary: '暴露反噬，敌方锁定，追猎升级。',
    chapter_mission: '让上一章的暴露开始反噬，推进敌方真正锁定主角。',
    emotion_target: '紧绷、逼近、危险升级',
    outline_text: '祭坛异动引出更高层追踪者，主角一边转移一边意识到自己已被更大的力量盯上。',
    character_notes: '主角与卓清晏继续同行，并补一个真正感知到血月波动的敌方视角。',
    previous_hook: '血月异象已经暴露位置。',
    ending_hook: '牧云昭确认主角身份后亲自出手。',
    main_storyline_id: '',
    target_storylines: [],
    source: 'manual',
    status: 'draft'
  });

  await api(`/books/${DEMO_BOOK_ID}/chapters/upsert`, {
    title: '第 1 章 荒原血祭',
    chapterName: '荒原血祭',
    chapterNumber: 1,
    content:
      '风从荒原尽头卷来，带着碎石和血腥气。殷寂川扶着卓清晏穿过残碑之间，脚下每一步都像踩在快要裂开的弦上。追兵没有立刻现身，反而让这片死寂更像陷阱。\n\n卓清晏的呼吸越来越轻，指尖却还死死攥着他的袖口：“别停。”\n\n殷寂川没有回答。他知道再往前，就是那座早该废弃的血月祭坛。那里可能是生路，也可能是另一张更大的网。\n\n下一瞬，箭雨破空而下。石碑后方同时亮起数道符火，追猎者从四面合围。殷寂川把卓清晏护到断墙后，肩头却被一道冷箭擦开，血顺着衣袖往下淌。\n\n“把人交出来，你还能活。”为首的追猎者冷声道。\n\n殷寂川看着怀里几乎失去意识的卓清晏，忽然笑了一下。那笑意很淡，却比夜风更冷。“活？”\n\n他掌心按在地面，血线无声蔓延。荒原深处，沉寂许久的血月祭坛忽然像被什么唤醒，暗红纹路一寸寸亮起。下一刻，风向骤变，追猎者的阵形被一股暴烈力量硬生生撕开。\n\n禁血之力第一次在明面上彻底失控，像一轮看不见的血月在他体内炸开。殷寂川听见自己骨骼发出细微裂响，也看见追猎者眼里终于浮起恐惧。\n\n可更远处，祭坛中央的古老纹印也在同时亮了起来。有人睁开了眼。'
  });

  console.log('Demo book reseeded successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
