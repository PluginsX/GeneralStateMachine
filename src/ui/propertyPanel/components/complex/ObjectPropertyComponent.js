import { PropertyComponentBase } from '../PropertyComponentBase.js';
import ComponentFactory from '../../utils/ComponentFactory.js'; // 后续会创建这个工厂类

class ObjectPropertyComponent extends PropertyComponentBase {
  constructor(propertyName, propertyValue, onChangeCallback, options = {}) {
    super(propertyName, propertyValue || {}, onChangeCallback, options);
    this.propertyDefinitions = options.properties || {}; // 属性定义
    this.isExpanded = !!options.defaultExpanded; // 默认是否展开
    this.collapsible = options.collapsible !== false; // 是否可折叠
    this.showEmpty = !!options.showEmpty; // 是否显示空对象
    this.propertyComponents = {}; // 存储属性组件实例
  }

  createElement() {
    const container = document.createElement('div');
    container.className = 'property-component object-property';

    // 创建标题行（包含标签和展开/折叠按钮）
    const header = document.createElement('div');
    header.className = 'object-header';
    
    // 创建标签
    const label = this._createLabel();
    header.appendChild(label);
    
    // 添加类型显示
    const typeText = document.createElement('span');
    typeText.className = 'object-type';
    typeText.textContent = this.options.objectType || 'Object';
    header.appendChild(typeText);
    
    // 创建展开/折叠按钮（如果可折叠）
    if (this.collapsible) {
      this.toggleButton = document.createElement('button');
      this.toggleButton.className = 'object-toggle-button';
      this.toggleButton.textContent = this.isExpanded ? '▼' : '▶';
      this.toggleButton.addEventListener('click', () => {
        this.toggleExpanded();
      });
      header.appendChild(this.toggleButton);
    }
    
    container.appendChild(header);

    // 创建对象内容容器
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'object-content';
    this.contentContainer.style.display = this.isExpanded ? 'block' : 'none';
    
    // 创建属性列表容器
    this.propertiesContainer = document.createElement('div');
    this.propertiesContainer.className = 'object-properties';
    this.contentContainer.appendChild(this.propertiesContainer);
    
    container.appendChild(this.contentContainer);
    
    // 初始化属性组件
    this._renderProperties();
    
    // 设置初始禁用状态
    this.setDisabled(this.isDisabled);
    
    this.element = container;
    return container;
  }

  // 切换展开/折叠状态
  toggleExpanded() {
    if (!this.collapsible) return;
    
    this.isExpanded = !this.isExpanded;
    if (this.toggleButton) {
      this.toggleButton.textContent = this.isExpanded ? '▼' : '▶';
    }
    if (this.contentContainer) {
      this.contentContainer.style.display = this.isExpanded ? 'block' : 'none';
    }
  }

  // 渲染对象的所有属性
  _renderProperties() {
    if (!this.propertiesContainer) return;
    
    // 清空现有属性
    this.propertiesContainer.innerHTML = '';
    this.propertyComponents = {};
    
    // 获取要显示的属性列表
    const propertiesToShow = this._getPropertiesToShow();
    
    if (propertiesToShow.length === 0 && !this.showEmpty) {
      // 如果没有属性且不显示空对象，添加提示信息
      const emptyText = document.createElement('div');
      emptyText.className = 'object-empty';
      emptyText.textContent = 'No properties to display';
      this.propertiesContainer.appendChild(emptyText);
      return;
    }
    
    // 为每个属性创建组件
    propertiesToShow.forEach(propName => {
      this._createPropertyComponent(propName);
    });
  }

  // 获取要显示的属性列表
  _getPropertiesToShow() {
    const result = [];
    
    // 1. 首先添加通过propertyDefinitions定义的属性
    if (this.propertyDefinitions && typeof this.propertyDefinitions === 'object') {
      Object.keys(this.propertyDefinitions).forEach(key => {
        result.push(key);
      });
    }
    
    // 2. 然后添加对象自身的属性（排除已添加的）
    if (this.propertyValue && typeof this.propertyValue === 'object') {
      Object.keys(this.propertyValue).forEach(key => {
        // 跳过原型链上的属性和已经添加的属性
        if (this.propertyValue.hasOwnProperty(key) && !result.includes(key)) {
          // 可以添加过滤条件，例如跳过以_开头的私有属性
          if (!this.options.skipPrivate || !key.startsWith('_')) {
            result.push(key);
          }
        }
      });
    }
    
    return result;
  }

