import PropertyComponentBase from '../PropertyComponentBase.js';
import { createPropertyComponent } from '../../utils/ComponentFactory.js'; // 后续会创建这个工厂类

class ArrayPropertyComponent extends PropertyComponentBase {
  constructor(propertyName, propertyValue, onChangeCallback, options = {}) {
    super(propertyName, Array.isArray(propertyValue) ? propertyValue : [], onChangeCallback, options);
    this.itemType = options.itemType || 'string'; // 数组项的类型
    this.itemOptions = options.itemOptions || {}; // 数组项组件的配置选项
    this.maxItems = options.maxItems; // 最大允许的数组项数量
    this.minItems = options.minItems || 0; // 最小允许的数组项数量
    this.isExpanded = !!options.defaultExpanded; // 默认是否展开
    this.itemComponents = []; // 存储数组项的组件实例
  }

  createElement() {
    const container = document.createElement('div');
    container.className = 'property-component array-property';

    // 创建标题行（包含标签和展开/折叠按钮）
    const header = document.createElement('div');
    header.className = 'array-header';
    
    // 创建标签
    const label = this._createLabel();
    header.appendChild(label);
    
    // 添加数组长度显示
    this.lengthText = document.createElement('span');
    this.lengthText.className = 'array-length';
    this.lengthText.textContent = `(${this.propertyValue.length})`;
    header.appendChild(this.lengthText);
    
    // 创建展开/折叠按钮
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'array-toggle-button';
    this.toggleButton.textContent = this.isExpanded ? '▼' : '▶';
    this.toggleButton.addEventListener('click', () => {
      this.toggleExpanded();
    });
    header.appendChild(this.toggleButton);
    
    container.appendChild(header);

    // 创建数组内容容器
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'array-content';
    this.contentContainer.style.display = this.isExpanded ? 'block' : 'none';
    
    // 创建数组项列表
    this.itemsContainer = document.createElement('div');
    this.itemsContainer.className = 'array-items';
    this.contentContainer.appendChild(this.itemsContainer);
    
    // 创建操作按钮容器
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'array-actions';
    
    // 添加按钮
    this.addButton = document.createElement('button');
    this.addButton.className = 'array-add-button';
    this.addButton.textContent = 'Add Item';
    this.addButton.addEventListener('click', () => {
      this.addItem();
    });
    actionsContainer.appendChild(this.addButton);
    
    // 清空按钮
    this.clearButton = document.createElement('button');
    this.clearButton.className = 'array-clear-button';
    this.clearButton.textContent = 'Clear All';
    this.clearButton.addEventListener('click', () => {
      this.clearAllItems();
    });
    actionsContainer.appendChild(this.clearButton);
    
    this.contentContainer.appendChild(actionsContainer);
    container.appendChild(this.contentContainer);
    
    // 初始化数组项组件
    this._renderItems();
    this._updateButtonStates();
    
    // 设置初始禁用状态
    this.setDisabled(this.isDisabled);
    
    this.element = container;
    return container;
  }

