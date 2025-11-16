import EventBus from './EventBus.js';

/**
 * 双向绑定管理器
 * 用于管理属性面板UI和数据对象之间的双向数据流
 */
class BindingManager {
    constructor() {
        this.boundElements = new Map();
        this.eventBus = EventBus.getInstance();
    }
    
    /**
     * 建立数据绑定
     * @param {HTMLElement} element - 要绑定的DOM元素
     * @param {Object} object - 数据对象
     * @param {string} propertyPath - 属性路径，支持嵌套属性
     * @param {Function} formatter - 格式化函数 (可选)
     * @param {Function} parser - 解析函数 (可选)
     */
    bind(element, object, propertyPath, formatter = null, parser = null) {
        if (!element || !object || !propertyPath) {
            console.error('绑定参数不完整');
            return;
        }
        
        // 生成唯一ID
        const bindingId = this._generateBindingId();
        element.dataset.bindingId = bindingId;
        
        // 存储绑定信息
        const bindingInfo = {
            element,
            object,
            propertyPath,
            formatter,
            parser,
            updateHandler: null,
            isUpdating: false
        };
        
        this.boundElements.set(bindingId, bindingInfo);
        
        // 设置事件监听
        this._setupElementListeners(bindingInfo);
        
        // 初始同步数据到UI
        this.syncObjectToUI(bindingId);
        
        return bindingId;
    }
    
    /**
     * 解除绑定
     * @param {string|HTMLElement} target - 绑定ID或DOM元素
     */
    unbind(target) {
        if (!target) return;
        
        let bindingId;
        
        if (typeof target === 'string') {
            bindingId = target;
        } else if (target.dataset && target.dataset.bindingId) {
            bindingId = target.dataset.bindingId;
        }
        
        if (bindingId && this.boundElements.has(bindingId)) {
            const bindingInfo = this.boundElements.get(bindingId);
            this._removeElementListeners(bindingInfo);
            this.boundElements.delete(bindingId);
            
            if (bindingInfo.element.dataset) {
                delete bindingInfo.element.dataset.bindingId;
            }
        }
    }
    
    /**
     * 解除所有绑定
     */
    unbindAll() {
        Array.from(this.boundElements.keys()).forEach(bindingId => {
            this.unbind(bindingId);
        });
    }
    
    /**
     * 同步数据对象到UI
     * @param {string} bindingId - 绑定ID
     */
    syncObjectToUI(bindingId) {
        if (!this.boundElements.has(bindingId)) return;
        
        const bindingInfo = this.boundElements.get(bindingId);
        
        // 防止循环更新
        if (bindingInfo.isUpdating) return;
        bindingInfo.isUpdating = true;
        
        try {
            const value = this._getNestedProperty(bindingInfo.object, bindingInfo.propertyPath);
            const displayValue = bindingInfo.formatter ? bindingInfo.formatter(value) : value;
            
            this._updateElementValue(bindingInfo.element, displayValue);
        } catch (error) {
            console.error(`同步数据到UI失败: ${bindingInfo.propertyPath}`, error);
        } finally {
            bindingInfo.isUpdating = false;
        }
    }
    
    /**
     * 同步UI到数据对象
     * @param {string} bindingId - 绑定ID
     */
    syncUIToObject(bindingId) {
        if (!this.boundElements.has(bindingId)) return;
        
        const bindingInfo = this.boundElements.get(bindingId);
        
        // 防止循环更新
        if (bindingInfo.isUpdating) return;
        bindingInfo.isUpdating = true;
        
        try {
            const elementValue = this._getElementValue(bindingInfo.element);
            const parsedValue = bindingInfo.parser ? bindingInfo.parser(elementValue) : elementValue;
            
            // 更新对象属性
            const oldValue = this._getNestedProperty(bindingInfo.object, bindingInfo.propertyPath);
            this._setNestedProperty(bindingInfo.object, bindingInfo.propertyPath, parsedValue);
            
            // 触发属性变更事件
            this.eventBus.emit('propertyChange', {
                object: bindingInfo.object,
                property: bindingInfo.propertyPath,
                oldValue,
                newValue: parsedValue
            });
        } catch (error) {
            console.error(`同步UI到数据对象失败: ${bindingInfo.propertyPath}`, error);
        } finally {
            bindingInfo.isUpdating = false;
        }
    }
    
    /**
     * 获取嵌套属性值
     */
    _getNestedProperty(object, path) {
        if (!object || !path) return undefined;
        
        const parts = path.split('.');
        let value = object;
        
        for (const part of parts) {
            if (value === null || value === undefined) return undefined;
            value = value[part];
        }
        
        return value;
    }
    
    /**
     * 设置嵌套属性值
     */
    _setNestedProperty(object, path, value) {
        if (!object || !path) return;
        
        const parts = path.split('.');
        const lastPart = parts.pop();
        
        let current = object;
        for (const part of parts) {
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
        
        current[lastPart] = value;
    }
    
    /**
     * 设置元素监听器
     */
    _setupElementListeners(bindingInfo) {
        const { element, bindingId } = bindingInfo;
        
        // 根据元素类型设置不同的事件监听
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
            if (element.type === 'checkbox' || element.type === 'radio') {
                bindingInfo.updateHandler = () => this.syncUIToObject(bindingId);
                element.addEventListener('change', bindingInfo.updateHandler);
            } else if (element.type === 'range' || element.type === 'number') {
                bindingInfo.updateHandler = () => this.syncUIToObject(bindingId);
                element.addEventListener('input', bindingInfo.updateHandler);
            } else {
                bindingInfo.updateHandler = () => this.syncUIToObject(bindingId);
                element.addEventListener('input', bindingInfo.updateHandler);
                element.addEventListener('change', bindingInfo.updateHandler);
            }
        }
    }
    
    /**
     * 移除元素监听器
     */
    _removeElementListeners(bindingInfo) {
        if (bindingInfo.element && bindingInfo.updateHandler) {
            bindingInfo.element.removeEventListener('input', bindingInfo.updateHandler);
            bindingInfo.element.removeEventListener('change', bindingInfo.updateHandler);
            bindingInfo.updateHandler = null;
        }
    }
    
    /**
     * 更新元素值
     */
    _updateElementValue(element, value) {
        if (element.tagName === 'INPUT') {
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else if (element.type === 'radio') {
                element.checked = element.value === String(value);
            } else {
                element.value = value !== undefined && value !== null ? String(value) : '';
            }
        } else if (element.tagName === 'TEXTAREA') {
            element.value = value !== undefined && value !== null ? String(value) : '';
        } else if (element.tagName === 'SELECT') {
            element.value = value !== undefined && value !== null ? String(value) : '';
        }
    }
    
    /**
     * 获取元素值
     */
    _getElementValue(element) {
        if (element.tagName === 'INPUT') {
            if (element.type === 'checkbox') {
                return element.checked;
            } else if (element.type === 'radio') {
                return element.checked ? element.value : undefined;
            } else if (element.type === 'number' || element.type === 'range') {
                return element.value === '' ? '' : parseFloat(element.value);
            } else {
                return element.value;
            }
        } else if (element.tagName === 'TEXTAREA') {
            return element.value;
        } else if (element.tagName === 'SELECT') {
            return element.value;
        }
        
        return null;
    }
    
    /**
     * 生成绑定ID
     */
    _generateBindingId() {
        return `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export default BindingManager;