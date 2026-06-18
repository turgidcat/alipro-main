const crypto = require('crypto');
const initDatabase = require('./database/init');
const { saveDatabase } = require('./services/database');

const bookId = 'b8bd76b6-170f-4666-9233-36e86b1f8b1d';

async function main() {
  const db = await initDatabase;

  db.run('DELETE FROM novel_characters WHERE book_id = ?', [bookId]);
  db.run('DELETE FROM novel_outlines WHERE book_id = ?', [bookId]);

  const characters = [
    {
      name: '沈破雾',
      appearance: '十七岁，常穿灰蓝短衫，左腕有一圈淡淡雾纹。',
      personality: '外冷内热，警惕心强，遇事先退一步，但一旦认定目标就很难回头。',
      background: '边境小镇出身，幼年经历过一场与浓雾有关的灾难，家中长辈因此失踪。',
      notes: '主角，推动整部故事前进的核心视角。',
      characterType: 'main_character'
    },
    {
      name: '陆听澜',
      appearance: '黑发束起，常背一柄窄剑，衣袍上有药香。',
      personality: '理性克制，嘴上不饶人，关键时刻总会先站出来。',
      background: '出自宗门旁支，知道许多旧案，但不愿轻易说透。',
      notes: '重要同伴，负责把主角带进更大的真相里。',
      characterType: 'main_character'
    },
    {
      name: '白照夜',
      appearance: '中年男子，衣着整洁，手持一枚铜铃。',
      personality: '温和、耐心，说话总是留半句。',
      background: '宗门外事长老，专门处理与迷雾旧约有关的案卷。',
      notes: '可以承担“给答案的人”，也可能是半个幕后推动者。',
      characterType: 'chapter_character'
    },
    {
      name: '雾门守卒',
      appearance: '戴着灰色面具，身形高大，行动时几乎没有脚步声。',
      personality: '沉默、机械、只认命令。',
      background: '守在旧雾门附近的巡守者，见过很多人进去后再也没有出来。',
      notes: '用于制造第一卷的压迫感。',
      characterType: 'chapter_character'
    }
  ];

  for (const row of characters) {
    db.run(
      `
      INSERT INTO novel_characters
        (id, book_id, user_id, name, appearance, personality, background, notes, character_type, created_at)
      VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        crypto.randomUUID(),
        bookId,
        row.name,
        row.appearance,
        row.personality,
        row.background,
        row.notes,
        row.characterType
      ]
    );
  }

  db.run(
    `
    INSERT INTO novel_outlines
      (id, book_id, user_id, type, volume_number, volume_title, chapter_id, content, main_outline, volume_outline, detailed_outline, created_at, updated_at)
    VALUES (?, ?, '', 'book', 0, '', '', '', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      crypto.randomUUID(),
      bookId,
      '《破雾修真录》讲一个少年在浓雾与旧约中寻找真相的故事。前期以逃离和觉醒为主，中期进入宗门与旧势力冲突，后期逐步揭开“破雾”并不只是能力，而是代价极高的命运钥匙。',
      '第一卷写主角从边境小镇逃入雾海，第二卷写宗门试炼与旧案牵连，第三卷写血脉真相与命运反转。',
      '每一卷都要保证：主角目标明确、压力持续升级、关系链不断收紧。章节推进上尽量让每次突破都伴随代价，避免单纯打怪升级。'
    ]
  );

  db.run('UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [bookId]);

  saveDatabase(db);
  console.log('demo book reseeded and saved');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
