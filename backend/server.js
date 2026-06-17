require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

// 导入路由
const aiRoutes = require('./routes/ai');
const configRoutes = require('./routes/config');
const dataRoutes = require('./routes/data');
const authRoutes = require('./routes/auth');
const outlineRoutes = require('./routes/outlines');
const storylineRoutes = require('./routes/storylines');
const planRoutes = require('./routes/plans');
const analysisRoutes = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = (process.env.NODE_ENV || 'development') !== 'production';
const reactDistDir = path.join(__dirname, '..', 'frontend-react', 'dist');
const reactIndexPath = path.join(reactDistDir, 'index.html');
const hasReactBuild = fs.existsSync(reactIndexPath);

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  brightYellow: '\x1b[93m',
  magenta: '\x1b[35m',
  brightWhite: '\x1b[97m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

function colorize(text, ...styles) {
  return `${styles.join('')}${text}${ANSI.reset}`;
}

function getDisplayWidth(text = '') {
  return Array.from(String(text)).reduce((width, char) => {
    const codePoint = char.codePointAt(0) || 0;

    if (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    ) {
      return width;
    }

    if (
      codePoint >= 0x1100 && (
        codePoint <= 0x115f ||
        codePoint === 0x2329 ||
        codePoint === 0x232a ||
        (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
        (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
        (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
        (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
        (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
        (codePoint >= 0xff00 && codePoint <= 0xff60) ||
        (codePoint >= 0xffe0 && codePoint <= 0xffe6)
      )
    ) {
      return width + 2;
    }

    return width + 1;
  }, 0);
}

function printStartupCard(lines = []) {
  const visibleWidth = Math.max(
    44,
    ...lines.map((line) => getDisplayWidth(String(line.raw || '')))
  );
  const border = '═'.repeat(visibleWidth + 2);

  console.log('');
  console.log(colorize(`╔${border}╗`, ANSI.blue));
  lines.forEach((line) => {
    const raw = String(line.raw || '');
    const styled = line.styled || raw;
    const padding = ' '.repeat(Math.max(0, visibleWidth - getDisplayWidth(raw)));
    console.log(colorize('║ ', ANSI.blue) + styled + padding + colorize(' ║', ANSI.blue));
  });
  console.log(colorize(`╚${border}╝`, ANSI.blue));
  console.log('');
}

// ==================== 中间件 ====================

// CORS 配置
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:3456',
    'http://127.0.0.1:3456',
    'http://turgidcat.space',
    'https://turgidcat.space',
    'null'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 解析请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// ==================== 路由 ====================

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api', aiRoutes);
app.use('/api/config', configRoutes);
app.use('/api', dataRoutes);
app.use('/api/outlines', outlineRoutes);
app.use('/api/storyline-workbench', storylineRoutes);
app.use('/api', planRoutes);
app.use('/api/analysis', analysisRoutes);

// React 工作台静态资源
if (hasReactBuild) {
  app.use(express.static(reactDistDir, {
    setHeaders: (res, filePath) => {
      if (isDevelopment && (filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.js'))) {
        setNoCacheHeaders(res);
        return;
      }

      if (filePath.endsWith('.html')) {
        setNoCacheHeaders(res);
      } else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'public, max-age=300');
      }
    }
  }));
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 历史数据库查看器入口已退场，统一回到当前正式前端入口
app.get('/database-view', (req, res) => {
  res.redirect('/');
});

// React 路由回退
app.get(/^(?!\/api\/|\/projects\/|\/health$|\/database-view$).*/, (req, res, next) => {
  if (!hasReactBuild) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const accept = req.get('accept') || '';
  if (!accept.includes('text/html')) return next();
  return res.sendFile(reactIndexPath);
});

// public 静态资源
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (isDevelopment && (filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.js'))) {
      setNoCacheHeaders(res);
      return;
    }

    if (filePath.endsWith('.html')) {
      setNoCacheHeaders(res);
    }
  }
}));

// 旧 API 兼容路径
app.use('/projects/alipro/api/auth', authRoutes);
app.use('/projects/alipro/api', aiRoutes);
app.use('/projects/alipro/api/config', configRoutes);
app.use('/projects/alipro/api', dataRoutes);
app.use('/projects/alipro/api/outlines', outlineRoutes);
app.use('/projects/alipro/api/storyline-workbench', storylineRoutes);
app.use('/projects/alipro/api', planRoutes);
app.use('/projects/alipro/api/analysis', analysisRoutes);

// ==================== 错误处理 ====================

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 全局错误
app.use((err, req, res, next) => {
  logger.error('服务器错误', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
  });
});

// ==================== 启动服务 ====================

app.listen(PORT, () => {
  logger.info('网文生成器后端服务已启动', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    apiDocs: `http://localhost:${PORT}/health`
  });

  const heroLeft = [
    '    _    _     ___   ____   ____    ___ ',
    '   / \\  | |   |_ _| |  _ \\ |  _ \\  / _ \\',
    '  / _ \\ | |    | |  | |_) || |_) || | | |',
    ' / ___ \\| |___ | |  |  __/ |  _ < | |_| |',
    '/_/   \\_\\_____||___| |_|    |_| \\_\\\\___/ '
  ];
  const catLines = [
    '             /\\_/\\\\',
    '            ( • • )',
    '             =^=  ~~'
  ];
  const heroLines = heroLeft.map((left) => ({
    raw: left,
    styled: colorize(left, ANSI.bold, ANSI.brightYellow)
  }));
  const heroCatLines = catLines.map((line) => ({
    raw: line,
    styled: colorize(line, ANSI.bold, ANSI.green)
  }));

  printStartupCard([
    ...heroLines,
    ...heroCatLines,
    {
      raw: '写作引擎已启动',
      styled: colorize('写作引擎已启动', ANSI.bold, ANSI.green)
    },
    { raw: '' },
    {
      raw: `后端地址   http://localhost:${PORT}`,
      styled: `${colorize('后端地址', ANSI.bold, ANSI.white)}   ${colorize(`http://localhost:${PORT}`, ANSI.cyan)}`
    },
    {
      raw: `环境模式   ${process.env.NODE_ENV || 'development'}`,
      styled: `${colorize('环境模式', ANSI.bold, ANSI.white)}   ${colorize(process.env.NODE_ENV || 'development', ANSI.yellow)}`
    },
    {
      raw: `健康检查   http://localhost:${PORT}/health`,
      styled: `${colorize('健康检查', ANSI.bold, ANSI.white)}   ${colorize(`http://localhost:${PORT}/health`, ANSI.green)}`
    },
    {
      raw: '数据库路径',
      styled: colorize('数据库路径', ANSI.bold, ANSI.white)
    },
    {
      raw: `  ${path.join(__dirname, 'database', 'novel.db')}`,
      styled: `  ${colorize(path.join(__dirname, 'database', 'novel.db'), ANSI.gray)}`
    },
    { raw: '' },
    {
      raw: '前端入口',
      styled: colorize('前端入口', ANSI.bold, ANSI.magenta)
    },
    {
      raw: '开发前端   http://localhost:5173',
      styled: `${colorize('开发前端', ANSI.bold, ANSI.white)}   ${colorize('http://localhost:5173', ANSI.cyan)}`
    },
    {
      raw: `新前端入口 http://localhost:${PORT}/`,
      styled: `${colorize('新前端入口', ANSI.bold, ANSI.white)} ${colorize(`http://localhost:${PORT}/`, ANSI.green)}`
    },
    { raw: '' },
    {
      raw: '联通检查',
      styled: colorize('联通检查', ANSI.bold, ANSI.magenta)
    },
    {
      raw: `GET  http://localhost:${PORT}/api/books`,
      styled: `${colorize('GET', ANSI.bold, ANSI.white)}  ${colorize(`http://localhost:${PORT}/api/books`, ANSI.gray)}`
    },
    {
      raw: 'GET  /api/analysis/codex-cost',
      styled: `${colorize('GET', ANSI.bold, ANSI.white)}  ${colorize('/api/analysis/codex-cost', ANSI.gray)}`
    },
    { raw: '' },
    {
      raw: '按 Ctrl+C 停止服务器',
      styled: colorize('按 Ctrl+C 停止服务器', ANSI.dim, ANSI.white)
    }
  ]);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到终止信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到中断信号，正在关闭服务器...');
  process.exit(0);
});

module.exports = app;
