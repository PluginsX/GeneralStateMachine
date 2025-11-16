import PropertyDefinition from '../reflection/PropertyDefinition.js';
import PropertyReflection from '../reflection/PropertyReflection.js';
import TypeRegistry from '../reflection/TypeRegistry.js';
import EventBus from '../utils/EventBus.js';

class ObjectBasePropertyHandler {
  constructor() {
    // 反射工具实例
    this.reflection = new PropertyReflection();
    
    // 类型注册表实例
    this.typeRegistry = new TypeRegistry();
    
    // ObjectBase子类映射表
    this.objectBaseSubclasses = new Map();
    
    // 属性定义缓存
    this.propertyDefinitionCache = new Map();
    
    // 默认属性组
    this.defaultPropertyGroup = 'Default';
    
    // 事件总线实例
    this.eventBus = EventBus.getInstance();
    
    // 属性变更处理器映射
    this.propertyChangeHandlers = new Map();
    
    // 初始化默认配置
    this._initialize();
  }

  // 初始化
  _initialize() {
    // 注册默认的ObjectBase处理逻辑
    this.typeRegistry.registerTypeHandler('ObjectBase', {
      getProperties: (object) => this.getObjectBaseProperties(object),
      validateProperty: (propertyName, value, object) => this.validateObjectBaseProperty(propertyName, value, object),
      formatProperty: (propertyName, value) => this.formatObjectBaseProperty(propertyName, value)
    });
  }

  // 注册ObjectBase子类
  registerObjectBaseSubclass(classConstructor, propertyDefinitions) {
    if (!classConstructor || typeof classConstructor !== 'function') {
      console.error('Invalid class constructor provided');
      return false;
    }
    
    // 获取类名作为键
    const className = classConstructor.name;
    
    // 存储类和其属性定义
    this.objectBaseSubclasses.set(className, {
      constructor: classConstructor,
      propertyDefinitions: propertyDefinitions || {}
    });
    
    // 清除相关缓存
    this._clearCacheForClass(className);
    
    return true;
  }

  // 检查对象是否为ObjectBase子类实例
  isObjectBaseInstance(object) {
    if (!object || typeof object !== 'object') {
      return false;
    }
    
    // 检查对象的构造函数是否已注册
    const constructorName = object.constructor.name;
    if (this.objectBaseSubclasses.has(constructorName)) {
      return true;
    }
    
    // 检查原型链
    let proto = Object.getPrototypeOf(object);
    while (proto) {
      const protoName = proto.constructor.name;
      if (this.objectBaseSubclasses.has(protoName)) {
        return true;
      }
      proto = Object.getPrototypeOf(proto);
    }
    
    // 检查是否有isObjectBase或类似标记
    return object.isObjectBase === true || 
           object.__isObjectBase === true ||
           object.constructor.__isObjectBase === true;
  }

  // 获取ObjectBase子类的属性
  getObjectBaseProperties(object) {
    if (!this.isObjectBaseInstance(object)) {
      console.warn('Object is not an instance of ObjectBase subclass');
      return {};
    }
    
    // 尝试从缓存获取
    const cacheKey = this._getCacheKey(object);
    if (this.propertyDefinitionCache.has(cacheKey)) {
      return this.propertyDefinitionCache.get(cacheKey);
    }
    
    try {
      // 获取类信息
      const classInfo = this._getClassInfo(object);
      if (!classInfo) {
        // 如果没有注册，尝试自动检测属性
        return this._autoDetectProperties(object);
      }
      
      // 合并注册的属性定义和自动检测的属性
      const registeredProperties = this._processRegisteredProperties(classInfo.propertyDefinitions, object);
      const autoProperties = this._autoDetectProperties(object, registeredProperties);
      
      // 合并并处理所有属性
      const allProperties = { ...autoProperties, ...registeredProperties };
      
      // 应用继承属性
      const inheritedProperties = this._getInheritedProperties(object, allProperties);
      
      // 合并所有属性
      const mergedProperties = { ...inheritedProperties, ...allProperties };
      
      // 缓存结果
      this.propertyDefinitionCache.set(cacheKey, mergedProperties);
      
      return mergedProperties;
    } catch (error) {
      console.error('Error getting ObjectBase properties:', error);
      return {};
    }
  }

