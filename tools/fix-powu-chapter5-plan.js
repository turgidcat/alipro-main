const BOOK_ID = 'b8bd76b6-170f-4666-9233-36e86b1f8b1d';
const STORYLINE_ID = 'e8fbc32c-1744-4369-83b5-07bf6a9a16a9';

const payload = {
  volume_number: 1,
  chapter_name: '门后回声',
  summary:
    '沈破雾在血月试锋后的反噬中，第一次认真面对“门后呼唤”不是幻听，而是一条直指沈家旧案的线索；宗门的保护与监视也在这一章正式变成双重压力。',
  chapter_mission:
    '让主角在反噬后仍主动追查门后呼唤的来源，并第一次意识到自己在旧案里可能既是钥匙，也是祭品。',
  emotion_target: '虚弱、疑惧、被逼着冷静下来，最后收在咬牙主动往更深处走的决心。',
  outline_text:
    '本章重点是承接血月试锋后的代价，把“门后呼唤”从异象推进成可追查的线索。前段先处理反噬与宗门态度，中段借旧卷和禁区线索抬高信息密度，后段让主角主动做出继续追查的决定。',
  scene_outline: [
    '沈破雾在反噬余波中醒来，确认那道呼唤与沈家旧案不是巧合。',
    '陆听澜与白照夜分别给出保护和试探，宗门态度从旁观变成半收编。',
    '主角从残缺卷宗或外站旧档里找到与“门后回声”对应的缺页线索。',
    '主角决定在下一次血月前主动追查缺页去向，不再只被动等追兵上门。',
  ],
  character_notes:
    '沈破雾要从硬撑求生转向带伤主动追查；陆听澜负责把情感支点留住；白照夜既提供线索也代表宗门控制力。',
  appearing_roles: ['沈破雾', '陆听澜', '白照夜'],
  previous_hook: '主角虽然挡下第一轮试探，却在昏沉中听见血月门后的呼唤，像是有人在叫他的名字。',
  ending_hook: '残缺卷宗指向一页被提前抽走的旧约记录，而那一页很可能就在宗门不允许外人触碰的禁区里。',
  main_storyline_id: STORYLINE_ID,
  target_storylines: [STORYLINE_ID],
  structured_content: {
    generation_settings: { word_count: 3000 },
    chapter_outline_structure: {
      chapter_goal:
        '让主角在反噬后仍主动追查门后呼唤的来源，并第一次意识到自己在旧案里可能既是钥匙，也是祭品。',
      key_scenes:
        '1. 反噬醒来，确认呼唤并非幻听\n2. 宗门保护与试探同时压上来\n3. 旧卷缺页线索浮出\n4. 主角决定主动追查禁区与缺页',
      conflict_escalation:
        '主角越想弄清门后呼唤，就越要接受宗门的监视与旧案的真正危险。',
      character_change: '沈破雾从被动承受代价，转为带伤也要主动查下去。',
      reader_payoff: '读者会明确看到门后呼唤和沈家旧案接上，不再只是抽象悬念。',
      ending_hook: '残缺卷宗指向被抽走的旧约记录，而真正答案藏在宗门禁区。',
    },
  },
  source: 'manual',
  status: 'draft',
};

const response = await fetch(`http://localhost:3000/api/books/${BOOK_ID}/chapter-plans/5`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(payload),
});

const body = await response.text();
console.log(response.status);
console.log(body);
