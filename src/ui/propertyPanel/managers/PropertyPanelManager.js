import PropertyReflection from '../reflection/PropertyReflection.js';
import TypeRegistry from '../reflection/TypeRegistry.js';
import ComponentFactory from '../utils/ComponentFactory.js';
import CollapsiblePanelComponent from '../components/complex/CollapsiblePanelComponent.js';
import ObjectBasePropertyHandler from './ObjectBasePropertyHandler.js';

class PropertyPanelManager {
  constructor(containerElement) {
    // 容器元素
    this.container = containerElement;
    
    // 当前选中的对象
    this.selectedObject = null;
    
    // 属性组件实例映射
    this.propertyComponents = new Map();
    
    // 属性组面板映射
    this.groupPanels = new Map();
    
    // 反射工具实例
    this.reflection = new PropertyReflection();
    
    // 类型注册中心实例
    this.typeRegistry = new TypeRegistry();
    
    // ObjectBase属性处理器
    this.objectBaseHandler = new ObjectBasePropertyHandler();
    
    // 组件工厂实例
    this.componentFactory = null;
    
    // 删除回调函数
    this.onDeleteCallback = null;
    
    // 事件监听器
    this.eventListeners = {
      objectSelected: [],
      propertyChanged: [],
      panelCleared: [],
      panelUpdated: []
    };
    
    // 配置选项
    this.options = {
      autoRefresh: true,
      showEmptyGroups: false,
      expandGroups: true,
      showAdvancedProperties: false,
      groupByCategory: true,
      defaultGroup: 'Default'
    };
    
    // 初始化
    this._initialize();
  }

  // 初始化
  _initialize() {
    // 确保容器元素存在
    if (!this.container) {
      console.error('PropertyPanelManager: Container element not provided');
      return;
    }

    // 创建标题区域
    this.header = document.createElement('div');
    this.header.className = 'property-panel-header';
    this.container.appendChild(this.header);

    // 创建对象名称显示
    this.objectNameElement = document.createElement('h3');
    this.objectNameElement.className = 'property-panel-title';
    this.objectNameElement.textContent = 'No Selection';
    this.header.appendChild(this.objectNameElement);

    // 创建内容区域
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'property-panel-content';
    this.container.appendChild(this.contentContainer);

    // 创建空状态提示
    this.emptyStateElement = document.createElement('div');
    this.emptyStateElement.className = 'property-panel-empty';
    this.emptyStateElement.textContent = 'Select an object to view its properties';
    this.contentContainer.appendChild(this.emptyStateElement);

    // 初始化组件工厂
    this._initializeComponentFactory();

    // 注册默认类型
    this._registerDefaultTypes();
  }

  // 初始化组件工厂
  _initializeComponentFactory() {
    // 创建真实的组件工厂实例
    this.componentFactory = new ComponentFactory();
  }

  // 注册默认类型
  _registerDefaultTypes() {
    // 注册ObjectBase相关类型处理器
    this.typeRegistry.registerTypeHandler('ObjectBase', {
      getProperties: (object) => this.objectBaseHandler.getObjectBaseProperties(object),
      validateProperty: (propertyName, value, object) => 
        this.objectBaseHandler.validateObjectBaseProperty(propertyName, value, object),
      formatProperty: (propertyName, value) => 
        this.objectBaseHandler.formatObjectBaseProperty(propertyName, value)
    });
  }

  // 设置删除回调
  setOnDeleteCallback(callback) {
    this.onDeleteCallback = callback;
  }
  