  // 处理注册的属性定义
  _processRegisteredProperties(propertyDefinitions, object) {
    const processed = {};
    
    Object.entries(propertyDefinitions).forEach(([propertyName, definition]) => {
      // 如果是PropertyDefinition实例，直接使用
      if (definition instanceof PropertyDefinition) {
        processed[propertyName] = definition;
      } else {
        // 否则创建新的PropertyDefinition
        processed[propertyName] = new PropertyDefinition(propertyName, {
          ...definition,
          // 确保绑定this上下文
          onBeforeChange: definition.onBeforeChange ? 
            (name, value) => definition.onBeforeChange.call(object, name, value) : undefined,
          onAfterChange: definition.onAfterChange ? 
            (name, value) => definition.onAfterChange.call(object, name, value) : undefined,
        });
      }
    });
    
    return processed;
  }

  // 自动检测属性
  _autoDetectProperties(object, excludeProperties = {}) {
    const properties = {};
    
    // 获取对象自身的可枚举属性
    const ownProperties = Object.getOwnPropertyNames(object);
    
    ownProperties.forEach(propertyName => {
      // 跳过方法、内部属性和已定义的属性
      if (propertyName in excludeProperties || 
          typeof object[propertyName] === 'function' || 
          propertyName.startsWith('_') || 
          propertyName.startsWith('__')) {
        return;
      }
      
      // 获取属性描述符
      const descriptor = Object.getOwnPropertyDescriptor(object, propertyName);
      
      // 跳过getter/setter（可能有特殊逻辑）
      if (descriptor && (descriptor.get || descriptor.set)) {
        return;
      }
      
      // 创建默认的属性定义
      const propertyValue = object[propertyName];
      const propertyType = this.reflection.getTypeOfValue(propertyValue);
      
      properties[propertyName] = new PropertyDefinition(propertyName, {
        type: propertyType,
        displayName: this._formatPropertyName(propertyName),
        group: this.defaultPropertyGroup,
        visible: true,
        enabled: true,
        defaultValue: this._getDefaultValue(propertyValue)
      });
    });
    
    // 检查是否有特殊的属性定义方法
    if (object.getPropertyDefinitions && typeof object.getPropertyDefinitions === 'function') {
      try {
        const customDefinitions = object.getPropertyDefinitions();
        if (typeof customDefinitions === 'object') {
          Object.entries(customDefinitions).forEach(([propertyName, definition]) => {
            if (!(propertyName in properties)) {
              properties[propertyName] = new PropertyDefinition(propertyName, definition);
            }
          });
        }
      } catch (error) {
        console.warn('Error getting custom property definitions:', error);
      }
    }
    
    return properties;
  }

  // 获取继承的属性
  _getInheritedProperties(object, currentProperties) {
    const inherited = {};
    
    // 获取原型链上的属性
    let proto = Object.getPrototypeOf(object);
    
    while (proto && proto !== Object.prototype) {
      const constructorName = proto.constructor.name;
      
      // 检查原型的构造函数是否已注册
      if (this.objectBaseSubclasses.has(constructorName)) {
        const classInfo = this.objectBaseSubclasses.get(constructorName);
        
        // 处理父类的属性定义
        Object.entries(classInfo.propertyDefinitions).forEach(([propertyName, definition]) => {
          // 跳过已经在子类中定义的属性
          if (!(propertyName in currentProperties)) {
            inherited[propertyName] = new PropertyDefinition(propertyName, {
              ...(definition instanceof PropertyDefinition ? definition.toJSON() : definition),
              inherited: true
            });
          }
        });
      }
      
      proto = Object.getPrototypeOf(proto);
    }
    
    return inherited;
  }

