import PropertyDefinition from './PropertyDefinition.js';

class PropertyReflection {
  constructor() {
    // 类型映射表，用于确定属性类型
    this.typeMap = new Map();
    
    // 注册基本类型处理
    this.registerTypeHandler(Number, this._handleNumberType.bind(this));
    this.registerTypeHandler(String, this._handleStringType.bind(this));
    this.registerTypeHandler(Boolean, this._handleBooleanType.bind(this));
    this.registerTypeHandler(Array, this._handleArrayType.bind(this));
    this.registerTypeHandler(Date, this._handleDateType.bind(this));
    
    // 类定义缓存，用于提高性能
    this.classDefinitionCache = new Map();
  }

  // 注册类型处理器
  registerTypeHandler(type, handler) {
    this.typeMap.set(type, handler);
  }

  // 获取对象的所有属性定义
  getObjectProperties(object) {
    console.log('PropertyReflection.getObjectProperties called with:', object);
    console.log('对象类型:', typeof object);
    console.log('对象构造函数:', object?.constructor?.name);
    
    if (!object || typeof object !== 'object') {
      console.log('对象无效或不是对象类型，返回空属性');
      return {};
    }

    // 尝试从缓存获取类定义
    const objectClass = object.constructor;
    if (objectClass !== Object && this.classDefinitionCache.has(objectClass)) {
      console.log('从缓存获取类定义:', objectClass.name);
      const cachedDef = this.classDefinitionCache.get(objectClass);
      // 克隆缓存的定义以避免修改缓存
      const result = {};
      for (const [key, def] of Object.entries(cachedDef)) {
        result[key] = def.clone();
      }
      console.log('返回缓存的属性定义:', result);
      return result;
    }

    const properties = {};
    
    // 1. 获取对象的自身属性
    const ownProps = Object.getOwnPropertyNames(object);
    
    // 2. 尝试获取原型链上的属性（如果是自定义类）
    let proto = Object.getPrototypeOf(object);
    const protoProps = new Set();
    
    // 收集原型链上的属性，但不包括Object.prototype的
    while (proto && proto !== Object.prototype) {
      const props = Object.getOwnPropertyNames(proto);
      props.forEach(prop => {
        // 跳过构造函数和方法（除非明确标记为属性）
        if (prop !== 'constructor' && typeof proto[prop] !== 'function') {
          protoProps.add(prop);
        }
      });
      proto = Object.getPrototypeOf(proto);
    }

    // 合并所有属性
    const allProps = new Set([...ownProps, ...protoProps]);
    
    // 3. 检查对象是否有自定义的属性定义
    if (typeof object.getPropertyDefinitions === 'function') {
      const customDefs = object.getPropertyDefinitions();
      for (const [key, def] of Object.entries(customDefs)) {
        allProps.add(key);
        // 存储自定义定义，后续处理
        properties[key] = def;
      }
    }

    // 4. 为每个属性创建定义
    allProps.forEach(propName => {
      // 跳过已处理的自定义定义
      if (properties[propName]) {
        return;
      }
      
      // 跳过私有属性（默认以下划线开头）
      if (propName.startsWith('_')) {
        return;
      }
      
      // 跳过方法
      if (typeof object[propName] === 'function') {
        return;
      }
      
      // 跳过不可枚举属性
      const descriptor = Object.getOwnPropertyDescriptor(object, propName);
      if (descriptor && !descriptor.enumerable) {
        return;
      }
      
      // 创建属性定义
      const propertyDef = this._createPropertyDefinition(propName, object[propName]);
      
      // 应用getter/setter信息
      if (descriptor) {
        if (!descriptor.writable && !descriptor.set) {
          propertyDef.readOnly = true;
        }
      }
      
      properties[propName] = propertyDef;
    });

    // 缓存类定义
    if (objectClass !== Object) {
      this.classDefinitionCache.set(objectClass, properties);
    }

    return properties;
  }

  // 创建属性定义
  _createPropertyDefinition(propertyName, propertyValue) {
    // 确定属性类型
    const type = this._determineType(propertyValue);
    
    // 创建基本定义
    const options = {
      type: type
    };
    
    // 根据类型应用特定配置
    const typeHandler = this._getTypeHandler(type);
    if (typeHandler) {
      typeHandler(options, propertyValue);
    }
    
    return new PropertyDefinition(propertyName, options);
  }

  // 确定值的类型
  _determineType(value) {
    if (value === null) return 'string';
    
    const type = typeof value;
    
    if (type === 'object') {
      if (Array.isArray(value)) return 'array';
      if (value instanceof Date) return 'date';
      // 检查是否是类实例
      if (value.constructor && value.constructor !== Object) {
        // 尝试获取类名
        const className = value.constructor.name || 'object';
        return className.toLowerCase();
      }
      return 'object';
    }
    
    return type;
  }

  // 获取类型处理器
  _getTypeHandler(type) {
    // 查找注册的处理器
    for (const [handlerType, handler] of this.typeMap.entries()) {
      if (type === handlerType.name.toLowerCase()) {
        return handler;
      }
    }
    
    // 返回默认处理器
    return this._handleDefaultType.bind(this);
  }

  // 处理数字类型
  _handleNumberType(options, value) {
    // 对于数字，可以自动设置一些合理的范围
    // 这里简单处理，实际应用可能需要更复杂的逻辑
    options.min = -Infinity;
    options.max = Infinity;
    options.step = Number.isInteger(value) ? 1 : 0.1;
  }

  // 处理字符串类型
  _handleStringType(options, value) {
    options.maxLength = null; // 不限制长度
    options.multiline = false; // 默认单行
    
    // 如果字符串很长，可以考虑设置为多行
    if (value && value.length > 50) {
      options.multiline = true;
    }
  }

