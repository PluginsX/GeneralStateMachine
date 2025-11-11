// 剪贴板服务 - 管理复制粘贴功能
export default class ClipboardService {
    constructor() {
        this.clipboardData = null;
    }
    
    // 复制数据到剪贴板
    copy(data) {
        this.clipboardData = data;
        
        // 同时复制到系统剪贴板（如果支持）
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                navigator.clipboard.writeText(JSON.stringify(data));
            } catch (e) {
                console.warn('无法写入系统剪贴板:', e);
            }
        }
    }
    
    // 从剪贴板获取数据
    get() {
        return this.clipboardData;
    }
    
    // 检查剪贴板是否有数据
    hasData() {
        return this.clipboardData !== null;
    }
    
    // 清空剪贴板
    clear() {
        this.clipboardData = null;
    }
    
    // 从系统剪贴板读取（异步）
    async readFromSystem() {
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    try {
                        const data = JSON.parse(text);
                        this.clipboardData = data;
                        return data;
                    } catch (e) {
                        // 不是JSON格式，忽略
                    }
                }
            } catch (e) {
                console.warn('无法读取系统剪贴板:', e);
            }
        }
        return null;
    }
}

