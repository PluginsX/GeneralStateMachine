// 历史记录项类
export class HistoryItem {
    constructor(type, data) {
        this.type = type; // 'add', 'delete', 'modify'
        this.data = data;
    }
}

// 历史记录管理类
export class HistoryManager {
    constructor(limit = 50) {
        this.history = [];
        this.historyIndex = -1;
        this.historyLimit = limit;
    }

    addHistory(type, data) {
        // 如果当前不在历史记录末尾，清除后面的记录
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // 添加新记录
        this.history.push(new HistoryItem(type, data));
        this.historyIndex++;
        
        // 如果超出限制，移除最早的记录
        if (this.history.length > this.historyLimit) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex < 0) return null;
        return this.history[this.historyIndex--];
    }

    redo() {
        if (this.historyIndex >= this.history.length - 1) return null;
        return this.history[++this.historyIndex];
    }
}