const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const TEMPLATES = require('../config/templates');
const { resolveDatabasePath } = require('../config/runtime');
const {
  applyPendingDatabaseRestore,
  createDatabaseBackup,
  isSqliteFile,
  listDatabaseBackups,
  writeDatabaseAtomically
} = require('../services/database-storage');

// 数据库实例（全局）
let db = null;

// 初始化数据库
async function initDatabase() {
  const SQL = await initSqlJs();

  // 确保数据库目录存在
  const dbPath = resolveDatabasePath();
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 每次启动先应用用户已确认的恢复请求，再为当前数据库保留一份轮转备份。
  // 这样即便迁移或后续写入中断，也能回到最近一次可用状态。
  const restoreResult = applyPendingDatabaseRestore(dbPath);
  if (restoreResult?.cancelled) {
    console.warn('⚠️ 数据库恢复请求已取消：数据库在请求后发生变化或恢复文件无效');
  } else if (restoreResult) {
    console.log(`✅ 已从备份恢复数据库：${restoreResult.backupFileName}`);
  }
  createDatabaseBackup(dbPath, { reason: 'startup' });

  // 加载或创建数据库
  let dbBuffer;
  if (fs.existsSync(dbPath)) {
    try {
      dbBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(dbBuffer);
      // sql.js 可能延迟到第一次查询才报告损坏，因此主动执行轻量探针。
      db.exec('PRAGMA schema_version');
    } catch (loadError) {
      try {
        db?.close();
      } catch (_) {}
      const fallback = listDatabaseBackups(dbPath).find((backup) => isSqliteFile(backup.filePath));
      if (!fallback) throw loadError;
      const corruptPath = `${dbPath}.corrupt-${Date.now()}`;
      fs.renameSync(dbPath, corruptPath);
      writeDatabaseAtomically(dbPath, fs.readFileSync(fallback.filePath), { backup: false });
      dbBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(dbBuffer);
      console.warn(`⚠️ 当前数据库无法读取，已保留为 ${corruptPath}`);
      console.warn(`✅ 已自动回退到最近备份：${fallback.fileName}`);
    }
  } else {
    db = new SQL.Database();
  }

  // 启用外键支持
  db.run('PRAGMA foreign_keys = ON');

  // ==================== 数据库迁移系统 ====================
  // 自动检测并添加缺失的字段，避免删除重建数据库

  /**
   * 检查表是否存在某列
   */
  function hasColumn(tableName, columnName) {
    try {
      const result = db.exec(`PRAGMA table_info(${tableName})`);
      if (result.length === 0) return false;
      return result[0].values.some(row => row[1] === columnName);
    } catch (e) {
      return false;
    }
  }

  /**
   * 安全地添加列（如果不存在）
   */
  function addColumnIfNotExists(tableName, columnName, columnDefinition) {
    if (!hasColumn(tableName, columnName)) {
      try {
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
        console.log(`✅ 已为 ${tableName} 添加字段: ${columnName}`);
        return true;
      } catch (e) {
        console.error(`❌ 添加字段失败 ${tableName}.${columnName}:`, e.message);
        return false;
      }
    }
    return false;
  }

  // ==================== 创建/更新表结构 ====================

  // 创建书籍表
  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      genre TEXT NOT NULL,
      subgenre TEXT DEFAULT '',
      description TEXT DEFAULT '',
      author TEXT DEFAULT '',
      status TEXT DEFAULT 'writing' CHECK(status IN ('writing', 'completed', 'paused')),
      cover_image TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      target_platform TEXT DEFAULT 'qidian' CHECK(target_platform IN ('qidian', 'fanqie', 'custom')),
      writing_style TEXT DEFAULT 'fast_pace' CHECK(writing_style IN ('fast_pace', 'detailed', 'balanced')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 迁移：为旧表添加缺失的字段
  addColumnIfNotExists('books', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('books', 'subgenre', "TEXT DEFAULT ''");
  addColumnIfNotExists('books', 'tags', "TEXT DEFAULT '[]'");
  addColumnIfNotExists('books', 'target_platform', "TEXT DEFAULT 'qidian'");
  addColumnIfNotExists('books', 'writing_style', "TEXT DEFAULT 'fast_pace'");

  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id)');

  // 创建章节表
  db.run(`
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      chapter_number INTEGER NOT NULL,
      chapter_name TEXT DEFAULT '',
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      word_count INTEGER DEFAULT 0,
      outline TEXT DEFAULT '',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  // 迁移：为旧表添加缺失的字段
  addColumnIfNotExists('chapters', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('chapters', 'chapter_name', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapters', 'word_count', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('chapters', 'outline', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapters', 'content_version_type', "TEXT DEFAULT 'generation'");
  addColumnIfNotExists('chapters', 'content_version_number', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('chapters', 'content_revision_target', "TEXT DEFAULT ''");

  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapters_chapter_number ON chapters(book_id, chapter_number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapters_user_id ON chapters(user_id)');

  // 章节正文版本：在 AI 重生成、校改、删除和恢复前保留旧稿。
  // 不对 chapter_id 建外键，确保章节被删除后仍能从历史版本恢复。
  db.run(`
    CREATE TABLE IF NOT EXISTS chapter_versions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT DEFAULT '',
      book_id TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      title TEXT DEFAULT '',
      chapter_name TEXT DEFAULT '',
      content TEXT DEFAULT '',
      word_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      source TEXT DEFAULT 'automatic',
      reason TEXT DEFAULT '',
      version_type TEXT DEFAULT 'generation',
      version_number INTEGER DEFAULT 0,
      revision_target TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  addColumnIfNotExists('chapter_versions', 'version_type', "TEXT DEFAULT 'generation'");
  addColumnIfNotExists('chapter_versions', 'version_number', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('chapter_versions', 'revision_target', "TEXT DEFAULT ''");
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_versions_book_chapter ON chapter_versions(book_id, chapter_number, created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_versions_chapter_id ON chapter_versions(chapter_id, created_at)');

  // 旧版本没有分类与编号：无法可靠还原旧校改目标，统一按生成稿迁移并按时间补号。
  db.run(`
    UPDATE chapter_versions
    SET version_type = CASE
      WHEN version_type IN ('generation', 'revision') THEN version_type
      ELSE 'generation'
    END
  `);
  db.run(`
    UPDATE chapter_versions
    SET version_number = (
      SELECT COUNT(*)
      FROM chapter_versions AS earlier
      WHERE earlier.book_id = chapter_versions.book_id
        AND earlier.chapter_number = chapter_versions.chapter_number
        AND earlier.version_type = 'generation'
        AND (
          datetime(earlier.created_at) < datetime(chapter_versions.created_at)
          OR (
            datetime(earlier.created_at) = datetime(chapter_versions.created_at)
            AND earlier.rowid <= chapter_versions.rowid
          )
        )
    )
    WHERE version_type = 'generation' AND COALESCE(version_number, 0) <= 0
  `);
  db.run(`
    UPDATE chapters
    SET content_version_type = CASE
      WHEN content_version_type IN ('generation', 'revision') THEN content_version_type
      ELSE 'generation'
    END
  `);
  db.run(`
    UPDATE chapters
    SET content_version_number = COALESCE((
      SELECT MAX(version_number) + 1
      FROM chapter_versions
      WHERE chapter_versions.book_id = chapters.book_id
        AND chapter_versions.chapter_number = chapters.chapter_number
        AND chapter_versions.version_type = 'generation'
    ), 1)
    WHERE LENGTH(TRIM(COALESCE(content, ''))) > 0
      AND content_version_type = 'generation'
      AND COALESCE(content_version_number, 0) <= 0
  `);

  // 创建章节规划表
  db.run(`
    CREATE TABLE IF NOT EXISTS chapter_plans (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      chapter_id TEXT DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      volume_number INTEGER DEFAULT 1,
      chapter_number INTEGER NOT NULL,
      chapter_name TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      chapter_mission TEXT DEFAULT '',
      emotion_target TEXT DEFAULT '',
      outline_text TEXT DEFAULT '',
      scene_outline TEXT DEFAULT '[]',
      character_notes TEXT DEFAULT '',
      appearing_roles TEXT DEFAULT '[]',
      previous_hook TEXT DEFAULT '',
      ending_hook TEXT DEFAULT '',
      main_storyline_id TEXT DEFAULT '',
      target_storylines TEXT DEFAULT '[]',
      structured_content TEXT DEFAULT '',
      source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'ai', 'imported')),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'generated', 'locked')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    )
  `);

  addColumnIfNotExists('chapter_plans', 'chapter_id', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'volume_number', 'INTEGER DEFAULT 1');
  addColumnIfNotExists('chapter_plans', 'chapter_name', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'summary', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'chapter_mission', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'emotion_target', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'outline_text', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'scene_outline', "TEXT DEFAULT '[]'");
  addColumnIfNotExists('chapter_plans', 'character_notes', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'appearing_roles', "TEXT DEFAULT '[]'");
  addColumnIfNotExists('chapter_plans', 'previous_hook', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'ending_hook', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'main_storyline_id', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'target_storylines', "TEXT DEFAULT '[]'");
  addColumnIfNotExists('chapter_plans', 'structured_content', "TEXT DEFAULT ''");
  addColumnIfNotExists('chapter_plans', 'source', "TEXT DEFAULT 'manual'");
  addColumnIfNotExists('chapter_plans', 'status', "TEXT DEFAULT 'draft'");
  addColumnIfNotExists('chapter_plans', 'updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP");

  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_plans_book_id ON chapter_plans(book_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_plans_book_chapter ON chapter_plans(book_id, chapter_number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_plans_chapter_id ON chapter_plans(chapter_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_plans_volume ON chapter_plans(book_id, volume_number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_plans_main_storyline ON chapter_plans(main_storyline_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_plans_user_id ON chapter_plans(user_id)');

  // 章节反馈正式主表：保留 chapter_plans.structured_content.chapter_feedback 作为兼容镜像。
  db.run(`
    CREATE TABLE IF NOT EXISTS chapter_feedback (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      chapter_id TEXT DEFAULT '',
      chapter_number INTEGER NOT NULL,
      feedback_json TEXT NOT NULL DEFAULT '{}',
      quality_status TEXT DEFAULT '',
      needs_human_review INTEGER DEFAULT 0,
      source TEXT DEFAULT 'model_feedback',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(book_id, chapter_number),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_feedback_book_chapter ON chapter_feedback(book_id, chapter_number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_feedback_updated_at ON chapter_feedback(book_id, updated_at)');

  // 首次迁移时把旧 JSON 反馈复制到正式表；已有独立记录不被旧镜像覆盖。
  const legacyFeedbackResult = db.exec(`
    SELECT id, book_id, chapter_id, chapter_number, structured_content
    FROM chapter_plans
    WHERE TRIM(COALESCE(structured_content, '')) <> ''
      AND EXISTS (
        SELECT 1
        FROM books
        WHERE books.id = chapter_plans.book_id
      )
    ORDER BY updated_at DESC, created_at DESC
  `);
  const legacyFeedbackRows = legacyFeedbackResult.length > 0 ? legacyFeedbackResult[0].values : [];
  legacyFeedbackRows.forEach(([planId, bookId, chapterId, chapterNumber, structuredText]) => {
    let structuredContent = {};
    try {
      structuredContent = JSON.parse(structuredText || '{}') || {};
    } catch (_) {}
    const feedback = structuredContent?.chapter_feedback;
    if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) return;
    const qualityCheck = feedback.quality_check && typeof feedback.quality_check === 'object'
      ? feedback.quality_check
      : {};
    const qualityStatus = String(qualityCheck.status || qualityCheck.verdict || '').trim();
    const needsHumanReview = qualityCheck.needs_human_review || qualityCheck.needsHumanReview ? 1 : 0;
    db.run(`
      INSERT OR IGNORE INTO chapter_feedback (
        id, book_id, chapter_id, chapter_number, feedback_json,
        quality_status, needs_human_review, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `${planId}-feedback`, bookId, chapterId || '', Number(chapterNumber || 0),
      JSON.stringify(feedback), qualityStatus, needsHumanReview,
      String(feedback.source || 'model_feedback')
    ]);
  });

  // 创建全书规划主表
  db.run(`
    CREATE TABLE IF NOT EXISTS book_plans (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      premise TEXT DEFAULT '',
      main_goal TEXT DEFAULT '',
      core_conflict TEXT DEFAULT '',
      world_rules TEXT DEFAULT '',
      role_summary TEXT DEFAULT '',
      main_outline TEXT DEFAULT '',
      volume_outline TEXT DEFAULT '',
      detailed_outline TEXT DEFAULT '',
      structured_content TEXT DEFAULT '',
      source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'ai', 'imported', 'mixed')),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'generated', 'confirmed', 'archived')),
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  addColumnIfNotExists('book_plans', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('book_plans', 'premise', "TEXT DEFAULT ''");
  addColumnIfNotExists('book_plans', 'main_goal', "TEXT DEFAULT ''");
  addColumnIfNotExists('book_plans', 'core_conflict', "TEXT DEFAULT ''");
  addColumnIfNotExists('book_plans', 'world_rules', "TEXT DEFAULT ''");
  addColumnIfNotExists('book_plans', 'role_summary', "TEXT DEFAULT ''");
  addColumnIfNotExists('book_plans', 'main_outline', "TEXT DEFAULT ''");
  addColumnIfNotExists('book_plans', 'volume_outline', "TEXT DEFAULT ''");
  addColumnIfNotExists('book_plans', 'detailed_outline', "TEXT DEFAULT ''");
  addColumnIfNotExists('book_plans', 'structured_content', "TEXT DEFAULT ''");
  addColumnIfNotExists('book_plans', 'source', "TEXT DEFAULT 'manual'");
  addColumnIfNotExists('book_plans', 'status', "TEXT DEFAULT 'draft'");
  addColumnIfNotExists('book_plans', 'version', 'INTEGER DEFAULT 1');
  addColumnIfNotExists('book_plans', 'updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP");

  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_book_plans_book_user ON book_plans(book_id, user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_book_plans_book_id ON book_plans(book_id)');

  // 创建分卷规划主表
  db.run(`
    CREATE TABLE IF NOT EXISTS volume_plans (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      volume_number INTEGER NOT NULL,
      volume_name TEXT DEFAULT '',
      volume_theme TEXT DEFAULT '',
      stage_goal TEXT DEFAULT '',
      core_conflict TEXT DEFAULT '',
      start_role_state TEXT DEFAULT '',
      end_role_state TEXT DEFAULT '',
      estimated_chapters INTEGER DEFAULT 15,
      storyline_quota INTEGER DEFAULT 3,
      structured_content TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'ai', 'imported', 'mixed')),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'generated', 'confirmed', 'archived')),
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  addColumnIfNotExists('volume_plans', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'volume_name', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'volume_theme', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'stage_goal', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'core_conflict', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'start_role_state', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'end_role_state', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'estimated_chapters', 'INTEGER DEFAULT 15');
  addColumnIfNotExists('volume_plans', 'storyline_quota', 'INTEGER DEFAULT 3');
  addColumnIfNotExists('volume_plans', 'structured_content', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'notes', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'cover_image', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_plans', 'source', "TEXT DEFAULT 'manual'");
  addColumnIfNotExists('volume_plans', 'status', "TEXT DEFAULT 'draft'");
  addColumnIfNotExists('volume_plans', 'version', 'INTEGER DEFAULT 1');
  addColumnIfNotExists('volume_plans', 'updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP");

  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_volume_plans_book_volume_user ON volume_plans(book_id, volume_number, user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_volume_plans_book_id ON volume_plans(book_id)');

  // 创建创作模板表
  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      genre TEXT NOT NULL,
      subgenre TEXT DEFAULT '',
      platform TEXT DEFAULT 'custom' CHECK(platform IN ('qidian', 'fanqie', 'custom')),
      description TEXT DEFAULT '',
      prompt_template TEXT NOT NULL,
      default_settings TEXT DEFAULT '{}',
      is_builtin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 迁移：为旧表添加缺失的字段
  addColumnIfNotExists('templates', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('templates', 'subgenre', "TEXT DEFAULT ''");
  addColumnIfNotExists('templates', 'platform', "TEXT DEFAULT 'custom'");
  addColumnIfNotExists('templates', 'default_settings', "TEXT DEFAULT '{}'");
  addColumnIfNotExists('templates', 'is_builtin', 'INTEGER DEFAULT 0');

  db.run('CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id)');

  // 创建伏笔追踪表
  db.run(`
    CREATE TABLE IF NOT EXISTS foreshadowing (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'hinted', 'resolved')),
      chapter_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    )
  `);

  // 迁移：为旧表添加缺失的字段
  addColumnIfNotExists('foreshadowing', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('foreshadowing', 'chapter_id', 'TEXT');
  addColumnIfNotExists('foreshadowing', 'resolved_at', 'DATETIME');

  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_foreshadowing_book_id ON foreshadowing(book_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_foreshadowing_status ON foreshadowing(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_foreshadowing_user_id ON foreshadowing(user_id)');

  // 创建角色表
  db.run(`
    CREATE TABLE IF NOT EXISTS novel_characters (
      id TEXT PRIMARY KEY,
      book_id TEXT,
      user_id TEXT NOT NULL DEFAULT '',
      name TEXT,
      appearance TEXT,
      personality TEXT,
      background TEXT,
      notes TEXT DEFAULT '',
      character_type TEXT NOT NULL DEFAULT 'main_character', -- main_character: 主角与重要配角, chapter_character: 章节新增角色
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  // 迁移：为旧表添加缺失的字段
  addColumnIfNotExists('novel_characters', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('novel_characters', 'character_type', "TEXT NOT NULL DEFAULT 'main_character'");
  addColumnIfNotExists('novel_characters', 'notes', "TEXT DEFAULT ''");
  addColumnIfNotExists('novel_characters', 'role_tier', "TEXT NOT NULL DEFAULT 'supporting_major'");
  addColumnIfNotExists('novel_characters', 'avatar_image', "TEXT DEFAULT ''");

  db.run('CREATE INDEX IF NOT EXISTS idx_characters_book_id ON novel_characters(book_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_characters_user_id ON novel_characters(user_id)');

  // 旧大纲路径已退场，不迁移也不保留旧数据。
  db.run('DROP TABLE IF EXISTS novel_outlines');

  db.run('CREATE INDEX IF NOT EXISTS idx_novel_characters_book_id ON novel_characters(book_id)');

  // 分卷设定表
  db.run(`
    CREATE TABLE IF NOT EXISTS volume_settings (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      volume_number INTEGER NOT NULL,
      volume_name TEXT DEFAULT '',
      volume_theme TEXT DEFAULT '',
      estimated_chapters INTEGER DEFAULT 15,
      volume_position TEXT DEFAULT 'middle',
      storyline_count INTEGER DEFAULT 3,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  addColumnIfNotExists('volume_settings', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('volume_settings', 'volume_name', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_settings', 'volume_theme', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_settings', 'estimated_chapters', 'INTEGER DEFAULT 15');
  addColumnIfNotExists('volume_settings', 'volume_position', "TEXT DEFAULT 'middle'");
  addColumnIfNotExists('volume_settings', 'storyline_count', 'INTEGER DEFAULT 3');
  addColumnIfNotExists('volume_settings', 'notes', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_settings', 'status', "TEXT DEFAULT 'draft'");
  addColumnIfNotExists('volume_settings', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

  db.run('CREATE INDEX IF NOT EXISTS idx_volume_settings_book_id ON volume_settings(book_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_volume_settings_book_volume ON volume_settings(book_id, volume_number)');

  // 剧情线表
  db.run(`
    CREATE TABLE IF NOT EXISTS storylines (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      volume_number INTEGER DEFAULT 1,
      storyline_number INTEGER DEFAULT 1,
      storyline_name TEXT NOT NULL,
      storyline_type TEXT DEFAULT 'branch',
      description TEXT DEFAULT '',
      involved_characters TEXT DEFAULT '[]',
      start_chapter INTEGER DEFAULT 1,
      end_chapter INTEGER DEFAULT 10,
      key_nodes TEXT DEFAULT '[]',
      core_conflict TEXT DEFAULT '',
      structured_content TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  addColumnIfNotExists('storylines', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('storylines', 'volume_number', 'INTEGER DEFAULT 1');
  addColumnIfNotExists('storylines', 'storyline_number', 'INTEGER DEFAULT 1');
  addColumnIfNotExists('storylines', 'storyline_type', "TEXT DEFAULT 'branch'");
  addColumnIfNotExists('storylines', 'description', "TEXT DEFAULT ''");
  addColumnIfNotExists('storylines', 'involved_characters', "TEXT DEFAULT '[]'");
  addColumnIfNotExists('storylines', 'start_chapter', 'INTEGER DEFAULT 1');
  addColumnIfNotExists('storylines', 'end_chapter', 'INTEGER DEFAULT 10');
  addColumnIfNotExists('storylines', 'key_nodes', "TEXT DEFAULT '[]'");
  addColumnIfNotExists('storylines', 'core_conflict', "TEXT DEFAULT ''");
  addColumnIfNotExists('storylines', 'structured_content', "TEXT DEFAULT ''");
  addColumnIfNotExists('storylines', 'status', "TEXT DEFAULT 'draft'");
  addColumnIfNotExists('storylines', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

  db.run('CREATE INDEX IF NOT EXISTS idx_storylines_book_id ON storylines(book_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_storylines_book_volume ON storylines(book_id, volume_number)');

  // 卷级时间线表
  db.run(`
    CREATE TABLE IF NOT EXISTS volume_timelines (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      volume_number INTEGER NOT NULL,
      total_chapters INTEGER DEFAULT 0,
      timeline_data TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  addColumnIfNotExists('volume_timelines', 'user_id', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('volume_timelines', 'total_chapters', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('volume_timelines', 'timeline_data', "TEXT DEFAULT ''");
  addColumnIfNotExists('volume_timelines', 'status', "TEXT DEFAULT 'draft'");
  addColumnIfNotExists('volume_timelines', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

  db.run('CREATE INDEX IF NOT EXISTS idx_volume_timelines_book_volume ON volume_timelines(book_id, volume_number)');

  // 章节-角色关联表
  db.run(`
    CREATE TABLE IF NOT EXISTS chapter_characters (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      role_in_chapter TEXT DEFAULT 'supporting',
      state_snapshot TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES novel_characters(id) ON DELETE CASCADE
    )
  `);

  addColumnIfNotExists('chapter_characters', 'role_in_chapter', "TEXT DEFAULT 'supporting'");
  addColumnIfNotExists('chapter_characters', 'state_snapshot', "TEXT DEFAULT ''");
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_characters_chapter_id ON chapter_characters(chapter_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapter_characters_character_id ON chapter_characters(character_id)');

  // 模型生成运行台账：保留可复现输入、参数、原始输出和门禁结果。
  db.run(`
    CREATE TABLE IF NOT EXISTS generation_runs (
      id TEXT PRIMARY KEY,
      book_id TEXT DEFAULT '',
      chapter_number INTEGER DEFAULT 0,
      prompt_type TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      prompt_hash TEXT NOT NULL,
      prompt_text TEXT DEFAULT '',
      context_snapshot_hash TEXT DEFAULT '',
      context_snapshot_json TEXT DEFAULT '{}',
      model TEXT DEFAULT '',
      temperature REAL,
      max_tokens INTEGER,
      response_format TEXT DEFAULT '',
      raw_output TEXT DEFAULT '',
      final_output TEXT DEFAULT '',
      finish_reason TEXT DEFAULT '',
      usage_json TEXT DEFAULT '{}',
      duration_ms INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      judge_raw_json TEXT DEFAULT '{}',
      judge_normalized_json TEXT DEFAULT '{}',
      gate_decision TEXT DEFAULT '',
      status TEXT DEFAULT 'completed',
      error_text TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_generation_runs_book_chapter ON generation_runs(book_id, chapter_number, created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_generation_runs_prompt ON generation_runs(prompt_type, prompt_version, created_at)');

  // Judge 人工盲标：只保存评审结果，不把 Judge 预测混入盲标样本。
  db.run(`
    CREATE TABLE IF NOT EXISTS calibration_reviews (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      sample_id TEXT NOT NULL,
      sample_hash TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      review_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(book_id, sample_id, reviewer)
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_calibration_reviews_book_sample ON calibration_reviews(book_id, sample_id)');

  db.run(`
    CREATE TABLE IF NOT EXISTS continuity_events (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      subject TEXT DEFAULT '',
      fact_text TEXT NOT NULL,
      evidence_text TEXT DEFAULT '',
      source TEXT DEFAULT 'model_feedback',
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_continuity_events_book_chapter ON continuity_events(book_id, chapter_number)');

  db.run(`
    CREATE TABLE IF NOT EXISTS character_state_ledger (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      character_name TEXT NOT NULL,
      role_text TEXT DEFAULT '',
      relationship_text TEXT DEFAULT '',
      state_text TEXT DEFAULT '',
      appearance_text TEXT DEFAULT '',
      note_text TEXT DEFAULT '',
      evidence_text TEXT DEFAULT '',
      source TEXT DEFAULT 'model_feedback',
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_character_state_ledger_lookup ON character_state_ledger(book_id, character_name, chapter_number)');

  db.run(`
    CREATE TABLE IF NOT EXISTS foreshadow_ledger (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      foreshadow_key TEXT NOT NULL,
      title TEXT NOT NULL,
      state TEXT DEFAULT 'open',
      due_chapter INTEGER DEFAULT 0,
      evidence_text TEXT DEFAULT '',
      source TEXT DEFAULT 'model_feedback',
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_foreshadow_ledger_lookup ON foreshadow_ledger(book_id, foreshadow_key, chapter_number)');

  // 创建用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    )
  `);

  // 迁移：为旧表添加缺失的字段
  addColumnIfNotExists('users', 'email', "TEXT DEFAULT ''");
  addColumnIfNotExists('users', 'avatar', "TEXT DEFAULT ''");
  addColumnIfNotExists('users', 'phone', "TEXT DEFAULT ''");
  addColumnIfNotExists('users', 'display_name', "TEXT DEFAULT ''");
  addColumnIfNotExists('users', 'settings_json', "TEXT DEFAULT '{}'");
  addColumnIfNotExists('users', 'password_enabled', 'INTEGER DEFAULT 1');
  addColumnIfNotExists('users', 'phone_verified_at', 'DATETIME');
  addColumnIfNotExists('users', 'role', "TEXT DEFAULT 'user'");
  addColumnIfNotExists('users', 'status', "TEXT DEFAULT 'active'");
  addColumnIfNotExists('users', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  addColumnIfNotExists('users', 'last_login_at', 'DATETIME');

  // 创建用户索引
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE TRIM(COALESCE(phone, '')) <> ''");
  db.run('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');

  db.run(`
    CREATE TABLE IF NOT EXISTS auth_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('qq', 'wechat')),
      provider_user_id TEXT NOT NULL,
      union_id TEXT DEFAULT '',
      display_name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, provider_user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id)');

  db.run(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      device_name TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, revoked_at)');

  db.run(`
    CREATE TABLE IF NOT EXISTS sms_verification_codes (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK(purpose IN ('register', 'login', 'bind_phone', 'reset_password')),
      code_hash TEXT NOT NULL,
      request_ip TEXT DEFAULT '',
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME,
      attempt_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_sms_codes_lookup ON sms_verification_codes(phone, purpose, created_at)');
  addColumnIfNotExists('sms_verification_codes', 'provider', "TEXT NOT NULL DEFAULT 'development'");
  addColumnIfNotExists('sms_verification_codes', 'provider_out_id', "TEXT DEFAULT ''");
  addColumnIfNotExists('sms_verification_codes', 'provider_biz_id', "TEXT DEFAULT ''");

  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY,
      state_hash TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL CHECK(provider IN ('qq', 'wechat')),
      user_id TEXT DEFAULT '',
      return_url TEXT DEFAULT '',
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  addColumnIfNotExists('oauth_states', 'user_id', "TEXT DEFAULT ''");

  db.run(`
    CREATE TABLE IF NOT EXISTS auth_handoffs (
      id TEXT PRIMARY KEY,
      handoff_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 插入内置模板
  const builtinTemplates = TEMPLATES;

  // 检查是否已有模板
  const existingTemplates = db.exec('SELECT COUNT(*) as count FROM templates');
  const count = existingTemplates.length > 0 ? existingTemplates[0].values[0][0] : 0;

  if (count === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO templates (id, name, genre, subgenre, platform, description, prompt_template, default_settings, is_builtin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const template of builtinTemplates) {
      insertTemplate.run([
        template.id,
        template.name,
        template.genre,
        template.subgenre || '',
        template.platform || 'custom',
        template.description || '',
        template.prompt_template,
        JSON.stringify(template.default_settings || {}),
        template.is_builtin || 0
      ]);
    }

    console.log(`✅ 已插入 ${builtinTemplates.length} 个内置创作模板`);
  }

  // 清理所有书籍级表的孤儿数据。启动前已有备份，清理结果可恢复。
  const bookScopedTables = [
    'chapters',
    'chapter_versions',
    'chapter_plans',
    'chapter_feedback',
    'book_plans',
    'volume_plans',
    'foreshadowing',
    'novel_characters',
    'volume_settings',
    'storylines',
    'volume_timelines',
    'chapter_characters',
    'generation_runs',
    'calibration_reviews',
    'continuity_events',
    'character_state_ledger',
    'foreshadow_ledger'
  ];
  bookScopedTables.forEach((tableName) => {
    const result = db.exec(`
      SELECT COUNT(*)
      FROM ${tableName}
      WHERE TRIM(COALESCE(book_id, '')) <> ''
        AND book_id NOT IN (SELECT id FROM books)
    `);
    const count = Number(result?.[0]?.values?.[0]?.[0] || 0);
    if (count > 0) {
      db.run(`
        DELETE FROM ${tableName}
        WHERE TRIM(COALESCE(book_id, '')) <> ''
          AND book_id NOT IN (SELECT id FROM books)
      `);
      console.log(`🧹 已清理 ${count} 条 ${tableName} 孤儿数据`);
    }
  });

  // 保存数据库到文件
  const data = db.export();
  const buffer = Buffer.from(data);
  writeDatabaseAtomically(dbPath, buffer, { backup: false });

  console.log('✅ 数据库初始化完成');
  console.log(`📁 数据库路径: ${dbPath}`);

  return db;
}

// 导出数据库实例（异步初始化）
module.exports = initDatabase();