  // 获取类信息
  _getClassInfo(object) {
    // 首先检查直接构造函数
    const constructorName = object.constructor.name;
    if (this.objectBaseSubclasses.has(constructorName)) {
      return this.objectBaseSubclasses.get(constructorName);
    }
    
    // 然后检查原型链
    let proto = Object.getPrototypeOf(object);
    while (proto) {
      const protoName = proto.constructor.name;
      if (this.objectBaseSubclasses.has(protoName)) {
        return this.objectBaseSubclasses.get(protoName);
      }
      proto = Object.getPrototypeOf(proto);
    }
    
    return null;
  }

  // 格式化属性名
  _formatPropertyName(propertyName) {
    return propertyName
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^([a-z])/, match => match.toUpperCase())
      .replace(/^ID/, 'ID');
  }

  // 获取默认值
  _getDefaultValue(value) {
    if (value === null || value === undefined) {
      return null;
    }
    
    switch (typeof value) {
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'object':
        if (Array.isArray(value)) {
          return [];
        }
        return {};
      default:
        return null;
    }
  }

  // 验证ObjectBase属性
  validateObjectBaseProperty(propertyName, value, object) {
    // 获取属性定义
    const properties = this.getObjectBaseProperties(object);
    const propertyDef = properties[propertyName];
    
    if (!propertyDef) {
      return { valid: false, message: `Property ${propertyName} not found` };
    }
    
    // 使用属性定义验证
    return propertyDef.validate(value);
  }

  // 格式化ObjectBase属性
  formatObjectBaseProperty(propertyName, value) {
    // 根据值类型格式化
    switch (typeof value) {
      case 'object':
        if (value === null) return 'null';
        if (Array.isArray(value)) {
          return `Array[${value.length}]`;
        }
        return value.constructor.name;
      default:
        return String(value);
    }
  }

  // 获取缓存键
  _getCacheKey(object) {
    const constructorName = object.constructor.name;
    const objectId = object.id || object._id || object.uid || 
                    (object.constructor.name + ':' + Math.random().toString(36).substr(2, 9));
    
    return `${constructorName}:${objectId}`;
  }

  // 清除类的缓存
  _clearCacheForClass(className) {
    // 遍历缓存，清除相关条目
    for (const [key, _] of this.propertyDefinitionCache.entries()) {
      if (key.startsWith(className + ':')) {
        this.propertyDefinitionCache.delete(key);
      }
    }
  }

  // 清除对象的缓存
  clearObjectCache(object) {
    const cacheKey = this._getCacheKey(object);
    this.propertyDefinitionCache.delete(cacheKey);
  }

  // 清除所有缓存
  clearCache() {
    this.propertyDefinitionCache.clear();
  }

  // 获取所有注册的ObjectBase子类
  getRegisteredSubclasses() {
    return Array.from(this.objectBaseSubclasses.keys());
  }

  // 注销ObjectBase子类
  unregisterObjectBaseSubclass(className) {
    const result = this.objectBaseSubclasses.delete(className);
    if (result) {
      this._clearCacheForClass(className);
    }
    return result;
  }

  // 更新属性定义
  updatePropertyDefinition(className, propertyName, definition) {
    const classInfo = this.objectBaseSubclasses.get(className);
    if (!classInfo) {
      console.error(`Class ${className} not found`);
      return false;
    }
    
    // 更新属性定义
    classInfo.propertyDefinitions[propertyName] = definition;
    
    // 清除缓存
    this._clearCacheForClass(className);
    
    return true;
  }

  // 批量更新属性定义
  updatePropertyDefinitions(className, definitions) {
    const classInfo = this.objectBaseSubclasses.get(className);
    if (!classInfo) {
      console.error(`Class ${className} not found`);
      return false;
    }
    
    // 更新属性定义
    Object.assign(classInfo.propertyDefinitions, definitions);
    
    // 清除缓存
    this._clearCacheForClass(className);
    
    return true;
  }

  // 检查属性是否可编辑
  isPropertyEditable(object, propertyName) {
    const properties = this.getObjectBaseProperties(object);
    const propertyDef = properties[propertyName];
    
    if (!propertyDef) {
      return false;
    }
    
    // 检查属性定义中的设置
    if (!propertyDef.visible || !propertyDef.enabled || propertyDef.readOnly) {
      return false;
    }
    
    // 检查对象是否有自定义的可编辑检查
    if (object.isPropertyEditable && typeof object.isPropertyEditable === 'function') {
      return object.isPropertyEditable(propertyName);
    }
    
    return true;
  }

  // 处理对象属性变更
  handlePropertyChange(object, propertyName, newValue, oldValue) {
    // 获取属性定义
    const properties = this.getObjectBaseProperties(object);
    const propertyDef = properties[propertyName];
    
    if (propertyDef) {
      // 调用属性定义的变更钩子
      if (propertyDef.onBeforeChange) {
        const result = propertyDef.onBeforeChange(propertyName, newValue, object);
        if (result === false) {
          return false;
        }
      }
    }
    
    // 检查对象是否有自定义的变更处理
    if (object.onPropertyChange && typeof object.onPropertyChange === 'function') {
      const result = object.onPropertyChange(propertyName, newValue, oldValue);
      if (result === false) {
        return false;
      }
    }
    
    // 检查对象是否有特殊的setter方法
    const setterMethod = `set${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}`;
    let finalNewValue = newValue;
    
    if (typeof object[setterMethod] === 'function') {
      try {
        object[setterMethod](newValue);
        finalNewValue = object[propertyName];
      } catch (error) {
        console.error(`Failed to call setter method ${setterMethod}:`, error);
        return false;
      }
    } else {
      // 直接更新属性值
      try {
        object[propertyName] = newValue;
      } catch (error) {
        console.error(`Failed to set property ${propertyName}:`, error);
        return false;
      }
    }
    
    // 通知属性变更
    this._notifyPropertyChange(object, propertyName, oldValue, finalNewValue);
    
    if (propertyDef && propertyDef.onAfterChange) {
      // 调用变更后钩子
      propertyDef.onAfterChange(propertyName, finalNewValue, object);
    }
    
    // 清除缓存
    this.clearObjectCache(object);
    
    return true;
  }
  
  /**
   * 注册属性变更处理器
   * @param {string} propertyName - 属性名
   * @param {Function} handler - 处理器函数
   */
  registerPropertyChangeHandler(propertyName, handler) {
    if (!this.propertyChangeHandlers.has(propertyName)) {
      this.propertyChangeHandlers.set(propertyName, []);
    }
    this.propertyChangeHandlers.get(propertyName).push(handler);
  }
  
  /**
   * 注销属性变更处理器
   * @param {string} propertyName - 属性名
   * @param {Function} handler - 处理器函数
   */
  unregisterPropertyChangeHandler(propertyName, handler) {
    if (this.propertyChangeHandlers.has(propertyName)) {
      const handlers = this.propertyChangeHandlers.get(propertyName);
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  /**
   * 触发属性变更通知
   */
  _notifyPropertyChange(object, propertyName, oldValue, newValue) {
    // 通过事件总线触发全局属性变更事件
    this.eventBus.emit('propertyChange', {
      object,
      property: propertyName,
      oldValue,
      newValue
    });
    
    // 触发特定属性的处理器
    if (this.propertyChangeHandlers.has(propertyName)) {
      const handlers = this.propertyChangeHandlers.get(propertyName);
      handlers.forEach(handler => {
        try {
          handler(object, propertyName, oldValue, newValue);
        } catch (error) {
          console.error(`Error in property change handler for ${propertyName}:`, error);
        }
      });
    }
  }

  // 销毁处理器
  destroy() {
    this.clearCache();
    this.objectBaseSubclasses.clear();
    this.propertyChangeHandlers.clear();
    this.reflection = null;
    this.typeRegistry = null;
    this.eventBus = null;
  }
}

export default ObjectBasePropertyHandler;