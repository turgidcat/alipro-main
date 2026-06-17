const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库路径
const dbDir = path.join(__dirname, '..', 'database');
const dbPath = process.env.DB_PATH || path.join(dbDir, 'novel.db');

// 检查数据库文件是否存在
if (!fs.existsSync(dbPath)) {
  console.log('️ 数据库文件不存在，跳过迁移');
  process.exit(0);
}

const db = new Database(dbPath);

try {
  // 检查 chapters 表是否有 chapter_name 列
  const tableInfo = db.pragma('table_info(chapters)');
  const hasChapterName = tableInfo.some(col => col.name === 'chapter_name');

  if (!hasChapterName) {
    console.log(' 正在添加 chapter_name 列到 chapters 表...');

    // 添加 chapter_name 列
    db.exec(`
      ALTER TABLE chapters
      ADD COLUMN chapter_name TEXT DEFAULT ''
    `);

    // 从现有的 title 中提取 chapter_name
    // 假设 title 格式为 "第X章 XXX" 或 "第X章"
    console.log('🔄 正在迁移现有章节数据...');

    const chapters = db.prepare('SELECT id, title FROM chapters').all();

    const updateStmt = db.prepare(`
      UPDATE chapters
      SET chapter_name = ?
      WHERE id = ?
    `);

    const updateTx = db.transaction((updates) => {
      for (const { id, title } of updates) {
        // 从 title 中提取章节名称（去掉 "第X章 " 前缀）
        const match = title.match(/^第\d+章\s*(.+)$/);
        const chapterName = match ? match[1].trim() : '';
        updateStmt.run(chapterName, id);
      }
    });

    updateTx(chapters);

    console.log(`✅ 成功迁移 ${chapters.length} 个章节`);
  } else {
    console.log('✅ chapter_name 列已存在，无需迁移');
  }

  console.log('✅ 数据库迁移完成');
} catch (error) {
  console.error('❌ 数据库迁移失败:', error.message);
  process.exit(1);
} finally {
  db.close();
}
