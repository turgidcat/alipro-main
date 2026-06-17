/**
 * 输入验证中间件
 */

/**
 * 验证字符串非空且长度在范围内
 */
const validateString = (value, fieldName, options = {}) => {
  const { minLength = 1, maxLength = 10000, required = true } = options;

  if (required && (!value || value.trim() === '')) {
    return `${fieldName}不能为空`;
  }

  if (value && value.length < minLength) {
    return `${fieldName}长度不能少于${minLength}个字符`;
  }

  if (value && value.length > maxLength) {
    return `${fieldName}长度不能超过${maxLength}个字符`;
  }

  return null;
};

/**
 * 验证数字范围
 */
const validateNumber = (value, fieldName, options = {}) => {
  const { min, max, required = false } = options;

  if (required && (value === undefined || value === null)) {
    return `${fieldName}不能为空`;
  }

  if (value !== undefined && value !== null) {
    if (typeof value !== 'number' || isNaN(value)) {
      return `${fieldName}必须是有效数字`;
    }

    if (min !== undefined && value < min) {
      return `${fieldName}不能小于${min}`;
    }

    if (max !== undefined && value > max) {
      return `${fieldName}不能大于${max}`;
    }
  }

  return null;
};

/**
 * 验证数组
 */
const validateArray = (value, fieldName, options = {}) => {
  const { required = false, maxLength = 100 } = options;

  if (required && (!value || !Array.isArray(value))) {
    return `${fieldName}不能为空`;
  }

  if (value && Array.isArray(value) && value.length > maxLength) {
    return `${fieldName}不能超过${maxLength}项`;
  }

  return null;
};

const validateObject = (value, fieldName, options = {}) => {
  const { required = false } = options;

  if (required && (!value || typeof value !== 'object' || Array.isArray(value))) {
    return `${fieldName}不能为空`;
  }

  if (value !== undefined && value !== null && (typeof value !== 'object' || Array.isArray(value))) {
    return `${fieldName}必须是有效对象`;
  }

  return null;
};

/**
 * 通用验证函数
 */
const validate = (rules, body) => {
  const errors = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = body[field];
    let error = null;

    switch (rule.type) {
      case 'string':
        error = validateString(value, field, rule);
        break;
      case 'number':
        error = validateNumber(value, field, rule);
        break;
      case 'array':
        error = validateArray(value, field, rule);
        break;
      case 'object':
        error = validateObject(value, field, rule);
        break;
      default:
        error = `未知的验证类型: ${rule.type}`;
    }

    if (error) {
      errors.push(error);
    }
  }

  return errors;
};

/**
 * Express中间件：验证请求体
 */
const validateRequest = (rules) => {
  return (req, res, next) => {
    const errors = validate(rules, req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors[0], // 返回第一个错误
        allErrors: errors // 返回所有错误（可选）
      });
    }

    next();
  };
};

module.exports = {
  validateString,
  validateNumber,
  validateArray,
  validateObject,
  validate,
  validateRequest
};
