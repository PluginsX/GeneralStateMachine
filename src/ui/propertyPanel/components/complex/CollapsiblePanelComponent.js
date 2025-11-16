import { PropertyComponentBase } from '../PropertyComponentBase.js';

class CollapsiblePanelComponent extends PropertyComponentBase {
  constructor(propertyName, propertyValue, onChangeCallback, options = {}) {
    super(propertyName, propertyValue, onChangeCallback, options);
    this.isExpanded = !!options.defaultExpanded; // 默认是否展开
    this.childrenComponents = []; // 存储子组件
    this.contentRenderer = options.contentRenderer; // 自定义内容渲染器
    this.showHeader = options.showHeader !== false; // 是否显示头部
    this.headerRenderer = options.headerRenderer; // 自定义头部渲染器
    this.collapsible = options.collapsible !== false; // 是否可折叠
    this.emptyText = options.emptyText || 'No items to display'; // 空状态文本
    this.icon = options.icon; // 面板图标
    
    // 立即创建DOM元素
    this.createElement();
  }

  createElement() {
    const container = document.createElement('div');
    container.className = 'property-component collapsible-panel';
    
    // 创建设置面板类名
    if (this.options.panelClass) {
      if (typeof this.options.panelClass === 'string') {
        // 如果是字符串，按空格分割并逐个添加
        const classes = this.options.panelClass.trim().split(/\s+/);
        classes.forEach(className => {
          if (className) {
            container.classList.add(className);
          }
        });
      } else if (Array.isArray(this.options.panelClass)) {
        // 如果是数组，逐个添加
        this.options.panelClass.forEach(className => {
          if (className) {
            container.classList.add(className);
          }
        });
      }
    }

    // 创建头部
    if (this.showHeader) {
      this.header = this._createHeader();
      container.appendChild(this.header);
    }

    // 创建内容容器
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'collapsible-content';
    this.contentContainer.style.display = this.isExpanded ? 'block' : 'none';
    container.appendChild(this.contentContainer);

    // 初始渲染内容
    this._renderContent();
    
    this.element = container;
    return container;
  }

  // 创建头部
  _createHeader() {
    const header = document.createElement('div');
    header.className = 'collapsible-header';
    
    // 应用自定义头部渲染器
    if (this.headerRenderer && typeof this.headerRenderer === 'function') {
      const customHeader = this.headerRenderer(this);
      header.appendChild(customHeader);
      return header;
    }
    
    // 默认头部内容
    
    // 创建标题容器
    const titleContainer = document.createElement('div');
    titleContainer.className = 'collapsible-title-container';
    
    // 添加图标
    if (this.icon) {
      const iconElement = document.createElement('span');
      iconElement.className = 'collapsible-icon';
      if (this.icon.startsWith('<') && this.icon.endsWith('>')) {
        // 处理HTML图标
        iconElement.innerHTML = this.icon;
      } else {
        // 处理文本图标
        iconElement.textContent = this.icon;
      }
      titleContainer.appendChild(iconElement);
    }
    
    // 创建标签
    const label = this._createLabel();
    titleContainer.appendChild(label);
    
    // 添加计数或其他信息
    if (this.options.infoText) {
      const infoText = document.createElement('span');
      infoText.className = 'collapsible-info';
      infoText.textContent = this.options.infoText;
      titleContainer.appendChild(infoText);
    }
    
    header.appendChild(titleContainer);
    
    // 创建展开/折叠按钮
    if (this.collapsible) {
      this.toggleButton = document.createElement('button');
      this.toggleButton.className = 'collapsible-toggle';
      this.toggleButton.textContent = this.isExpanded ? '▼' : '▶';
      this.toggleButton.addEventListener('click', () => {
        this.toggleExpanded();
      });
      header.appendChild(this.toggleButton);
    }
    
    return header;
  }