  /**
   * 添加事件监听器
   */
  addEventListener(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }
    this.eventListeners[eventType].push(callback);
  }
  
  /**
   * 触发事件
   */
  dispatchEvent(eventType, detail) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].forEach(callback => {
        try {
          callback({ type: eventType, detail });
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }
  
  /**
   * 显示空状态
   */
  showEmptyState() {
    this.clearPanel();
    this.emptyStateElement.style.display = 'block';
  }
  
  /**
   * 显示多个选中项的信息
   */
  showMultipleSelectionInfo(selectedItems) {
    this.clearPanel();
    
    // 隐藏空状态元素
    this.emptyStateElement.style.display = 'none';
    
    const infoContainer = document.createElement('div');
    infoContainer.className = 'multiple-selection-info';
    
    const title = document.createElement('h3');
    title.textContent = '多元素选中';
    infoContainer.appendChild(title);
    
    const nodeCount = selectedItems.filter(item => item.type === 'node').length;
    const connectionCount = selectedItems.filter(item => item.type === 'connection').length;
    
    const stats = document.createElement('div');
    stats.innerHTML = `
        <p>共选中 ${selectedItems.length} 个元素</p>
        <p>节点: ${nodeCount}</p>
        <p>连线: ${connectionCount}</p>
    `;
    infoContainer.appendChild(stats);
    
    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '删除选中';
    deleteBtn.className = 'delete-btn';
    deleteBtn.addEventListener('click', () => {
      if (this.onDeleteCallback) {
        this.onDeleteCallback();
      }
    });
    infoContainer.appendChild(deleteBtn);
    
    this.contentContainer.appendChild(infoContainer);
    
    // 更新标题
    this.objectNameElement.textContent = `多元素选中 (${selectedItems.length})`;
  }
  
  // 选择对象
  selectObject(object) {
    console.log('PropertyPanelManager.selectObject called with:', object);
    
    // 清空当前面板
    this.clearPanel();
    
    // 设置选中对象
    this.selectedObject = object;
    
    // 更新标题
    this._updateObjectName();
    
    // 如果没有对象，显示空状态
    if (!object) {
      console.log('对象为空，显示空状态');
      this.emptyStateElement.style.display = 'block';
      this._triggerEvent('objectSelected', null);
      return;
    }
    
    // 隐藏空状态
    this.emptyStateElement.style.display = 'none';
    
    console.log('开始渲染属性...');
    // 渲染属性
    this._renderProperties(object);
    
    // 触发事件
    this._triggerEvent('objectSelected', object);
  }

  // 清空面板
  clearPanel() {
    // 销毁所有属性组件
    this.propertyComponents.forEach((component) => {
      if (component && component.destroy) {
        component.destroy();
      }
    });
    this.propertyComponents.clear();
    
    // 销毁所有组面板
    this.groupPanels.forEach((panel) => {
      if (panel && panel.destroy) {
        panel.destroy();
      }
    });
    this.groupPanels.clear();
    
    // 清空内容
    this.contentContainer.innerHTML = '';
    
    // 重新添加空状态元素并默认隐藏
    this.emptyStateElement.style.display = 'block';
    this.contentContainer.appendChild(this.emptyStateElement);
    
    // 重置选中对象
    this.selectedObject = null;
    
    // 更新标题
    this._updateObjectName();
    
    // 触发事件
    this._triggerEvent('panelCleared');
  }

  // 更新对象名称显示
  _updateObjectName() {
    if (!this.selectedObject) {
      this.objectNameElement.textContent = 'No Selection';
      return;
    }
    
    // 尝试获取对象名称
    let objectName = 'Object';
    
    if (this.selectedObject.name !== undefined) {
      objectName = this.selectedObject.name;
    } else if (this.selectedObject.constructor && this.selectedObject.constructor.name) {
      objectName = this.selectedObject.constructor.name;
    }
    
    // 添加类型信息
    let typeName = 'unknown';
    if (this.selectedObject.constructor && this.selectedObject.constructor.name) {
      typeName = this.selectedObject.constructor.name;
    }
    
    this.objectNameElement.textContent = `${objectName} (${typeName})`;
  }

  // 渲染对象属性
  _renderProperties(object) {
    try {
      console.log('_renderProperties开始，对象:', object);
      
      // 确保 contentContainer 存在
      if (!this.contentContainer) {
        console.error('PropertyPanelManager: contentContainer is not initialized');
        return;
      }
      
      let propertyDefinitions;
      
      // 检查是否是ObjectBase子类实例
      if (this.objectBaseHandler.isObjectBaseInstance(object)) {
        console.log('使用ObjectBase处理器获取属性');
        // 使用ObjectBase属性处理器获取属性
        propertyDefinitions = this.objectBaseHandler.getObjectBaseProperties(object);
      } else {
        console.log('使用通用反射机制获取属性');
        // 使用通用反射机制获取属性
        propertyDefinitions = this.reflection.getObjectProperties(object);
      }
      
      console.log('获取到的属性定义:', propertyDefinitions);
      
      // 过滤属性
      const filteredProperties = this._filterProperties(propertyDefinitions);
      console.log('过滤后的属性:', filteredProperties);
      
      // 排序属性
      const sortedProperties = this.reflection.getSortedProperties(filteredProperties);
      console.log('排序后的属性:', sortedProperties);
      
      if (this.options.groupByCategory) {
        console.log('按组渲染属性');
        // 按组渲染
        this._renderPropertiesByGroup(sortedProperties, object);
      } else {
        console.log('直接渲染所有属性');
        // 直接渲染所有属性
        this._renderAllProperties(sortedProperties, object);
      }
      
      // 触发面板更新事件
      this._triggerEvent('panelUpdated', object, propertyDefinitions);
    } catch (error) {
      console.error('Error rendering properties:', error);
      this._showError('Failed to render properties');
    }
  }

  // 过滤属性
  _filterProperties(properties) {
    const filtered = {};
    
    Object.entries(properties).forEach(([key, def]) => {
      // 过滤不可见属性
      if (!def.visible) {
        return;
      }
      
      // 过滤高级属性（如果配置不显示）
      if (def.advanced && !this.options.showAdvancedProperties) {
        return;
      }
      
      filtered[key] = def;
    });
    
    return filtered;
  }

  // 按组渲染属性
  _renderPropertiesByGroup(properties, object) {
    // 确保 contentContainer 存在
    if (!this.contentContainer) {
      console.error('PropertyPanelManager: contentContainer is not initialized in _renderPropertiesByGroup');
      return;
    }
    
    // 获取属性组
    const groups = this.reflection.getPropertyGroups(properties);
    
    // 渲染每个组
    Object.entries(groups).forEach(([groupName, groupProperties]) => {
      // 跳过空组（如果配置不显示）
      if (!this.options.showEmptyGroups && Object.keys(groupProperties).length === 0) {
        return;
      }
      
      // 创建组面板
      const panel = this._createGroupPanel(groupName);
      
      // 渲染组内属性
      this._renderGroupProperties(groupProperties, object, panel);
      
      // 添加到内容容器
      const panelElement = panel && panel.getElement ? panel.getElement() : null;
      if (panelElement && this.contentContainer && this.contentContainer.appendChild) {
        this.contentContainer.appendChild(panelElement);
      } else {
        console.error('PropertyPanelManager: Invalid panel element or contentContainer in _renderPropertiesByGroup', {
          panel: !!panel,
          panelElement: !!panelElement,
          contentContainer: !!this.contentContainer,
          appendChild: !!(this.contentContainer && this.contentContainer.appendChild)
        });
      }
    });
  }

  // 渲染所有属性（不分组）
  _renderAllProperties(properties, object) {
    // 确保 contentContainer 存在
    if (!this.contentContainer) {
      console.error('PropertyPanelManager: contentContainer is not initialized in _renderAllProperties');
      return;
    }
    
    Object.entries(properties).forEach(([propertyName, propertyDef]) => {
      const component = this._renderProperty(propertyName, propertyDef, object);
      if (component) {
        // 将组件添加到内容容器
        const componentElement = component && component.getElement ? component.getElement() : null;
        if (componentElement && this.contentContainer && this.contentContainer.appendChild) {
          this.contentContainer.appendChild(componentElement);
        } else {
          console.error(`PropertyPanelManager: Invalid component element or contentContainer for property ${propertyName}`, {
            component: !!component,
            componentElement: !!componentElement,
            contentContainer: !!this.contentContainer,
            appendChild: !!(this.contentContainer && this.contentContainer.appendChild)
          });
        }
      }
    });
  }

  // 创建组面板
  _createGroupPanel(groupName) {
    const panel = new CollapsiblePanelComponent(
      groupName,
      null,
      null,
      {
        displayName: this._formatGroupName(groupName),
        defaultExpanded: this.options.expandGroups,
        panelClass: `property-group-panel group-${this._sanitizeGroupName(groupName)}`
      }
    );
    
    this.groupPanels.set(groupName, panel);
    return panel;
  }

  // 渲染组内属性
  _renderGroupProperties(properties, object, panel) {
    Object.entries(properties).forEach(([propertyName, propertyDef]) => {
      const component = this._renderProperty(propertyName, propertyDef, object);
      if (component) {
        panel.addChildComponent(component);
      }
    });
  }

  // 渲染单个属性
  _renderProperty(propertyName, propertyDef, object) {
    // 获取属性值
    const propertyValue = object[propertyName];
    
    // 创建变更处理函数
    const onChange = (name, newValue) => {
      this._onPropertyChange(name, newValue, object, propertyDef);
    };
    
    // 创建组件配置
    const componentOptions = propertyDef.getComponentOptions();
    
    // 使用自定义编辑器（如果有）
    if (propertyDef.customEditor) {
      const customEditor = propertyDef.customEditor(propertyName, propertyValue, onChange, componentOptions);
      if (customEditor) {
        this.propertyComponents.set(propertyName, customEditor);
        return customEditor;
      }
    }
    
    // 使用组件工厂创建组件
    const component = this.componentFactory.createPropertyComponent(
      propertyName,
      propertyValue,
      onChange,
      componentOptions
    );
    
    if (component) {
      this.propertyComponents.set(propertyName, component);
    }
    
    return component;
  }

  // 处理属性变更
  _onPropertyChange(propertyName, newValue, object, propertyDef) {
    try {
      // 检查是否是ObjectBase子类实例
      if (this.objectBaseHandler.isObjectBaseInstance(object)) {
        // 使用ObjectBase处理器处理变更
        const oldValue = object[propertyName];
        const success = this.objectBaseHandler.handlePropertyChange(object, propertyName, newValue, oldValue);
        
        if (!success) {
          console.warn(`Property change prevented by ObjectBase handler for ${propertyName}`);
          // 刷新组件以显示原始值
          const component = this.propertyComponents.get(propertyName);
          if (component && component.updateValue) {
            component.updateValue(oldValue);
          }
          return;
        }
      } else {
        // 常规对象处理
        // 验证新值
        const validation = propertyDef.validate(newValue);
        if (!validation.valid) {
          console.warn(`Invalid value for property ${propertyName}: ${validation.message}`);
          this._showValidationError(propertyName, validation.message);
          return;
        }
        
        // 调用变更前钩子
        if (propertyDef.onBeforeChange) {
          const result = propertyDef.onBeforeChange(propertyName, newValue, object);
          if (result === false) {
            console.warn(`Property change prevented by onBeforeChange for ${propertyName}`);
            return;
          }
        }
        
        // 更新对象属性
        object[propertyName] = newValue;
        
        // 调用变更后钩子
        if (propertyDef.onAfterChange) {
          propertyDef.onAfterChange(propertyName, newValue, object);
        }
      }
      
      // 触发属性变更事件
      this._triggerEvent('propertyChanged', object, propertyName, newValue);
      
      // 同时分发新标准事件格式
      this.dispatchEvent('propertyChange', {
        objectId: object.id || 'unknown',
        property: propertyName,
        value: newValue,
        type: object.type || 'object'
      });
      
      // 更新依赖属性
      this._updateDependentProperties(propertyName, object);
    } catch (error) {
      console.error(`Error changing property ${propertyName}:`, error);
      this._showError(`Failed to update property: ${propertyName}`);
    }
  }

  // 更新依赖属性
  _updateDependentProperties(changedPropertyName, object) {
    // 检查所有属性是否有依赖于变更属性的
    this.propertyComponents.forEach((component, propertyName) => {
      if (propertyName === changedPropertyName) return;
      
      // 获取属性定义
      const propertyDef = this.reflection.getObjectProperties(object)[propertyName];
      if (!propertyDef) return;
      
      // 检查是否有依赖
      if (propertyDef.dependencies.includes(changedPropertyName)) {
        // 更新组件值
        if (component && component.updateValue) {
          component.updateValue(object[propertyName]);
        }
      }
    });
  }

  // 格式化组名
  _formatGroupName(groupName) {
    return groupName
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^([a-z])/, match => match.toUpperCase());
  }

  // 清理组名用于CSS类
  _sanitizeGroupName(groupName) {
    return groupName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  // 显示验证错误
  _showValidationError(propertyName, message) {
    // 这里可以实现错误提示逻辑
    console.warn(`Validation error for ${propertyName}: ${message}`);
  }

  // 显示错误信息
  _showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'property-panel-error';
    errorElement.textContent = message;
    
    // 清除现有错误
    const existingError = this.contentContainer.querySelector('.property-panel-error');
    if (existingError) {
      existingError.remove();
    }
    
    // 添加到容器
    this.contentContainer.appendChild(errorElement);
    
    // 自动清除错误
    setTimeout(() => {
      if (errorElement.parentNode === this.contentContainer) {
        errorElement.remove();
      }
    }, 5000);
  }

  // 刷新面板
  refresh() {
    if (!this.selectedObject) return;
    
    // 重新渲染属性
    this.selectObject(this.selectedObject);
  }

  // 注册事件监听器
  on(eventName, listener) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].push(listener);
    }
  }

  // 移除事件监听器
  off(eventName, listener) {
    if (this.eventListeners[eventName]) {
      const index = this.eventListeners[eventName].indexOf(listener);
      if (index > -1) {
        this.eventListeners[eventName].splice(index, 1);
      }
    }
  }

  // 触发事件
  _triggerEvent(eventName, ...args) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error);
        }
      });
    }
  }

  // 设置配置选项
  setOptions(options) {
    this.options = { ...this.options, ...options };
    
    // 如果有选中对象，重新渲染
    if (this.selectedObject) {
      this.refresh();
    }
  }

  // 获取配置选项
  getOptions() {
    return { ...this.options };
  }

  // 注册自定义类型
  registerType(typeName, typeConfig) {
    this.typeRegistry.registerTypes({ [typeName]: typeConfig });
  }

  // 注册ObjectBase子类
  registerObjectBaseSubclass(classConstructor, propertyDefinitions) {
    return this.objectBaseHandler.registerObjectBaseSubclass(classConstructor, propertyDefinitions);
  }

  // 检查对象是否为ObjectBase实例
  isObjectBaseInstance(object) {
    return this.objectBaseHandler.isObjectBaseInstance(object);
  }

  // 获取ObjectBase属性定义
  getObjectBaseProperties(object) {
    return this.objectBaseHandler.getObjectBaseProperties(object);
  }

  // 清除对象缓存
  clearObjectCache(object) {
    this.objectBaseHandler.clearObjectCache(object);
  }

  // 获取当前选中对象
  getSelectedObject() {
    return this.selectedObject;
  }

  // 销毁管理器
  destroy() {
    // 清空面板
    this.clearPanel();
    
    // 清除事件监听器
    this.eventListeners = {};
    
    // 销毁各个组件
    if (this.objectBaseHandler) {
      this.objectBaseHandler.destroy();
    }
    
    if (this.componentFactory) {
      this.componentFactory.destroy();
    }
    
    // 清除引用
    this.selectedObject = null;
    this.reflection = null;
    this.typeRegistry = null;
    this.componentFactory = null;
    this.objectBaseHandler = null;
  }
}

export default PropertyPanelManager;