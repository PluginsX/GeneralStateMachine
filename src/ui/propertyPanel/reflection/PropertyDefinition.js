class PropertyDefinition {
  constructor(propertyName, options = {}) {
    // 属性名称
    this.name = propertyName;
    
    // 显示名称（如果未提供则自动格式化propertyName）
    this.displayName = options.displayName || this._formatDisplayName(propertyName);
    
    // 属性类型
    this.type = options.type || 'string';
    
    // 是否可编辑
    this.editable = options.editable !== false;
    
    // 是否只读
    this.readOnly = !!options.readOnly;
    
    // 是否可见
    this.visible = options.visible !== false;
    
    // 描述文本
    this.description = options.description || '';
    
    // 分组名称
    this.group = options.group || 'Default';
    
    // 默认值
    this.defaultValue = options.defaultValue;
    
    // 验证规则
    this.validation = options.validation || null;
    
    // 自定义渲染器
    this.customRenderer = options.customRenderer || null;
    
    // 自定义编辑器
    this.customEditor = options.customEditor || null;
    
    // 排序权重
    this.order = options.order !== undefined ? options.order : 0;
    
    // 工具提示
    this.tooltip = options.tooltip || '';
    
    // 额外配置项（根据不同类型有不同选项）
    this.options = options.options || {};
    
    // 是否为高级选项
    this.advanced = !!options.advanced;
    
    // 依赖的其他属性
    this.dependencies = options.dependencies || [];
    
    // 值转换器（用于在UI和数据模型之间转换）
    this.valueConverter = options.valueConverter || null;
    
    // 格式化器（用于显示值）
    this.formatter = options.formatter || null;
    
    // 解析器（用于从字符串解析值）
    this.parser = options.parser || null;
    
    // 变更前钩子
    this.onBeforeChange = options.onBeforeChange || null;
    
    // 变更后钩子
    this.onAfterChange = options.onAfterChange || null;
    
    // 是否折叠（用于复杂类型）
    this.collapsed = !!options.collapsed;
    
    // 枚举值（用于选择器）
    this.enumValues = options.enumValues || null;
    
    // 最小值（用于数字类型）
    this.min = options.min !== undefined ? options.min : null;
    
    // 最大值（用于数字类型）
    this.max = options.max !== undefined ? options.max : null;
    
    // 步长（用于数字类型）
    this.step = options.step || 1;
    
    // 正则表达式验证（用于字符串类型）
    this.pattern = options.pattern || null;
    
    // 最大长度（用于字符串类型）
    this.maxLength = options.maxLength || null;
    
    // 最小长度（用于字符串类型）
    this.minLength = options.minLength || null;
    
    // 是否允许多行（用于字符串类型）
    this.multiline = !!options.multiline;
    
    // 占位符文本
    this.placeholder = options.placeholder || '';
    
    // 提示文本
    this.helperText = options.helperText || '';
    
    // 样式类名
    this.className = options.className || '';
    
    // 内联样式
    this.style = options.style || {};
    
    // 子属性定义（用于对象类型）
    this.children = options.children || {};
    
    // 数组项类型（用于数组类型）
    this.itemType = options.itemType || 'string';
    
    // 数组项配置（用于数组类型）
    this.itemOptions = options.itemOptions || {};
  }

  // 格式化显示名称
  _formatDisplayName(propertyName) {
    // 转换驼峰命名为空格分隔的名称，并首字母大写
    return propertyName
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^([a-z])/, match => match.toUpperCase());
  }

  // 验证值是否有效
  validate(value) {
    // 空值验证
    if (value === undefined || value === null) {
      if (this.validation && this.validation.required) {
        return { valid: false, message: this.validation.requiredMessage || 'This field is required' };
      }
      return { valid: true };
    }

    // 类型验证
    if (!this._validateType(value)) {
      return { valid: false, message: `Invalid type. Expected ${this.type}` };
    }

    // 范围验证（数字类型）
    if (this.type === 'number') {
      if (this.min !== null && value < this.min) {
        return { valid: false, message: `Value must be greater than or equal to ${this.min}` };
      }
      if (this.max !== null && value > this.max) {
        return { valid: false, message: `Value must be less than or equal to ${this.max}` };
      }
    }

    // 字符串长度验证
    if (this.type === 'string') {
      if (this.minLength !== null && value.length < this.minLength) {
        return { valid: false, message: `Length must be at least ${this.minLength} characters` };
      }
      if (this.maxLength !== null && value.length > this.maxLength) {
        return { valid: false, message: `Length must be at most ${this.maxLength} characters` };
      }
      if (this.pattern && !this.pattern.test(value)) {
        return { valid: false, message: this.validation?.patternMessage || 'Invalid format' };
      }
    }

    // 自定义验证器
    if (this.validation && typeof this.validation.validator === 'function') {
      const result = this.validation.validator(value, this);
      if (!result.valid) {
        return result;
      }
    }

    return { valid: true };
  }

  // 验证类型
  _validateType(value) {
    switch (this.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null;
      case 'array':
        return Array.isArray(value);
      case 'function':
        return typeof value === 'function';
      case 'date':
        return value instanceof Date;
      default:
        // 对于自定义类型，允许任何值
        return true;
    }
  }

  // 将值转换为UI显示格式
  formatValue(value) {
    if (this.formatter) {
      return this.formatter(value, this);
    }
    
    // 默认格式化
    switch (this.type) {
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
        return value instanceof Date ? value.toLocaleString() : String(value);
      case 'number':
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
      case 'array':
        return `[${value.length} items]`;
      case 'object':
        return '{...}';
      default:
        return String(value);
    }
  }

  // 从UI值解析为模型值
  parseValue(value) {
    if (this.parser) {
      return this.parser(value, this);
    }
    
    // 默认解析
    switch (this.type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true' || value === true || value === 1;
      case 'date':
        return new Date(value);
      default:
        return value;
    }
  }

  // 获取组件配置
  getComponentOptions() {
    const options = {
      displayName: this.displayName,
      description: this.description,
      disabled: this.readOnly || !this.editable,
      tooltip: this.tooltip,
      placeholder: this.placeholder,
      helperText: this.helperText,
      className: this.className,
      style: this.style
    };

    // 根据类型添加特定选项
    switch (this.type) {
      case 'string':
        Object.assign(options, {
          multiline: this.multiline,
          maxLength: this.maxLength,
          minLength: this.minLength,
          pattern: this.pattern
        });
        break;
      case 'number':
        Object.assign(options, {
          min: this.min,
          max: this.max,
          step: this.step
        });
        break;
      case 'select':
      case 'enum':
        Object.assign(options, {
          options: this.enumValues || []
        });
        break;
      case 'object':
        Object.assign(options, {
          properties: this.children,
          defaultExpanded: !this.collapsed
        });
        break;
      case 'array':
        Object.assign(options, {
          itemType: this.itemType,
          itemOptions: this.itemOptions,
          defaultExpanded: !this.collapsed
        });
        break;
    }

    return options;
  }

  // 克隆属性定义
  clone() {
    return new PropertyDefinition(this.name, {
      displayName: this.displayName,
      type: this.type,
      editable: this.editable,
      readOnly: this.readOnly,
      visible: this.visible,
      description: this.description,
      group: this.group,
      defaultValue: this.defaultValue,
      validation: this.validation,
      customRenderer: this.customRenderer,
      customEditor: this.customEditor,
      order: this.order,
      tooltip: this.tooltip,
      options: { ...this.options },
      advanced: this.advanced,
      dependencies: [...this.dependencies],
      valueConverter: this.valueConverter,
      formatter: this.formatter,
      parser: this.parser,
      onBeforeChange: this.onBeforeChange,
      onAfterChange: this.onAfterChange,
      collapsed: this.collapsed,
      enumValues: this.enumValues,
      min: this.min,
      max: this.max,
      step: this.step,
      pattern: this.pattern,
      maxLength: this.maxLength,
      minLength: this.minLength,
      multiline: this.multiline,
      placeholder: this.placeholder,
      helperText: this.helperText,
      className: this.className,
      style: { ...this.style },
      children: { ...this.children },
      itemType: this.itemType,
      itemOptions: { ...this.itemOptions }
    });
  }

  // 合并两个属性定义
  merge(other) {
    if (!(other instanceof PropertyDefinition)) {
      return this;
    }

    // 创建新的合并定义
    const merged = this.clone();

    // 合并属性
    Object.keys(other).forEach(key => {
      if (key !== 'name' && other[key] !== undefined) {
        // 对于对象类型，递归合并
        if (typeof other[key] === 'object' && other[key] !== null && !Array.isArray(other[key])) {
          merged[key] = { ...(merged[key] || {}), ...other[key] };
        } 
        // 对于数组类型，合并数组
        else if (Array.isArray(other[key])) {
          merged[key] = [...(merged[key] || []), ...other[key]];
        }
        // 对于基本类型，直接覆盖
        else {
          merged[key] = other[key];
        }
      }
    });

    return merged;
  }
}

export default PropertyDefinition;