  // 渲染内容
  _renderContent() {
    if (!this.contentContainer) return;
    
    // 清空现有内容
    this.contentContainer.innerHTML = '';
    this.childrenComponents = [];
    
    // 应用自定义内容渲染器
    if (this.contentRenderer && typeof this.contentRenderer === 'function') {
      const customContent = this.contentRenderer(this);
      if (customContent) {
        this.contentContainer.appendChild(customContent);
        return;
      }
    }
    
    // 默认内容 - 空状态
    const emptyElement = document.createElement('div');
    emptyElement.className = 'collapsible-empty';
    emptyElement.textContent = this.emptyText;
    this.contentContainer.appendChild(emptyElement);
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
      
      // 触发展开/折叠事件
      if (this.isExpanded) {
        this._onExpanded();
      } else {
        this._onCollapsed();
      }
    }
  }

  // 展开事件处理
  _onExpanded() {
    // 可以被子类覆盖
    if (this.options.onExpanded) {
      this.options.onExpanded(this);
    }
  }

  // 折叠事件处理
  _onCollapsed() {
    // 可以被子类覆盖
    if (this.options.onCollapsed) {
      this.options.onCollapsed(this);
    }
  }

  // 添加子组件
  addChildComponent(component) {
    if (!component || !component.getElement) return;
    
    const componentElement = component.getElement();
    this.contentContainer.appendChild(componentElement);
    this.childrenComponents.push(component);
  }

  // 移除子组件
  removeChildComponent(component) {
    const index = this.childrenComponents.indexOf(component);
    if (index > -1) {
      const componentElement = component.getElement();
      if (componentElement && componentElement.parentNode === this.contentContainer) {
        this.contentContainer.removeChild(componentElement);
      }
      this.childrenComponents.splice(index, 1);
    }
  }

  // 清空子组件
  clearChildren() {
    this.contentContainer.innerHTML = '';
    this.childrenComponents = [];
  }

  // 重新渲染内容
  reRenderContent() {
    this._renderContent();
  }

  // 更新头部信息
  updateHeaderInfo(infoText) {
    this.options.infoText = infoText;
    if (this.header) {
      const existingInfo = this.header.querySelector('.collapsible-info');
      if (existingInfo) {
        existingInfo.textContent = infoText;
      } else if (infoText) {
        // 如果不存在且有新信息，创建新的信息元素
        const infoElement = document.createElement('span');
        infoElement.className = 'collapsible-info';
        infoElement.textContent = infoText;
        
        const titleContainer = this.header.querySelector('.collapsible-title-container');
        if (titleContainer) {
          titleContainer.appendChild(infoElement);
        }
      }
    }
  }

  // 设置图标
  setIcon(icon) {
    this.icon = icon;
    if (this.header) {
      const iconElement = this.header.querySelector('.collapsible-icon');
      if (iconElement) {
        if (icon.startsWith('<') && icon.endsWith('>')) {
          iconElement.innerHTML = icon;
        } else {
          iconElement.textContent = icon;
        }
      }
    }
  }

  _updateUI() {
    // 更新子组件
    this.childrenComponents.forEach(component => {
      if (component && component.updateValue) {
        component.updateValue(this.propertyValue);
      }
    });
    
    // 重新渲染内容
    this._renderContent();
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    
    // 禁用所有子组件
    this.childrenComponents.forEach(component => {
      if (component && component.setDisabled) {
        component.setDisabled(disabled);
      }
    });
    
    // 禁用切换按钮
    if (this.toggleButton) {
      this.toggleButton.disabled = disabled;
    }
  }

  // 滚动到视图中
  scrollIntoView(options) {
    if (this.element) {
      this.element.scrollIntoView(options);
    }
  }

  // 展开面板
  expand() {
    if (!this.isExpanded) {
      this.toggleExpanded();
    }
  }

  // 折叠面板
  collapse() {
    if (this.isExpanded) {
      this.toggleExpanded();
    }
  }
}

export default CollapsiblePanelComponent;