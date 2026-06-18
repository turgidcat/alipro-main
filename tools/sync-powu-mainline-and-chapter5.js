const BOOK_ID = 'b8bd76b6-170f-4666-9233-36e86b1f8b1d';
const STORYLINE_ID = 'e8fbc32c-1744-4369-83b5-07bf6a9a16a9';
const API_BASE = 'http://localhost:3000/api';

const chapter5Content = [
  '沈破雾醒来的时候，窗纸外的天色还没有亮透，胸口却像压着一整块没有化开的寒铁。血月试锋留下的反噬并没有退干净，指尖一动，腕上的雾纹就跟着发烫，像是在提醒他昨夜那声从门后传来的呼唤并不是幻觉。',
  '陆听澜端着药盏进门，见他坐起，只淡淡说了一句“命还在”，却把药碗先放到了他手边。白照夜随后带来一卷宗门旧档，语气仍旧温和，话里的意思却比昨夜更直白: 从这一刻起，宗门既会护着他，也会盯着他，因为血月门后的那道回声，多半只会冲着沈家的人来。',
  '沈破雾本想继续装作不在意，可旧档里那页残卷一展开，他的目光就再也挪不开。纸页边角被人提前撕走，只剩下半句“夜归门者，以血为钥”的旧约残字，旁边还压着一行批注，提到外站禁区曾封存过与“门后回声”对应的缺页。那一瞬间，他第一次真正意识到，自己在这桩旧案里也许不只是被追的人，还是会被拿去开门的人。',
  '屋里安静了片刻。陆听澜没有劝他退，白照夜也没有替他做决定，像是都在等他自己把这口气咽下去。沈破雾慢慢把残卷合上，胸口仍旧发疼，脑子却比血月试锋前更清楚: 如果继续只等着别人来追，他迟早会连自己为什么被卷进来都弄不明白。',
  '“那一页缺卷，我自己去找。”他说这句话时声音并不高，却没有半分迟疑。白照夜看了他一眼，只提醒禁区不是外人能随便碰的地方；陆听澜则把佩剑按回鞘中，像是默认这一次不会让他一个人走。窗外晨雾正缓慢漫进外站长廊，沈破雾抬头看向雾更深的地方，忽然觉得那扇门后的回声已经不再只是威胁，而是一条逼着他主动往前走的线。'
].join('\n\n');

const chapter6Plan = {
  volume_number: 1,
  chapter_name: '禁区残页',
  summary: '沈破雾顺着缺页线索第一次把脚真正踏进宗门禁区，查到旧约残页与自身血脉之间更直接的关联，也把自己暴露在更高层的注视里。',
  chapter_mission: '让主角第一次主动越线调查，并把“缺页线索”推进成可验证的旧约证据。',
  emotion_target: '潜入时的绷紧、逼近真相时的战栗，以及被更高层目光盯上的寒意。',
  previous_hook: '残缺卷宗指向一页被提前抽走的旧约记录，而那一页很可能就在宗门不允许外人触碰的禁区里。',
  outline_text: '本章重点是潜入、取证和代价升级。前段处理潜入禁区的紧张感，中段用残页内容抬高信息密度，尾段让主角知道自己已经被宗门更深层注意到。',
  character_notes: '沈破雾负责主动越线与承担风险；陆听澜负责协助遮掩并制造信任支点；白照夜不必正面阻拦，但要让读者感觉他可能早就知道。',
  ending_hook: '残页里提到的“归门血钥”并不只有开启作用，它更像是一份会反过来吞主的旧约印记。',
  scene_outline: [
    '沈破雾带着伤势与陆听澜夜探宗门禁区，第一次主动违背别人给他划好的安全边界。',
    '两人在封存旧档里找到被抽走的残页，确认沈家旧案与归门血钥直接相关。',
    '残页内容触发主角腕上雾纹异动，证明他和旧约不是旁观关系。',
    '离开禁区后，主角察觉自己虽然暂时拿到线索，却也已经被宗门更高层记住。',
  ],
  appearing_roles: ['沈破雾', '陆听澜', '白照夜'],
  main_storyline_id: STORYLINE_ID,
  target_storylines: [STORYLINE_ID],
  structured_content: {
    generation_settings: { word_count: 3000 },
    chapter_outline_structure: {
      chapter_goal: '让主角第一次主动越线调查，并把缺页线索推进成可验证的旧约证据。',
      key_scenes: '1. 夜探禁区\n2. 找到残页\n3. 雾纹异动验证旧约关联\n4. 带着更高层注视离开',
      conflict_escalation: '主角离真相更近一步，也离被宗门彻底控制更近一步。',
      character_change: '沈破雾从决定去查，推进到真正敢为真相越过规矩。',
      reader_payoff: '读者会看到主线从抽象追查进入可触摸的证据阶段。',
      ending_hook: '归门血钥不只是钥匙，更像会反噬宿主的旧约印记。',
    },
  },
  source: 'manual',
  status: 'draft',
};

