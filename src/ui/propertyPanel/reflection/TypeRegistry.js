class TypeRegistry {
  static instance = null;

  constructor() {
    if (TypeRegistry.instance) {
      return TypeRegistry.instance;
    }

    // 存储类型到组件的映射
    this.typeComponentMap = new Map();
    
    // 存储类型到渲染器的映射
    this.typeRendererMap = new Map();
    
    // 存储类型到编辑器的映射
    this.typeEditorMap = new Map();
    
    // 存储类型到验证器的映射
    this.typeValidatorMap = new Map();
    
    // 存储类型到格式化器的映射
    this.typeFormatterMap = new Map();
    
    // 存储类型到解析器的映射
    this.typeParserMap = new Map();
    
    // 默认组件映射
    this._registerDefaultTypes();

    TypeRegistry.instance = this;
  }

  static getInstance() {
    if (!TypeRegistry.instance) {
      TypeRegistry.instance = new TypeRegistry();
    }
    return TypeRegistry.instance;
  }

  // 注册默认类型
  _registerDefaultTypes() {
    // 这里先注册基本的类型映射，实际组件会在后续导入
    this.registerComponentType('string', null); // 后续会映射到StringPropertyComponent
    this.registerComponentType('number', null); // 后续会映射到NumberPropertyComponent
    this.registerComponentType('boolean', null); // 后续会映射到BooleanPropertyComponent
    this.registerComponentType('select', null); // 后续会映射到SelectPropertyComponent
    this.registerComponentType('color', null); // 后续会映射到ColorPropertyComponent
    this.registerComponentType('array', null); // 后续会映射到ArrayPropertyComponent
    this.registerComponentType('object', null); // 后续会映射到ObjectPropertyComponent
    
    // 为基本类型注册默认验证器
    this.registerTypeValidator('string', this._validateString.bind(this));
    this.registerTypeValidator('number', this._validateNumber.bind(this));
    this.registerTypeValidator('boolean', this._validateBoolean.bind(this));
    this.registerTypeValidator('array', this._validateArray.bind(this));
    this.registerTypeValidator('object', this._validateObject.bind(this));
  }

  // 注册组件类型
  registerComponentType(type, componentClass) {
    if (typeof type !== 'string') {
      throw new Error('Type must be a string');
    }
    
    this.typeComponentMap.set(type.toLowerCase(), componentClass);
  }

  // 注册类型渲染器
  registerTypeRenderer(type, renderer) {
    if (typeof type !== 'string' || typeof renderer !== 'function') {
      throw new Error('Type must be a string and renderer must be a function');
    }
    
    this.typeRendererMap.set(type.toLowerCase(), renderer);
  }

  // 注册类型编辑器
  registerTypeEditor(type, editor) {
    if (typeof type !== 'string' || typeof editor !== 'function') {
      throw new Error('Type must be a string and editor must be a function');
    }
    
    this.typeEditorMap.set(type.toLowerCase(), editor);
  }

  // 注册类型验证器
  registerTypeValidator(type, validator) {
    if (typeof type !== 'string' || typeof validator !== 'function') {
      throw new Error('Type must be a string and validator must be a function');
    }
    
    this.typeValidatorMap.set(type.toLowerCase(), validator);
  }

  // 注册类型格式化器
  registerTypeFormatter(type, formatter) {
    if (typeof type !== 'string' || typeof formatter !== 'function') {
      throw new Error('Type must be a string and formatter must be a function');
    }
    
    this.typeFormatterMap.set(type.toLowerCase(), formatter);
  }

  // 注册类型解析器
  registerTypeParser(type, parser) {
    if (typeof type !== 'string' || typeof parser !== 'function') {
      throw new Error('Type must be a string and parser must be a function');
    }
    
    this.typeParserMap.set(type.toLowerCase(), parser);
  }

  // 获取组件类型
  getComponentType(type) {
    if (typeof type !== 'string') {
      return null;
    }
    
    // 尝试精确匹配
    const componentClass = this.typeComponentMap.get(type.toLowerCase());
    if (componentClass) {
      return componentClass;
    }
    
    // 尝试默认类型（例如对于自定义类型，可以回退到object）
    return this.typeComponentMap.get('object') || null;
  }

  // 获取类型渲染器
  getTypeRenderer(type) {
    if (typeof type !== 'string') {
      return null;
    }
    
    return this.typeRendererMap.get(type.toLowerCase()) || null;
  }

  // 获取类型编辑器
  getTypeEditor(type) {
    if (typeof type !== 'string') {
      return null;
    }
    
    return this.typeEditorMap.get(type.toLowerCase()) || null;
  }

  // 获取类型验证器
  getTypeValidator(type) {
    if (typeof type !== 'string') {
      return null;
    }
    
    return this.typeValidatorMap.get(type.toLowerCase()) || null;
  }

  // 获取类型格式化器
  getTypeFormatter(type) {
    if (typeof type !== 'string') {
      return null;
    }
    
    return this.typeFormatterMap.get(type.toLowerCase()) || null;
  }

  // 获取类型解析器
  getTypeParser(type) {
    if (typeof type !== 'string') {
      return null;
    }
    
    return this.typeParserMap.get(type.toLowerCase()) || null;
  }

  // 检查类型是否已注册
  isTypeRegistered(type) {
    if (typeof type !== 'string') {
      return false;
    }
    
    return this.typeComponentMap.has(type.toLowerCase());
  }

  // 注销类型
  unregisterType(type) {
    if (typeof type !== 'string') {
      return;
    }
    
    const typeKey = type.toLowerCase();
    
    this.typeComponentMap.delete(typeKey);
    this.typeRendererMap.delete(typeKey);
    this.typeEditorMap.delete(typeKey);
    this.typeValidatorMap.delete(typeKey);
    this.typeFormatterMap.delete(typeKey);
    this.typeParserMap.delete(typeKey);
  }

  // 批量注册类型
  registerTypes(typesConfig) {
    if (typeof typesConfig !== 'object') {
      throw new Error('Types config must be an object');
    }
    
    Object.entries(typesConfig).forEach(([type, config]) => {
      if (config.component) {
        this.registerComponentType(type, config.component);
      }
      
      if (config.renderer) {
        this.registerTypeRenderer(type, config.renderer);
      }
      
      if (config.editor) {
        this.registerTypeEditor(type, config.editor);
      }
      
      if (config.validator) {
        this.registerTypeValidator(type, config.validator);
      }
      
      if (config.formatter) {
        this.registerTypeFormatter(type, config.formatter);
      }
      
      if (config.parser) {
        this.registerTypeParser(type, config.parser);
      }
    });
  }

  // 获取所有注册的类型
  getAllRegisteredTypes() {
    const types = new Set();
    
    // 收集所有映射中的类型
    this.typeComponentMap.forEach((_, type) => types.add(type));
    this.typeRendererMap.forEach((_, type) => types.add(type));
    this.typeEditorMap.forEach((_, type) => types.add(type));
    this.typeValidatorMap.forEach((_, type) => types.add(type));
    this.typeFormatterMap.forEach((_, type) => types.add(type));
    this.typeParserMap.forEach((_, type) => types.add(type));
    
    return Array.from(types);
  }

  // 创建类型组件实例
  createComponentInstance(type, propertyName, propertyValue, onChangeCallback, options = {}) {
    const componentClass = this.getComponentType(type);
    
    if (!componentClass) {
      console.warn(`No component registered for type: ${type}`);
      return null;
    }
    
    try {
      return new componentClass(propertyName, propertyValue, onChangeCallback, options);
    } catch (error) {
      console.error(`Error creating component for type ${type}:`, error);
      return null;
    }
  }

  // 默认验证器实现
  _validateString(value, options = {}) {
    if (value === null || value === undefined) {
      return { valid: !options.required, message: options.required ? 'Value is required' : '' };
    }
    
    if (typeof value !== 'string') {
      return { valid: false, message: 'Value must be a string' };
    }
    
    if (options.minLength !== undefined && value.length < options.minLength) {
      return { valid: false, message: `String must be at least ${options.minLength} characters` };
    }
    
    if (options.maxLength !== undefined && value.length > options.maxLength) {
      return { valid: false, message: `String must be at most ${options.maxLength} characters` };
    }
    
    if (options.pattern && !options.pattern.test(value)) {
      return { valid: false, message: 'String does not match pattern' };
    }
    
    return { valid: true };
  }

  _validateNumber(value, options = {}) {
    if (value === null || value === undefined) {
      return { valid: !options.required, message: options.required ? 'Value is required' : '' };
    }
    
    if (typeof value !== 'number' || isNaN(value)) {
      return { valid: false, message: 'Value must be a number' };
    }
    
    if (options.min !== undefined && value < options.min) {
      return { valid: false, message: `Number must be greater than or equal to ${options.min}` };
    }
    
    if (options.max !== undefined && value > options.max) {
      return { valid: false, message: `Number must be less than or equal to ${options.max}` };
    }
    
    return { valid: true };
  }

  _validateBoolean(value, options = {}) {
    if (value === null || value === undefined) {
      return { valid: !options.required, message: options.required ? 'Value is required' : '' };
    }
    
    if (typeof value !== 'boolean') {
      return { valid: false, message: 'Value must be a boolean' };
    }
    
    return { valid: true };
  }

  _validateArray(value, options = {}) {
    if (value === null || value === undefined) {
      return { valid: !options.required, message: options.required ? 'Value is required' : '' };
    }
    
    if (!Array.isArray(value)) {
      return { valid: false, message: 'Value must be an array' };
    }
    
    if (options.minLength !== undefined && value.length < options.minLength) {
      return { valid: false, message: `Array must have at least ${options.minLength} items` };
    }
    
    if (options.maxLength !== undefined && value.length > options.maxLength) {
      return { valid: false, message: `Array must have at most ${options.maxLength} items` };
    }
    
    // 如果指定了itemType，可以进一步验证数组项
    if (options.itemType && options.itemTypeValidator) {
      for (let i = 0; i < value.length; i++) {
        const result = options.itemTypeValidator(value[i]);
        if (!result.valid) {
          return { 
            valid: false, 
            message: `Item at index ${i} is invalid: ${result.message}` 
          };
        }
      }
    }
    
    return { valid: true };
  }

  _validateObject(value, options = {}) {
    if (value === null || value === undefined) {
      return { valid: !options.required, message: options.required ? 'Value is required' : '' };
    }
    
    if (typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, message: 'Value must be an object' };
    }
    
    // 可以添加更多的对象验证逻辑
    return { valid: true };
  }

  // 注册类型别名
  registerTypeAlias(alias, targetType) {
    if (typeof alias !== 'string' || typeof targetType !== 'string') {
      throw new Error('Alias and target type must be strings');
    }
    
    // 复制目标类型的所有映射
    const targetTypeKey = targetType.toLowerCase();
    const aliasKey = alias.toLowerCase();
    
    this.typeComponentMap.set(aliasKey, this.typeComponentMap.get(targetTypeKey));
    this.typeRendererMap.set(aliasKey, this.typeRendererMap.get(targetTypeKey));
    this.typeEditorMap.set(aliasKey, this.typeEditorMap.get(targetTypeKey));
    this.typeValidatorMap.set(aliasKey, this.typeValidatorMap.get(targetTypeKey));
    this.typeFormatterMap.set(aliasKey, this.typeFormatterMap.get(targetTypeKey));
    this.typeParserMap.set(aliasKey, this.typeParserMap.get(targetTypeKey));
  }

  // 获取类型信息
  getTypeInfo(type) {
    if (typeof type !== 'string') {
      return null;
    }
    
    const typeKey = type.toLowerCase();
    
    return {
      component: this.typeComponentMap.get(typeKey),
      renderer: this.typeRendererMap.get(typeKey),
      editor: this.typeEditorMap.get(typeKey),
      validator: this.typeValidatorMap.get(typeKey),
      formatter: this.typeFormatterMap.get(typeKey),
      parser: this.typeParserMap.get(typeKey)
    };
  }

  // 注册类型处理器（包含获取属性、验证、格式化等）
  registerTypeHandler(type, handler) {
    if (typeof type !== 'string' || typeof handler !== 'object') {
      throw new Error('Type must be a string and handler must be an object');
    }
    
    // 如果handler包含getProperties，注册为组件类型
    if (handler.getProperties && typeof handler.getProperties === 'function') {
      this.registerComponentType(type, handler.getProperties);
    }
    
    // 如果handler包含validateProperty，注册为验证器
    if (handler.validateProperty && typeof handler.validateProperty === 'function') {
      this.registerTypeValidator(type, handler.validateProperty);
    }
    
    // 如果handler包含formatProperty，注册为格式化器
    if (handler.formatProperty && typeof handler.formatProperty === 'function') {
      this.registerTypeFormatter(type, handler.formatProperty);
    }
    
    // 存储完整的handler以备后用
    this.typeHandlerMap = this.typeHandlerMap || new Map();
    this.typeHandlerMap.set(type.toLowerCase(), handler);
  }

  // 获取类型处理器
  getTypeHandler(type) {
    if (typeof type !== 'string') {
      return null;
    }
    
    this.typeHandlerMap = this.typeHandlerMap || new Map();
    return this.typeHandlerMap.get(type.toLowerCase()) || null;
  }

  // 清除所有类型注册
  clear() {
    this.typeComponentMap.clear();
    this.typeRendererMap.clear();
    this.typeEditorMap.clear();
    this.typeValidatorMap.clear();
    this.typeFormatterMap.clear();
    this.typeParserMap.clear();
    
    if (this.typeHandlerMap) {
      this.typeHandlerMap.clear();
    }
    
    // 重新注册默认类型
    this._registerDefaultTypes();
  }
}

export default TypeRegistry;