  // 处理布尔类型
  _handleBooleanType(options) {
    // 布尔类型不需要特殊配置
  }

  // 处理数组类型
  _handleArrayType(options, value) {
    options.itemType = 'string'; // 默认项类型
    options.itemOptions = {};
    
    // 如果数组不为空，尝试推断项类型
    if (value && value.length > 0) {
      const firstItem = value[0];
      options.itemType = this._determineType(firstItem);
      
      // 为项类型设置选项
      const itemTypeHandler = this._getTypeHandler(options.itemType);
      if (itemTypeHandler) {
        itemTypeHandler(options.itemOptions, firstItem);
      }
    }
  }

  // 处理日期类型
  _handleDateType(options) {
    options.format = 'YYYY-MM-DD HH:mm:ss';
  }

  // 默认类型处理
  _handleDefaultType(options) {
    // 默认配置
  }

  // 为特定类注册属性定义
  registerClassProperties(classConstructor, propertyDefinitions) {
    if (typeof classConstructor !== 'function') {
      throw new Error('First argument must be a constructor function');
    }
    
    if (typeof propertyDefinitions !== 'object') {
      throw new Error('Second argument must be an object');
    }
    
    // 转换为PropertyDefinition实例
    const definitions = {};
    for (const [key, def] of Object.entries(propertyDefinitions)) {
      if (def instanceof PropertyDefinition) {
        definitions[key] = def;
      } else {
        definitions[key] = new PropertyDefinition(key, def);
      }
    }
    
    // 缓存类定义
    this.classDefinitionCache.set(classConstructor, definitions);
  }

  // 注册ObjectBase子类的属性定义
  registerObjectBaseSubclass(className, propertyDefinitions) {
    // 这里可以添加特殊处理，针对ObjectBase子类的特性
    // 目前简单调用registerClassProperties
    
    // 尝试获取类构造函数
    let classConstructor;
    if (typeof className === 'function') {
      classConstructor = className;
    } else if (typeof className === 'string' && window[className]) {
      classConstructor = window[className];
    } else {
      // 如果找不到，创建一个临时构造函数作为键
      classConstructor = function() {};
      classConstructor.name = className;
    }
    
    this.registerClassProperties(classConstructor, propertyDefinitions);
  }

  // 清除缓存
  clearCache() {
    this.classDefinitionCache.clear();
  }

  // 获取属性组
  getPropertyGroups(properties) {
    const groups = new Map();
    
    // 为每个属性添加到对应的组
    for (const [key, def] of Object.entries(properties)) {
      const groupName = def.group || 'Default';
      
      if (!groups.has(groupName)) {
        groups.set(groupName, {});
      }
      
      groups.get(groupName)[key] = def;
    }
    
    // 转换为对象并排序
    const result = {};
    groups.forEach((groupProps, groupName) => {
      result[groupName] = groupProps;
    });
    
    return result;
  }

  // 获取排序后的属性
  getSortedProperties(properties) {
    // 转换为数组并按order排序
    const propsArray = Object.entries(properties).map(([key, def]) => ({
      key: key,
      definition: def
    }));
    
    // 排序
    propsArray.sort((a, b) => {
      // 首先按order排序
      if (a.definition.order !== b.definition.order) {
        return a.definition.order - b.definition.order;
      }
      
      // 然后按名称排序
      return a.key.localeCompare(b.key);
    });
    
    // 转换回对象
    const result = {};
    propsArray.forEach(item => {
      result[item.key] = item.definition;
    });
    
    return result;
  }

  // 创建属性值的副本
  clonePropertyValue(value) {
    if (value === null || value === undefined) {
      return value;
    }
    
    const type = typeof value;
    
    if (type === 'object') {
      if (Array.isArray(value)) {
        return value.map(item => this.clonePropertyValue(item));
      }
      
      if (value instanceof Date) {
        return new Date(value.getTime());
      }
      
      // 创建普通对象的副本
      const clone = {};
      for (const [key, val] of Object.entries(value)) {
        clone[key] = this.clonePropertyValue(val);
      }
      return clone;
    }
    
    // 基本类型直接返回
    return value;
  }

  // 获取值的类型（公共方法）
  getTypeOfValue(value) {
    return this._determineType(value);
  }

  // 检查两个值是否相等
  valuesEqual(value1, value2) {
    // 处理null和undefined
    if (value1 === value2) {
      return true;
    }
    
    // 如果一个为null，一个为undefined
    if (value1 === null || value2 === null) {
      return false;
    }
    
    if (value1 === undefined || value2 === undefined) {
      return false;
    }
    
    // 检查类型
    if (typeof value1 !== typeof value2) {
      return false;
    }
    
    // 处理复杂类型
    if (typeof value1 === 'object') {
      // 处理日期
      if (value1 instanceof Date && value2 instanceof Date) {
        return value1.getTime() === value2.getTime();
      }
      
      // 处理数组
      if (Array.isArray(value1) && Array.isArray(value2)) {
        if (value1.length !== value2.length) {
          return false;
        }
        
        return value1.every((item, index) => {
          return this.valuesEqual(item, value2[index]);
        });
      }
      
      // 处理对象
      const keys1 = Object.keys(value1);
      const keys2 = Object.keys(value2);
      
      if (keys1.length !== keys2.length) {
        return false;
      }
      
      return keys1.every(key => {
        if (!keys2.includes(key)) {
          return false;
        }
        return this.valuesEqual(value1[key], value2[key]);
      });
    }
    
    // 基本类型直接比较
    return value1 === value2;
  }
}

export default PropertyReflection;