  // 切换展开/折叠状态
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    if (this.toggleButton) {
      this.toggleButton.textContent = this.isExpanded ? '▼' : '▶';
    }
    if (this.contentContainer) {
      this.contentContainer.style.display = this.isExpanded ? 'block' : 'none';
    }
  }

  // 渲染数组项
  _renderItems() {
    if (!this.itemsContainer) return;
    
    // 清空现有项
    this.itemsContainer.innerHTML = '';
    this.itemComponents = [];
    
    // 为每个数组项创建组件
    this.propertyValue.forEach((item, index) => {
      this._createItemComponent(index, item);
    });
    
    // 更新长度显示
    this._updateLengthText();
  }

  // 创建单个数组项的组件
  _createItemComponent(index, value) {
    const itemContainer = document.createElement('div');
    itemContainer.className = 'array-item-container';
    
    // 创建索引标签
    const indexLabel = document.createElement('span');
    indexLabel.className = 'array-item-index';
    indexLabel.textContent = `[${index}]`;
    itemContainer.appendChild(indexLabel);
    
    // 尝试动态导入组件工厂
    const createComponent = window.createPropertyComponent || (() => {
      // 临时的降级处理，后续会被替换
      const el = document.createElement('input');
      el.value = String(value);
      el.addEventListener('change', (e) => {
        this.updateItem(index, e.target.value);
      });
      return { getElement: () => el, updateValue: (val) => { el.value = String(val); } };
    });
    
    // 创建数组项的属性组件
    const itemComponent = createComponent(
      `item_${index}`,
      value,
      (name, newValue) => {
        this.updateItem(index, newValue);
      },
      {
        ...this.itemOptions,
        type: this.itemType,
        displayName: ''
      }
    );
    
    // 添加组件元素
    const componentElement = itemComponent.getElement();
    componentElement.className += ' array-item-component';
    itemContainer.appendChild(componentElement);
    
    // 创建删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.className = 'array-item-delete';
    deleteButton.textContent = '×';
    deleteButton.title = 'Delete item';
    deleteButton.addEventListener('click', () => {
      this.removeItem(index);
    });
    itemContainer.appendChild(deleteButton);
    
    // 上下移动按钮
    if (this.propertyValue.length > 1) {
      // 上移按钮
      if (index > 0) {
        const upButton = document.createElement('button');
        upButton.className = 'array-item-move array-item-move-up';
        upButton.textContent = '↑';
        upButton.title = 'Move up';
        upButton.addEventListener('click', () => {
          this.moveItem(index, index - 1);
        });
        itemContainer.appendChild(upButton);
      }
      
      // 下移按钮
      if (index < this.propertyValue.length - 1) {
        const downButton = document.createElement('button');
        downButton.className = 'array-item-move array-item-move-down';
        downButton.textContent = '↓';
        downButton.title = 'Move down';
        downButton.addEventListener('click', () => {
          this.moveItem(index, index + 1);
        });
        itemContainer.appendChild(downButton);
      }
    }
    
    this.itemsContainer.appendChild(itemContainer);
    this.itemComponents.push({ component: itemComponent, container: itemContainer });
  }

  // 添加新项
  addItem() {
    if (this.maxItems !== undefined && this.propertyValue.length >= this.maxItems) {
      return; // 已达到最大项数
    }
    
    // 根据类型创建默认值
    let defaultValue;
    switch (this.itemType) {
      case 'string':
        defaultValue = '';
        break;
      case 'number':
        defaultValue = 0;
        break;
      case 'boolean':
        defaultValue = false;
        break;
      case 'object':
        defaultValue = {};
        break;
      case 'array':
        defaultValue = [];
        break;
      default:
        defaultValue = '';
    }
    
    // 添加到数组
    const newIndex = this.propertyValue.length;
    this.propertyValue.push(defaultValue);
    
    // 创建组件
    this._createItemComponent(newIndex, defaultValue);
    
    // 更新状态
    this._updateButtonStates();
    this._updateLengthText();
    this._triggerChange([...this.propertyValue]);
    
    // 自动展开
    if (!this.isExpanded) {
      this.toggleExpanded();
    }
  }

  // 删除项
  removeItem(index) {
    if (index < 0 || index >= this.propertyValue.length) {
      return;
    }
    
    if (this.minItems !== undefined && this.propertyValue.length <= this.minItems) {
      return; // 已达到最小项数
    }
    
    // 移除数组项
    this.propertyValue.splice(index, 1);
    
    // 移除对应的组件
    const itemToRemove = this.itemComponents[index];
    if (itemToRemove && itemToRemove.container) {
      itemToRemove.container.remove();
    }
    this.itemComponents.splice(index, 1);
    
    // 重新渲染后面的项（更新索引）
    this._reindexItemsFrom(index);
    
    // 更新状态
    this._updateButtonStates();
    this._updateLengthText();
    this._triggerChange([...this.propertyValue]);
  }

  // 更新项
  updateItem(index, newValue) {
    if (index < 0 || index >= this.propertyValue.length) {
      return;
    }
    
    this.propertyValue[index] = newValue;
    this._triggerChange([...this.propertyValue]);
  }

  // 移动项
  moveItem(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.propertyValue.length ||
        toIndex < 0 || toIndex >= this.propertyValue.length) {
      return;
    }
    
    // 移动数组项
    const [movedItem] = this.propertyValue.splice(fromIndex, 1);
    this.propertyValue.splice(toIndex, 0, movedItem);
    
    // 移动组件
    const [movedComponent] = this.itemComponents.splice(fromIndex, 1);
    this.itemComponents.splice(toIndex, 0, movedComponent);
    
    // 重新渲染所有项
    this._renderItems();
    
    this._triggerChange([...this.propertyValue]);
  }

  // 清空所有项
  clearAllItems() {
    if (this.minItems !== undefined && this.minItems > 0) {
      // 只保留最小数量的项
      while (this.propertyValue.length > this.minItems) {
        this.removeItem(this.propertyValue.length - 1);
      }
    } else {
      // 清空所有项
      this.propertyValue = [];
      this._renderItems();
      this._updateButtonStates();
      this._updateLengthText();
      this._triggerChange([]);
    }
  }

  // 重新索引从指定位置开始的项
  _reindexItemsFrom(startIndex) {
    for (let i = startIndex; i < this.itemComponents.length; i++) {
      const indexLabel = this.itemComponents[i].container.querySelector('.array-item-index');
      if (indexLabel) {
        indexLabel.textContent = `[${i}]`;
      }
    }
  }

  // 更新按钮状态
  _updateButtonStates() {
    if (this.addButton) {
      this.addButton.disabled = this.isDisabled || 
        (this.maxItems !== undefined && this.propertyValue.length >= this.maxItems);
    }
    
    if (this.clearButton) {
      this.clearButton.disabled = this.isDisabled || 
        (this.minItems !== undefined && this.propertyValue.length <= this.minItems);
    }
  }

  // 更新长度显示
  _updateLengthText() {
    if (this.lengthText) {
      this.lengthText.textContent = `(${this.propertyValue.length})`;
    }
  }

  _updateUI() {
    this._renderItems();
    this._updateButtonStates();
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    this._updateButtonStates();
    
    // 禁用所有数组项组件
    this.itemComponents.forEach(item => {
      if (item.component && item.component.setDisabled) {
        item.component.setDisabled(disabled);
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
}

export default ArrayPropertyComponent;