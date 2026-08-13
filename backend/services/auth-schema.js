function tableColumns(db, tableName) {
  const result = db.exec(`PRAGMA table_info('${tableName}')`);
  if (!result.length) return new Set();
  return new Set(result[0].values.map((row) => String(row[1])));
}

function addColumnIfMissing(db, tableName, columnName, definition) {
  if (tableColumns(db, tableName).has(columnName)) return;
  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function ensureAuthSchema(db) {
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
  addColumnIfMissing(db, 'users', 'email', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'users', 'avatar', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'users', 'phone', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'users', 'display_name', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'users', 'settings_json', "TEXT DEFAULT '{}'");
  addColumnIfMissing(db, 'users', 'password_enabled', 'INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'users', 'phone_verified_at', 'DATETIME');
  addColumnIfMissing(db, 'users', 'role', "TEXT DEFAULT 'user'");
  addColumnIfMissing(db, 'users', 'status', "TEXT DEFAULT 'active'");
  addColumnIfMissing(db, 'users', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  addColumnIfMissing(db, 'users', 'last_login_at', 'DATETIME');
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
  addColumnIfMissing(db, 'sms_verification_codes', 'provider', "TEXT NOT NULL DEFAULT 'development'");
  addColumnIfMissing(db, 'sms_verification_codes', 'provider_out_id', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'sms_verification_codes', 'provider_biz_id', "TEXT DEFAULT ''");
  db.run('CREATE INDEX IF NOT EXISTS idx_sms_codes_lookup ON sms_verification_codes(phone, purpose, created_at)');

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
  addColumnIfMissing(db, 'oauth_states', 'user_id', "TEXT DEFAULT ''");

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
}

module.exports = { ensureAuthSchema };
