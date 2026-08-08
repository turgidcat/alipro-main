require('dotenv').config();
const fs = require('fs');
const initSqlJs = require('sql.js');
const { DEFAULT_DATABASE_PATH, resolveDeepSeekModel } = require('../config/runtime');

function query(db, sql) {
  const result = db.exec(sql);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

async function main() {
  if (!fs.existsSync(DEFAULT_DATABASE_PATH)) throw new Error(`数据库不存在：${DEFAULT_DATABASE_PATH}`);
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DEFAULT_DATABASE_PATH));
  const books = query(db, `
    SELECT b.id, b.title,
      (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) AS chapter_count,
      (SELECT COUNT(*) FROM chapter_plans cp WHERE cp.book_id = b.id) AS plan_count,
      (SELECT MAX(cp.chapter_number) FROM chapter_plans cp WHERE cp.book_id = b.id) AS max_plan_chapter
    FROM books b
    ORDER BY plan_count DESC, chapter_count DESC, b.created_at ASC
  `);
  const planCoverage = query(db, `
    SELECT book_id, volume_number, MIN(chapter_number) AS first_chapter,
      MAX(chapter_number) AS last_chapter, COUNT(*) AS plan_count,
      GROUP_CONCAT(chapter_number, ',') AS chapter_numbers
    FROM chapter_plans
    GROUP BY book_id, volume_number
    ORDER BY book_id, volume_number
  `);
  const volumeCoverage = query(db, `
    SELECT book_id, volume_number, volume_name, estimated_chapters, status
    FROM volume_plans
    ORDER BY book_id, volume_number
  `);
  const storylineCoverage = query(db, `
    SELECT book_id, volume_number, COUNT(*) AS storyline_count,
      GROUP_CONCAT(storyline_name, ' / ') AS storyline_names
    FROM storylines
    GROUP BY book_id, volume_number
    ORDER BY book_id, volume_number
  `);
  console.log(JSON.stringify({
    apiKeyConfigured: Boolean(String(process.env.DEEPSEEK_API_KEY || '').trim()),
    model: resolveDeepSeekModel(),
    databasePath: DEFAULT_DATABASE_PATH,
    books,
    planCoverage,
    volumeCoverage,
    storylineCoverage
  }, null, 2));
  db.close();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
