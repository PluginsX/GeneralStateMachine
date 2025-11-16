import PropertyPanelManager from './PropertyPanelManager.js';
import ThemeManager from '../utils/ThemeManager.js';

/**
 * PropertyPanel适配器
 * 用于连接新的属性面板系统和现有的系统架构
 * 实现与原始PropertyPanel相同的接口，确保无缝替换
 */
class PropertyPanelAdapter {
    constructor(container) {
        this.container = container;
        
        // 初始化主题管理器
        this.themeManager = ThemeManager;
        
        // 初始化新的属性面板管理器
        this.panelManager = new PropertyPanelManager(container);
        
        // 回调函数存储
        this.onNodeUpdate = null;
        this.onConnectionUpdate = null;
        this.onDeleteCallback = null;
        
        // 初始化主题
        this.initTheme();
        
        // 设置事件监听器
        this.setupEventListeners();
    }
    
    /**
     * 初始化主题
     */
    initTheme() {
        // 应用当前主题
        this.themeManager.applyTheme();
        
        // 监听主题变化
        this.themeManager.addThemeChangeListener(() => {
            this.themeManager.applyTheme();
        });
    }
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听属性变化事件，转换为原有系统的回调
        this.panelManager.addEventListener('propertyChange', (event) => {
            const { objectId, property, value } = event.detail;
            
            // 根据对象类型调用相应的回调
            if (event.detail.type === 'node' && this.onNodeUpdate) {
                this.onNodeUpdate(objectId, { [property]: value });
            } else if (event.detail.type === 'connection' && this.onConnectionUpdate) {
                this.onConnectionUpdate(objectId, { [property]: value });
            }
        });
    }
    
    /**
     * 初始化方法 - 兼容原有接口
     */
    init() {
        // 清理容器
        if (this.container) {
            this.container.innerHTML = '';
        } else {
            console.warn('PropertyPanelAdapter: Container is not available during init');
        }
        
        // PropertyPanelManager在构造函数中已经初始化，这里不需要再次调用init
        // 面板已经准备好，可以直接使用
    }
    
    /**
     * 设置节点更新回调
     */
    setOnNodeUpdateCallback(callback) {
        this.onNodeUpdate = callback;
    }
    
    /**
     * 设置连线更新回调
     */
    setOnConnectionUpdateCallback(callback) {
        this.onConnectionUpdate = callback;
    }
    
    /**
     * 设置删除回调
     */
    setOnDeleteCallback(callback) {
        this.onDeleteCallback = callback;
        this.panelManager.setOnDeleteCallback(callback);
    }
    
    /**
     * 更新显示
     * 兼容原有接口的update方法
     */
    update(selectedItems, nodes, connections) {
        console.log('PropertyPanelAdapter.update called with:', {
            selectedItems: selectedItems,
            selectedItemsLength: selectedItems ? selectedItems.length : 0,
            nodes: nodes,
            connections: connections
        });
        
        if (!selectedItems || selectedItems.length === 0) {
            console.log('显示空状态');
            // 显示空状态
            this.panelManager.showEmptyState();
            return;
        }
        
        // 只处理单个选中项
        if (selectedItems.length === 1) {
            const item = selectedItems[0];
            console.log('选择单个对象:', item);
            
            // 传递给新的面板管理器显示
            this.panelManager.selectObject(item);
        } else {
            // 多个选中项时显示统计信息
            console.log('显示多选信息，选中项数量:', selectedItems.length);
            this.panelManager.showMultipleSelectionInfo(selectedItems);
        }
    }
    
    /**
     * 删除选中元素
     */
    onDelete() {
        if (this.onDeleteCallback) {
            this.onDeleteCallback();
        }
    }
    
    /**
     * 创建新节点
     * 兼容原有接口
     */
    onCreateNode(sourceNode) {
        console.log('创建新节点:', sourceNode);
    }
}

export default PropertyPanelAdapter;