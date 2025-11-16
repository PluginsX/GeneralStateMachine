/**
 * 事件总线类
 * 用于管理组件之间的通信和事件传播
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
        this.instance = null;
    }
    
    /**
     * 获取单例实例
     */
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    
    /**
     * 添加事件监听器
     * @param {string} eventType - 事件类型
     * @param {Function} callback - 回调函数
     * @param {Object} context - 回调函数的上下文
     * @returns {Function} 取消监听的函数
     */
    on(eventType, callback, context = null) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        
        const listener = { callback, context };
        this.listeners.get(eventType).push(listener);
        
        // 返回取消监听的函数
        return () => this.off(eventType, callback);
    }
    
    /**
     * 移除事件监听器
     * @param {string} eventType - 事件类型
     * @param {Function} callback - 回调函数
     */
    off(eventType, callback) {
        if (!this.listeners.has(eventType)) return;
        
        const listeners = this.listeners.get(eventType);
        const index = listeners.findIndex(l => l.callback === callback);
        
        if (index !== -1) {
            listeners.splice(index, 1);
        }
        
        // 如果该事件类型没有监听器了，就删除它
        if (listeners.length === 0) {
            this.listeners.delete(eventType);
        }
    }
    
    /**
     * 触发事件
     * @param {string} eventType - 事件类型
     * @param  {...any} args - 传递给回调函数的参数
     */
    emit(eventType, ...args) {
        if (!this.listeners.has(eventType)) return;
        
        const listeners = this.listeners.get(eventType);
        // 创建一个副本，避免在回调中修改监听器列表导致问题
        const listenersCopy = [...listeners];
        
        listenersCopy.forEach(({ callback, context }) => {
            try {
                if (context) {
                    callback.apply(context, args);
                } else {
                    callback(...args);
                }
            } catch (error) {
                console.error(`Error in event listener for ${eventType}:`, error);
            }
        });
    }
    
    /**
     * 只监听一次事件
     * @param {string} eventType - 事件类型
     * @param {Function} callback - 回调函数
     * @param {Object} context - 回调函数的上下文
     */
    once(eventType, callback, context = null) {
        const onceCallback = (...args) => {
            this.off(eventType, onceCallback);
            callback.apply(context || null, args);
        };
        
        this.on(eventType, onceCallback, context);
    }
    
    /**
     * 清除指定事件类型的所有监听器
     * @param {string} eventType - 事件类型
     */
    clear(eventType) {
        if (eventType) {
            this.listeners.delete(eventType);
        } else {
            this.listeners.clear();
        }
    }
    
    /**
     * 获取指定事件类型的监听器数量
     * @param {string} eventType - 事件类型
     * @returns {number} 监听器数量
     */
    listenerCount(eventType) {
        if (!this.listeners.has(eventType)) return 0;
        return this.listeners.get(eventType).length;
    }
}

export default EventBus;