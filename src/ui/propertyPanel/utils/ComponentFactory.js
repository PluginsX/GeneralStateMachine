import StringPropertyComponent from '../components/basic/StringPropertyComponent.js';
import NumberPropertyComponent from '../components/basic/NumberPropertyComponent.js';
import BooleanPropertyComponent from '../components/basic/BooleanPropertyComponent.js';
import SelectPropertyComponent from '../components/basic/SelectPropertyComponent.js';
import ColorPropertyComponent from '../components/basic/ColorPropertyComponent.js';
import ArrayPropertyComponent from '../components/complex/ArrayPropertyComponent.js';
import ObjectPropertyComponent from '../components/complex/ObjectPropertyComponent.js';
import PropertyReflection from '../reflection/PropertyReflection.js';
import TypeRegistry from '../reflection/TypeRegistry.js';
import BindingManager from './BindingManager.js';
import EventBus from './EventBus.js';

class ComponentFactory {
  constructor() {
    // 组件映射表
    this.componentMap = {
      string: StringPropertyComponent,
      number: NumberPropertyComponent,
      boolean: BooleanPropertyComponent,
      select: SelectPropertyComponent,
      color: ColorPropertyComponent,
      array: ArrayPropertyComponent,
      object: ObjectPropertyComponent
    };

    // 自定义组件注册表
    this.customComponents = new Map();

    // 反射工具实例
    this.reflection = new PropertyReflection();

    // 类型注册表实例
    this.typeRegistry = TypeRegistry.getInstance();

    // 组件缓存
    this.componentCache = new Map();
    
    // 绑定管理器
    this.bindingManager = new BindingManager();
    
    // 事件总线
    this.eventBus = EventBus.getInstance();
  }

  // 创建属性组件
  createPropertyComponent(propertyName, propertyValue, onChange, options = {}) {
    try {
      // 确定组件类型
      const componentType = this._determineComponentType(propertyName, propertyValue, options);
      
      // 创建组件实例
      return this._createComponent(componentType, propertyName, propertyValue, onChange, options);
    } catch (error) {
      console.error(`Error creating component for property ${propertyName}:`, error);
      return this._createFallbackComponent(propertyName, propertyValue, onChange, options);
    }
  }

  // 确定组件类型
  _determineComponentType(propertyName, propertyValue, options) {
    // 如果直接指定了组件类型，优先使用
    if (options.componentType) {
      return options.componentType;
    }

    // 检查是否有自定义组件注册
    if (options.customComponentKey && this.customComponents.has(options.customComponentKey)) {
      return options.customComponentKey;
    }

    // 通过反射确定类型
    const propertyType = this.reflection.getTypeOfValue(propertyValue);
    
    // 根据类型映射到组件类型
    switch (propertyType) {
      case 'string':
        // 检查是否是颜色
        if (options.format === 'color' || this._isColorString(propertyValue)) {
          return 'color';
        }
        // 检查是否是选择器
        if (options.options && Array.isArray(options.options)) {
          return 'select';
        }
        return 'string';
      
      case 'number':
        return 'number';
      
      case 'boolean':
        return 'boolean';
      
      case 'array':
        return 'array';
      
      case 'object':
        // 特殊对象类型处理
        if (options.format === 'color' || (propertyValue && propertyValue.r !== undefined && propertyValue.g !== undefined && propertyValue.b !== undefined)) {
          return 'color';
        }
        return 'object';
      
      default:
        // 尝试通过类型注册表查找
        const registeredType = this.typeRegistry.getTypeHandler(propertyType);
        if (registeredType && registeredType.component) {
          return registeredType.component;
        }
        
        // 默认字符串类型
        return 'string';
    }
  }

  // 创建组件实例
  _createComponent(componentType, propertyName, propertyValue, onChange, options) {
    // 检查是否有自定义组件
    let ComponentClass;
    
    if (this.customComponents.has(componentType)) {
      ComponentClass = this.customComponents.get(componentType);
    } else if (this.componentMap[componentType]) {
      ComponentClass = this.componentMap[componentType];
    } else {
      throw new Error(`Unknown component type: ${componentType}`);
    }

    // 创建组件配置
    const componentOptions = this._prepareComponentOptions(propertyName, propertyValue, options);

    // 创建包装后的变更处理函数，使用绑定系统
    const wrappedOnChange = (name, value) => {
      this.updateProperty(options.object || {}, name, value);
      if (onChange) {
        onChange(name, value);
      }
    };

    // 创建组件实例
    const component = new ComponentClass(
      propertyName,
      propertyValue,
      wrappedOnChange,
      componentOptions
    );

    // 为复杂组件设置工厂引用，便于递归创建
    if (component.setComponentFactory) {
      component.setComponentFactory(this);
    }

    // 如果组件有element属性，尝试建立绑定
    if (component.element && options.object) {
      this.bindingManager.bind(component.element, options.object, propertyName);
    }

    return component;
  }

