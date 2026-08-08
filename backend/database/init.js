const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const TEMPLATES = require('../config/templates');
const { resolveDatabasePath } = require('../config/runtime');

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

  // 加载或创建数据库
  let dbBuffer;
  if (fs.existsSync(dbPath)) {
    dbBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(dbBuffer);
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

  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapters_chapter_number ON chapters(book_id, chapter_number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chapters_user_id ON chapters(user_id)');

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
  addColumnIfNotExists('users', 'role', "TEXT DEFAULT 'user'");
  addColumnIfNotExists('users', 'status', "TEXT DEFAULT 'active'");
  addColumnIfNotExists('users', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  addColumnIfNotExists('users', 'last_login_at', 'DATETIME');

  // 创建用户索引
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');

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

  // 清理孤儿数据（章节/book_id指向不存在的书籍）
  const orphanChapters = db.exec("SELECT c.id FROM chapters c LEFT JOIN books b ON c.book_id = b.id WHERE b.id IS NULL");
  if (orphanChapters.length > 0 && orphanChapters[0].values.length > 0) {
    const count = orphanChapters[0].values.length;
    db.run("DELETE FROM chapters WHERE book_id NOT IN (SELECT id FROM books)");
    console.log(`🧹 已清理 ${count} 条孤儿章节数据`);
  }
  const orphanCharacters = db.exec("SELECT c.id FROM novel_characters c LEFT JOIN books b ON c.book_id = b.id WHERE b.id IS NULL");
  if (orphanCharacters.length > 0 && orphanCharacters[0].values.length > 0) {
    const count = orphanCharacters[0].values.length;
    db.run("DELETE FROM novel_characters WHERE book_id NOT IN (SELECT id FROM books)");
    console.log(`🧹 已清理 ${count} 条孤儿角色数据`);
  }

  // 保存数据库到文件
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log('✅ 数据库初始化完成');
  console.log(`📁 数据库路径: ${dbPath}`);

  return db;
}

// 导出数据库实例（异步初始化）
module.exports = initDatabase();
