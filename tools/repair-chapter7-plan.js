const { ChapterPlanService } = require('../backend/services/database');

async function main() {
  const service = new ChapterPlanService();
  const bookId = 'b8bd76b6-170f-4666-9233-36e86b1f8b1d';
  const chapterNumber = 7;

  const payload = {
    volume_number: 1,
    chapter_name: '风灯试探',
    summary: '沈破雾带着禁区残页回到外站后，必须先处理高层已经注意到他的后果，同时试着确认归门血钥与自身血脉的绑定代价。',
    chapter_mission: '承接禁区越线后的暴露后果，让主角一边藏线索，一边确认归门血钥与自身血脉的关系。',
    emotion_target: '压迫感、试探感，以及知道真相更近却更危险的寒意。',
    outline_text: '前段写主角回到外站后的收束与遮掩，中段安排来自宗门更高层或白照夜的试探，后段让主角从残页或雾纹反应里确认归门血钥不是单纯线索，而是会继续反噬自己的旧约印记。',
    scene_outline: [
      '沈破雾回到外站后先藏好残页，同时意识到自己已经被宗门更高层记住。',
      '白照夜或宗门来人用看似平静的问话试探主角是否碰过禁区旧档。',
      '主角在压迫下再次观察残页和腕上雾纹，确认归门血钥与自身血脉存在更深绑定。',
      '本章结尾留下更明确的下一步压力：要么交出线索，要么主动先查出旧约真相。'
    ],
    character_notes: '沈破雾重点是藏线索、扛压力、确认代价；陆听澜重点是协助遮掩并提供判断；白照夜重点是保持模糊试探感，不直接摊牌。',
    appearing_roles: ['沈破雾', '陆听澜', '白照夜'],
    previous_hook: '残页里提到的“归门血钥”并不只有开启作用，它更像是一份会反过来吞主的旧约印记。\n主角已经进入宗门更高层视野，下一章要处理监视、试探或封锁带来的后果。',
    ending_hook: '主角确认归门血钥与自身血脉绑定更深，而宗门高层也开始逼近真正摊牌的边缘。',
    main_storyline_id: 'e8fbc32c-1744-4369-83b5-07bf6a9a16a9',
    target_storylines: ['e8fbc32c-1744-4369-83b5-07bf6a9a16a9'],
    structured_content: {
      generation_settings: { word_count: 2200 },
      chapter_outline_structure: {
        chapter_goal: '承接禁区越线后的暴露后果，让主角一边藏线索，一边确认归门血钥与自身血脉的关系。',
        key_scenes: '1. 回到外站藏残页\n2. 面对白照夜或宗门试探\n3. 雾纹与残页再次反应\n4. 留下更大逼压',
        conflict_escalation: '主角拿到证据后没有变轻松，反而立刻进入被监视和被试探阶段。',
        character_change: '沈破雾从单纯越线取证，推进到开始学会在压力下藏线索、抢主动。',
        reader_payoff: '读者能看到旧约证据不只是揭谜工具，同时也开始反咬主角。',
        ending_hook: '主角确认归门血钥绑定更深，而宗门高层也逼近摊牌边缘。'
      }
    },
    source: 'manual',
    status: 'draft'
  };

  const result = await service.upsert(bookId, chapterNumber, payload, '');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