  // 准备组件配置
  _prepareComponentOptions(propertyName, propertyValue, options) {
    // 合并默认配置和用户配置
    return {
      // 默认配置
      displayName: this._formatDisplayName(propertyName, options),
      disabled: false,
      visible: true,
      tooltip: '',
      placeholder: '',
      readOnly: false,
      
      // 用户配置
      ...options,
      
      // 确保必要的配置存在
      propertyName: propertyName,
      
      // 处理特殊配置
      ...this._processSpecialOptions(propertyValue, options)
    };
  }

  // 格式化显示名称
  _formatDisplayName(propertyName, options) {
    if (options.displayName) {
      return options.displayName;
    }
    
    // 自动格式化驼峰命名
    return propertyName
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')  // 在大小写转换处添加空格
      .replace(/^([a-z])/, match => match.toUpperCase())  // 首字母大写
      .replace(/^ID/, 'ID')  // 特殊处理ID
      .replace(/([a-z])([A-Z]{2,})/g, '$1 $2');  // 处理连续大写字母
  }

  // 处理特殊配置
  _processSpecialOptions(propertyValue, options) {
    const specialOptions = {};
    
    // 根据值类型添加特殊配置
    if (Array.isArray(propertyValue)) {
      specialOptions.itemType = options.itemType || this._determineArrayItemType(propertyValue);
      specialOptions.maxItems = options.maxItems !== undefined ? options.maxItems : Infinity;
      specialOptions.minItems = options.minItems !== undefined ? options.minItems : 0;
    }
    
    // 数字类型特殊配置
    if (typeof propertyValue === 'number') {
      specialOptions.step = options.step !== undefined ? options.step : 1;
      specialOptions.min = options.min !== undefined ? options.min : -Infinity;
      specialOptions.max = options.max !== undefined ? options.max : Infinity;
      specialOptions.showSlider = options.showSlider !== undefined ? options.showSlider : false;
    }
    
    // 字符串类型特殊配置
    if (typeof propertyValue === 'string') {
      specialOptions.maxLength = options.maxLength !== undefined ? options.maxLength : Infinity;
      specialOptions.multiline = options.multiline !== undefined ? options.multiline : false;
      specialOptions.rows = options.rows !== undefined ? options.rows : 3;
    }
    
    // 布尔类型特殊配置
    if (typeof propertyValue === 'boolean') {
      specialOptions.style = options.style || 'toggle'; // toggle 或 checkbox
    }
    
    return specialOptions;
  }

  // 确定数组元素类型
  _determineArrayItemType(arrayValue) {
    if (!arrayValue || arrayValue.length === 0) {
      return 'string'; // 默认字符串
    }
    
    // 简单策略：使用第一个元素的类型
    const firstItemType = this.reflection.getTypeOfValue(arrayValue[0]);
    
    // 检查所有元素是否同类型
    const allSameType = arrayValue.every(item => this.reflection.getTypeOfValue(item) === firstItemType);
    
    if (allSameType) {
      return firstItemType;
    }
    
    // 混合类型默认使用对象
    return 'object';
  }