  // 创建单个属性的组件
  _createPropertyComponent(propName) {
    const propValue = this.propertyValue[propName];
    const propDefinition = this.propertyDefinitions[propName] || {};
    
    // 确定属性类型
    let propType = propDefinition.type;
    if (!propType) {
      propType = this._determinePropertyType(propValue);
    }
    
    // 创建属性容器
    const propContainer = document.createElement('div');
    propContainer.className = 'object-property-item';
    
    // 创建组件工厂实例
    const factory = new ComponentFactory();
    const createComponent = factory.createPropertyComponent.bind(factory);
    
    // 创建属性组件
    const componentOptions = {
      ...propDefinition,
      type: propType,
      displayName: propDefinition.displayName || this._formatPropertyName(propName)
    };
    
    // 特殊处理嵌套对象和数组
    if (propType === 'object' && propValue && typeof propValue === 'object' && !Array.isArray(propValue)) {
      componentOptions.properties = propDefinition.properties;
      componentOptions.defaultExpanded = propDefinition.defaultExpanded !== false;
    } else if (propType === 'array' && Array.isArray(propValue)) {
      componentOptions.itemType = propDefinition.itemType || 'string';
      componentOptions.itemOptions = propDefinition.itemOptions || {};
      componentOptions.defaultExpanded = propDefinition.defaultExpanded !== false;
    }
    
    const propertyComponent = createComponent(
      propName,
      propValue,
      (name, newValue) => {
        this.updateProperty(propName, newValue);
      },
      componentOptions
    );
    
    // 添加组件元素
    const componentElement = propertyComponent.getElement();
    propContainer.appendChild(componentElement);
    
    this.propertiesContainer.appendChild(propContainer);
    this.propertyComponents[propName] = { component: propertyComponent, container: propContainer };
  }

  // 确定属性类型
  _determinePropertyType(value) {
    if (value === null) return 'string';
    
    switch (typeof value) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        return Array.isArray(value) ? 'array' : 'object';
      default:
        return 'string';
    }
  }

  // 更新单个属性
  updateProperty(propName, newValue) {
    // 创建新对象以触发变更检测
    const newObject = { ...this.propertyValue };
    newObject[propName] = newValue;
    
    this.propertyValue = newObject;
    this._triggerChange(newObject);
  }

  // 添加新属性
  addProperty(propName, propValue, propType = 'string', options = {}) {
    // 创建新对象
    const newObject = { ...this.propertyValue };
    newObject[propName] = propValue;
    
    // 更新属性定义
    if (!this.propertyDefinitions[propName]) {
      this.propertyDefinitions[propName] = { ...options, type: propType };
    }
    
    this.propertyValue = newObject;
    
    // 创建新属性的组件
    this._createPropertyComponent(propName);
    
    this._triggerChange(newObject);
    
    // 自动展开
    if (!this.isExpanded) {
      this.toggleExpanded();
    }
  }

  // 删除属性
  removeProperty(propName) {
    if (!(propName in this.propertyValue)) return;
    
    // 创建新对象
    const newObject = { ...this.propertyValue };
    delete newObject[propName];
    
    // 移除对应的组件
    if (this.propertyComponents[propName]) {
      const { container } = this.propertyComponents[propName];
      if (container) {
        container.remove();
      }
      delete this.propertyComponents[propName];
    }
    
    this.propertyValue = newObject;
    this._triggerChange(newObject);
  }

  _updateUI() {
    // 更新现有属性的值
    Object.keys(this.propertyComponents).forEach(propName => {
      const { component } = this.propertyComponents[propName];
      if (component && component.updateValue && this.propertyValue.hasOwnProperty(propName)) {
        component.updateValue(this.propertyValue[propName]);
      }
    });
    
    // 检查是否有新属性需要添加
    this._renderProperties();
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    
    // 禁用所有属性组件
    Object.values(this.propertyComponents).forEach(({ component }) => {
      if (component && component.setDisabled) {
        component.setDisabled(disabled);
      }
    });
    
    // 禁用切换按钮
    if (this.toggleButton) {
      this.toggleButton.disabled = disabled;
    }
  }

  // 获取当前值
  getValue() {
    return this.propertyValue;
  }

  // 更新属性定义
  updatePropertyDefinitions(definitions) {
    this.propertyDefinitions = { ...this.propertyDefinitions, ...definitions };
    this._renderProperties();
  }
}

export default ObjectPropertyComponent;