const chapter6Content = [
  '夜色压下来后，宗门外站比白日安静得过分。沈破雾换了身不显眼的深衣，胸口的闷痛还没有彻底散去，可一想到那页被抽走的旧约残卷，他反而比前几日更稳。既然已经知道答案就在禁区里，继续躲着只会让别人先一步把门关死。',
  '陆听澜没有和他争论要不要去，只在翻过回廊时替他挡开了一队夜巡。她压低声音提醒，禁区里封的从来不只是旧纸旧案，还有宗门最不愿被外人知道的失控记录。沈破雾点了点头，腕上的雾纹却在靠近石库时自行发热，像是那里面真的有什么东西在隔着墙认他。',
  '两人潜进封档石室，最里面一格木匣果然少了一页整齐裁断的卷纸。沈破雾把夹在匣底的残页抽出来，只看了第一眼，呼吸就顿了一瞬。残页上写着“归门血钥”四字，后面紧跟着的批注说得更狠：此印若寄于活人，既可引门，亦可反噬其主。',
  '字迹映进眼里的同时，他左腕的雾纹忽然像被火擦过，疼得他几乎握不住纸。陆听澜一把按住他，才没让木匣摔在地上。那一刻沈破雾反而彻底明白了，自己和这桩旧案根本不是被动牵连，而是从一开始就被写在钥匙的位置上。',
  '他们离开禁区时没有惊动明面上的守卫，可回到长廊尽头，白照夜已经站在风灯下，像是早就算准了他们会从哪条路回来。他没有追问残页内容，只看了沈破雾一眼，淡淡说了一句“看来门已经认人了”。夜风从廊外卷进来，沈破雾把残页按进袖中，忽然意识到自己虽然抢到了线索，却也从今晚开始，真正被宗门更高处的人记住了。',
].join('\n\n');

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`接口 ${path} 返回了非 JSON 内容: ${text}`);
  }

  if (!response.ok || data?.success === false) {
    throw new Error(`接口 ${path} 请求失败: ${response.status} ${text}`);
  }

  return data?.data ?? data;
}

async function syncChapterPlanMainline(chapterNumber) {
  const plan = await fetchJson(`/books/${BOOK_ID}/chapter-plans/${chapterNumber}`);
  const payload = {
    volume_number: Number(plan.volume_number || 1),
    chapter_name: plan.chapter_name || '',
    summary: plan.summary || '',
    chapter_mission: plan.chapter_mission || '',
    emotion_target: plan.emotion_target || '',
    outline_text: plan.outline_text || '',
    character_notes: plan.character_notes || '',
    previous_hook: plan.previous_hook || '',
    ending_hook: plan.ending_hook || '',
    scene_outline: (() => {
      try {
        return Array.isArray(plan.scene_outline) ? plan.scene_outline : JSON.parse(plan.scene_outline || '[]');
      } catch {
        return [];
      }
    })(),
    appearing_roles: (() => {
      try {
        return Array.isArray(plan.appearing_roles) ? plan.appearing_roles : JSON.parse(plan.appearing_roles || '[]');
      } catch {
        return [];
      }
    })(),
    main_storyline_id: STORYLINE_ID,
    target_storylines: [STORYLINE_ID],
    structured_content: (() => {
      try {
        return typeof plan.structured_content === 'string'
          ? JSON.parse(plan.structured_content || '{}')
          : (plan.structured_content || {});
      } catch {
        return {};
      }
    })(),
    source: plan.source || 'manual',
    status: plan.status || 'draft',
  };

  await fetchJson(`/books/${BOOK_ID}/chapter-plans/${chapterNumber}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
}

async function syncChapter5Content() {
  await fetchJson(`/books/${BOOK_ID}/chapters/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      title: '第 5 章 门后回声',
      chapterName: '门后回声',
      chapterNumber: 5,
      content: chapter5Content,
    }),
  });
}

async function syncChapterPlan(chapterNumber, payloadOverride = null) {
  if (payloadOverride) {
    await fetchJson(`/books/${BOOK_ID}/chapter-plans/${chapterNumber}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payloadOverride),
    });
    return;
  }

  await syncChapterPlanMainline(chapterNumber);
}

async function syncChapter6Content() {
  await fetchJson(`/books/${BOOK_ID}/chapters/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      title: '第 6 章 禁区残页',
      chapterName: '禁区残页',
      chapterNumber: 6,
      content: chapter6Content,
    }),
  });
}

async function main() {
  for (const chapterNumber of [2, 3, 4, 5]) {
    await syncChapterPlan(chapterNumber);
  }
  await syncChapterPlan(6, chapter6Plan);

  await syncChapter5Content();
  await syncChapter6Content();

  const [plans, chapters] = await Promise.all([
    Promise.all([2, 3, 4, 5, 6].map((chapterNumber) => fetchJson(`/books/${BOOK_ID}/chapter-plans/${chapterNumber}`))),
    fetchJson(`/books/${BOOK_ID}/chapters`),
  ]);

  const chapter5 = chapters.find((item) => Number(item.chapter_number) === 5);
  const chapter6 = chapters.find((item) => Number(item.chapter_number) === 6);
  console.log(JSON.stringify({
    syncedPlans: plans.map((item) => ({
      chapter_number: item.chapter_number,
      chapter_name: item.chapter_name,
      main_storyline_id: item.main_storyline_id,
      target_storylines: item.target_storylines,
    })),
    chapter5: chapter5
      ? {
          chapter_number: chapter5.chapter_number,
          title: chapter5.title,
          chapter_name: chapter5.chapter_name,
          word_count: chapter5.word_count,
          preview: String(chapter5.content || '').slice(0, 60),
        }
      : null,
    chapter6: chapter6
      ? {
          chapter_number: chapter6.chapter_number,
          title: chapter6.title,
          chapter_name: chapter6.chapter_name,
          word_count: chapter6.word_count,
          preview: String(chapter6.content || '').slice(0, 60),
        }
      : null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
