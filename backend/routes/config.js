const express = require('express');
const router = express.Router();
const configService = require('../services/novel-config-service');

// 获取所有小说分类
router.get('/categories', (req, res) => {
  try {
    const categories = configService.getAllCategories();

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类失败'
    });
  }
});

// 获取特定分类的详细信息
router.get('/categories/:genre', (req, res) => {
  try {
    const { genre } = req.params;
    const category = configService.getCategoryById(genre);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    res.json({
      success: true,
      data: {
        id: genre,
        ...category
      }
    });
  } catch (error) {
    console.error('获取分类详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类详情失败'
    });
  }
});

// 获取平台特色配置
router.get('/platforms', (req, res) => {
  try {
    res.json({
      success: true,
      data: configService.getPlatformFeatures()
    });
  } catch (error) {
    console.error('获取平台配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取平台配置失败'
    });
  }
});

// 获取爽点标签
router.get('/shuang-points', (req, res) => {
  try {
    const { genre } = req.query;
    const points = configService.getShuangPoints(genre);

    res.json({
      success: true,
      data: points
    });
  } catch (error) {
    console.error('获取爽点标签失败:', error);
    res.status(500).json({
      success: false,
      message: '获取爽点标签失败'
    });
  }
});

// 获取写作风格预设
router.get('/writing-styles', (req, res) => {
  try {
    res.json({
      success: true,
      data: configService.getWritingStyles()
    });
  } catch (error) {
    console.error('获取写作风格失败:', error);
    res.status(500).json({
      success: false,
      message: '获取写作风格失败'
    });
  }
});

// 获取模板列表
router.get('/templates', (req, res) => {
  try {
    const { genre, platform, subgenre } = req.query;

    const filters = {};
    if (genre) filters.genre = genre;
    if (platform) filters.platform = platform;
    if (subgenre) filters.subgenre = subgenre;

    const templates = configService.getTemplatesByFilter(filters);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('获取模板列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板列表失败'
    });
  }
});

// 获取单个模板详情
router.get('/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const template = configService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('获取模板详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板详情失败'
    });
  }
});

// 创建自定义模板
router.post('/templates', (req, res) => {
  try {
    const { name, genre, subgenre, platform, description, prompt_template, default_settings } = req.body;

    if (!name || !genre || !prompt_template) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    const newTemplate = configService.addCustomTemplate({
      name,
      genre,
      subgenre: subgenre || '',
      platform: platform || 'custom',
      description: description || '',
      prompt_template,
      default_settings: typeof default_settings === 'string' ? JSON.parse(default_settings) : default_settings || {}
    });

    res.json({
      success: true,
      message: '模板创建成功',
      data: newTemplate
    });
  } catch (error) {
    console.error('创建模板失败:', error);
    res.status(500).json({
      success: false,
      message: '创建模板失败'
    });
  }
});

// 删除自定义模板
router.delete('/templates/:id', (req, res) => {
  try {
    const { id } = req.params;

    configService.deleteCustomTemplate(id);

    res.json({
      success: true,
      message: '模板删除成功'
    });
  } catch (error) {
    console.error('删除模板失败:', error);
    res.status(error.message === '模板不存在' ? 404 : 403).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
