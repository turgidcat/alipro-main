/**
 * 小说配置数据服务
 * 提供分类、模板、平台配置等数据的访问接口
 */

const fs = require('fs');
const path = require('path');
const { NOVEL_CATEGORIES, PLATFORM_FEATURES, SHUANG_POINTS, WRITING_STYLES } = require('../config/novel-config');
const TEMPLATES = require('../config/templates');

// 数据文件路径
const DATA_DIR = process.env.ALIPRO_DATA_DIR
  ? path.resolve(process.env.ALIPRO_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化模板数据文件
function initTemplatesFile() {
  if (!fs.existsSync(TEMPLATES_FILE)) {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(TEMPLATES, null, 2), 'utf-8');
    console.log('✅ 已初始化模板数据文件');
  }
}

// 读取所有模板
function getAllTemplates() {
  initTemplatesFile();
  const data = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
  return JSON.parse(data);
}

// 根据条件筛选模板
function getTemplatesByFilter(filters = {}) {
  let templates = getAllTemplates();

  if (filters.genre) {
    templates = templates.filter(t => t.genre === filters.genre);
  }

  if (filters.platform) {
    templates = templates.filter(t => t.platform === filters.platform);
  }

  if (filters.subgenre) {
    templates = templates.filter(t => t.subgenre === filters.subgenre);
  }

  return templates;
}

// 获取单个模板
function getTemplateById(id) {
  const templates = getAllTemplates();
  return templates.find(t => t.id === id);
}

// 添加自定义模板
function addCustomTemplate(template) {
  const templates = getAllTemplates();

  const newTemplate = {
    ...template,
    id: `template_custom_${Date.now()}`,
    is_builtin: 0,
    created_at: new Date().toISOString()
  };

  templates.push(newTemplate);
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');

  return newTemplate;
}

// 删除自定义模板
function deleteCustomTemplate(id) {
  let templates = getAllTemplates();
  const template = templates.find(t => t.id === id);

  if (!template) {
    throw new Error('模板不存在');
  }

  if (template.is_builtin === 1) {
    throw new Error('不能删除内置模板');
  }

  templates = templates.filter(t => t.id !== id);
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');

  return true;
}

// 获取所有分类
function getAllCategories() {
  return Object.keys(NOVEL_CATEGORIES).map(key => ({
    id: key,
    ...NOVEL_CATEGORIES[key]
  }));
}

// 获取单个分类详情
function getCategoryById(genre) {
  return NOVEL_CATEGORIES[genre] || null;
}

// 获取平台配置
function getPlatformFeatures() {
  return PLATFORM_FEATURES;
}

// 获取爽点标签
function getShuangPoints(genre = null) {
  let points = {
    common: SHUANG_POINTS.common
  };

  if (genre && SHUANG_POINTS[genre]) {
    points[genre] = SHUANG_POINTS[genre];
  }

  return points;
}

// 获取写作风格
function getWritingStyles() {
  return WRITING_STYLES;
}

module.exports = {
  getAllTemplates,
  getTemplatesByFilter,
  getTemplateById,
  addCustomTemplate,
  deleteCustomTemplate,
  getAllCategories,
  getCategoryById,
  getPlatformFeatures,
  getShuangPoints,
  getWritingStyles
};