  // 检查是否是颜色字符串
  _isColorString(value) {
    if (typeof value !== 'string') return false;
    
    // 检查常见颜色格式
    const colorRegex = /^(#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})|rgba?\(\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*\d*\.?\d+\s*)?\)|hsl\(\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*\d*\.?\d+\s*)?\))$/;
    return colorRegex.test(value);
  }

  // 创建后备组件
  _createFallbackComponent(propertyName, propertyValue, onChange, options) {
    console.warn(`Fallback component created for ${propertyName}`);
    
    // 创建简单的文本输入组件
    const container = document.createElement('div');
    container.className = 'property-item fallback';
    
    const label = document.createElement('label');
    label.textContent = this._formatDisplayName(propertyName, options);
    container.appendChild(label);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = String(propertyValue);
    input.className = 'fallback-input';
    
    if (options.disabled) {
      input.disabled = true;
    }
    
    if (options.readOnly) {
      input.readOnly = true;
    }
    
    if (options.placeholder) {
      input.placeholder = options.placeholder;
    }
    
    // 包装后的变更处理函数
    const wrappedOnChange = (name, value) => {
      if (options.object) {
        this.updateProperty(options.object, name, value);
      }
      if (onChange) {
        onChange(name, value);
      }
    };
    
    // 使用绑定管理器建立双向绑定
    if (options.object) {
      this.bindingManager.bind(input, options.object, propertyName);
    } else {
      // 如果没有对象，仍然使用事件监听器
      input.addEventListener('input', (e) => {
        wrappedOnChange(propertyName, e.target.value);
      });
    }
    
    container.appendChild(input);
    
    return {
      getElement: () => container,
      updateValue: (val) => { input.value = String(val); },
      setDisabled: (disabled) => { input.disabled = disabled; },
      setVisible: (visible) => { container.style.display = visible ? '' : 'none'; },
      destroy: () => {
        // 清理绑定
        this.bindingManager.unbind(input);
        // 清理事件监听器
        const clonedInput = input.cloneNode(true);
        input.parentNode.replaceChild(clonedInput, input);
      }
    };
  }

  // 注册自定义组件
  registerCustomComponent(key, componentClass) {
    if (typeof componentClass === 'function') {
      this.customComponents.set(key, componentClass);
      return true;
    }
    return false;
  }

  // 注销自定义组件
  unregisterCustomComponent(key) {
    return this.customComponents.delete(key);
  }

  // 获取所有自定义组件
  getRegisteredComponents() {
    return Array.from(this.customComponents.entries());
  }

  // 检查组件是否已注册
  isComponentRegistered(key) {
    return this.componentMap[key] !== undefined || this.customComponents.has(key);
  }

  // 批量注册自定义组件
  registerCustomComponents(components) {
    Object.entries(components).forEach(([key, componentClass]) => {
      this.registerCustomComponent(key, componentClass);
    });
  }

  // 从缓存获取组件
  getCachedComponent(componentKey) {
    return this.componentCache.get(componentKey);
  }

  // 缓存组件
  cacheComponent(componentKey, componentInfo) {
    this.componentCache.set(componentKey, componentInfo);
  }

  // 清除组件缓存
  clearComponentCache() {
    this.componentCache.clear();
  }

  // 为复杂组件递归创建子组件
  createChildComponent(propertyName, propertyValue, onChange, options) {
    return this.createPropertyComponent(propertyName, propertyValue, onChange, options);
  }

  // 创建组件容器
  createComponentContainer(options = {}) {
    const container = document.createElement('div');
    container.className = `property-item-container ${options.className || ''}`;
    
    if (options.style) {
      Object.assign(container.style, options.style);
    }
    
    return container;
  }

  // 创建标签元素
  createLabel(text, options = {}) {
    const label = document.createElement('label');
    label.textContent = text;
    label.className = `property-label ${options.className || ''}`;
    
    if (options.tooltip) {
      label.title = options.tooltip;
      label.setAttribute('data-tooltip', options.tooltip);
    }
    
    return label;
  }

  // 创建控件容器
  createControlContainer(options = {}) {
    const container = document.createElement('div');
    container.className = `property-control-container ${options.className || ''}`;
    
    return container;
  }

  // 更新对象属性
  updateProperty(object, property, value) {
    // 检查对象是否有特殊的更新方法
    if (object.updateProperty) {
      object.updateProperty(property, value);
    } else {
      // 直接更新属性
      object[property] = value;
    }
    
    // 触发属性变更事件
    this.eventBus.emit('propertyChange', {
      object,
      property,
      newValue: value
    });
  }
  
  // 清理所有绑定
  cleanup() {
    this.bindingManager.unbindAll();
  }
  
  // 销毁工厂
  destroy() {
    this.clearComponentCache();
    this.customComponents.clear();
    this.cleanup();
    this.reflection = null;
    this.typeRegistry = null;
    this.bindingManager = null;
    this.eventBus = null;
  }
}

export default ComponentFactory;