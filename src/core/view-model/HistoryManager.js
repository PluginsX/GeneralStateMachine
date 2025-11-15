// 历史记录管理器 - 视图模型层
// 负责撤销/重做功能
export default class HistoryManager {
    constructor(nodeManagerOrMaxHistory, connectionManager = null, viewManager = null) {
        this.historyStack = [];        // 历史记录堆栈
        this.historyIndex = -1;        // 当前历史记录索引
        this.isUndoing = false;        // 是否正在撤销操作
        this.isRedoing = false;        // 是否正在重做操作
        
        // 支持两种调用方式：
        // 1. new HistoryManager(maxHistory) - 仅设置最大历史记录数
        // 2. new HistoryManager(nodeManager, connectionManager, viewManager) - 完整的管理器模式
        if (typeof nodeManagerOrMaxHistory === 'number') {
            this.maxHistory = nodeManagerOrMaxHistory;
            this.nodeManager = null;
            this.connectionManager = null;
            this.viewManager = null;
        } else {
            this.maxHistory = 100;
            this.nodeManager = nodeManagerOrMaxHistory;
            this.connectionManager = connectionManager;
            this.viewManager = viewManager;
        }
        
        this.onHistoryChange = null;   // 历史状态变更回调
    }
    
    // 设置历史状态变更回调
    setOnHistoryChangeCallback(callback) {
        this.onHistoryChange = callback;
    }
    
    // 添加历史记录
    addHistory(action) {
        // 如果当前不在历史记录的末尾，清除之后的历史记录
        if (this.historyIndex < this.historyStack.length - 1) {
            this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
        }
        
        // 添加新的历史记录
        this.historyStack.push(action);
        
        // 如果超出最大历史记录数，移除最旧的记录
        if (this.historyStack.length > this.maxHistory) {
            this.historyStack.shift();
        } else {
            this.historyIndex++;
        }
        
        // 触发历史状态变更回调
        this.notifyHistoryChange();
    }
    
    // 撤销操作
    undo() {
        if (!this.canUndo()) return false;
        
        this.isUndoing = true;
        
        const action = this.historyStack[this.historyIndex];
        this.historyIndex--;
        
        // 执行撤销操作
        this.executeUndo(action);
        
        this.isUndoing = false;
        
        // 触发历史状态变更回调
        this.notifyHistoryChange();
        
        return true;
    }
    
    // 重做操作
    redo() {
        if (!this.canRedo()) return false;
        
        this.isRedoing = true;
        
        this.historyIndex++;
        const action = this.historyStack[this.historyIndex];
        
        // 执行重做操作
        this.executeRedo(action);
        
        this.isRedoing = false;
        
        // 触发历史状态变更回调
        this.notifyHistoryChange();
        
        return true;
    }
    
    // 执行撤销操作
    executeUndo(action) {
        switch (action.type) {
            case 'addNode':
                // 删除添加的节点
                if (this.nodeManager) {
                    this.nodeManager.deleteNode(action.nodeId);
                }
                break;
                
            case 'deleteNode':
                // 恢复删除的节点
                if (this.nodeManager && action.node) {
                    const nodePos = (action.node.transform && action.node.transform.position) ? 
                        action.node.transform.position : { x: 0, y: 0 };
                    const node = this.nodeManager.addNode(action.node.name, nodePos.x, nodePos.y);
                    // 恢复其他属性
                    Object.assign(node, action.node);
                }
                break;
                
            case 'updateNode':
                // 恢复节点的旧属性
                if (this.nodeManager) {
                    this.nodeManager.updateNode(action.nodeId, action.oldValues);
                }
                break;
                
            case 'deleteSelectedNodes':
                // 恢复删除的多个节点
                if (this.nodeManager && action.nodes) {
                    action.nodes.forEach(nodeData => {
                        const nodePos = (nodeData.transform && nodeData.transform.position) ? 
                            nodeData.transform.position : { x: 0, y: 0 };
                        const node = this.nodeManager.addNode(nodeData.name, nodePos.x, nodePos.y);
                        Object.assign(node, nodeData);
                    });
                }
                break;
                
            case 'addConnection':
                // 删除添加的连线
                if (this.connectionManager) {
                    this.connectionManager.deleteConnection(action.connectionId);
                }
                break;
                
            case 'deleteConnection':
                // 恢复删除的连线
                if (this.connectionManager && action.connection) {
                    const connection = this.connectionManager.addConnection(
                        action.connection.sourceNodeId,
                        action.connection.targetNodeId,
                        action.connection.fromSide,
                        action.connection.toSide
                    );
                    // 恢复其他属性
                    if (connection) {
                        Object.assign(connection, action.connection);
                    }
                }
                break;
                
            case 'updateConnection':
                // 恢复连线的旧属性
                if (this.connectionManager) {
                    this.connectionManager.updateConnection(action.connectionId, action.oldValues);
                }
                break;
                
            case 'deleteSelectedConnections':
                // 恢复删除的多个连线
                if (this.connectionManager && action.connections) {
                    action.connections.forEach(connectionData => {
                        const connection = this.connectionManager.addConnection(
                            connectionData.sourceNodeId,
                            connectionData.targetNodeId,
                            connectionData.fromSide,
                            connectionData.toSide
                        );
                        if (connection) {
                            Object.assign(connection, action.connection);
                        }
                    });
                }
                break;
                
            case 'delete-text-contents':
                // 恢复删除的文字对象
                if (this.viewManager && action.textContents) {
                    action.textContents.forEach(textData => {
                        this.viewManager.addTextContent(textData.text, textData.x, textData.y);
                    });
                } else if (action.editor && action.textContents) {
                    // 单参数模式下，直接调用editor的方法
                    action.textContents.forEach(textData => {
                        action.editor.addTextContent(textData.text, textData.x, textData.y);
                    });
                }
                break;
                
            case 'update-text-content':
                // 恢复文字对象的旧内容
                if (this.viewManager && action.previousState) {
                    const textContent = this.viewManager.getTextContentById(action.textContentId);
                    if (textContent) {
                        textContent.text = action.previousState.text;
                    }
                } else if (action.editor && action.previousState) {
                    // 单参数模式下，直接调用editor的方法
                    const textContent = action.editor.getTextContentById(action.textContentId);
                    if (textContent) {
                        textContent.text = action.previousState.text;
                    }
                }
                break;
                
            // 可以根据需要添加更多的撤销类型
        }
    }
    
    // 执行重做操作
    executeRedo(action) {
        switch (action.type) {
            case 'addNode':
                // 重新添加节点（需要从当前状态中查找）
                if (this.nodeManager) {
                    // 这里简化处理，实际应该从当前状态中查找节点信息
                    // 或者在历史记录中保存完整的节点信息
                }
                break;
                
            case 'deleteNode':
                // 重新删除节点
                if (this.nodeManager && action.node) {
                    this.nodeManager.deleteNode(action.node.id);
                }
                break;
                
            case 'updateNode':
                // 重新应用更新
                if (this.nodeManager) {
                    this.nodeManager.updateNode(action.nodeId, action.newValues);
                }
                break;
                
            case 'deleteSelectedNodes':
                // 重新删除多个节点
                if (this.nodeManager && action.nodes) {
                    action.nodes.forEach(nodeData => {
                        this.nodeManager.deleteNode(nodeData.id);
                    });
                }
                break;
                
            case 'addConnection':
                // 重新添加连线（需要从当前状态中查找）
                if (this.connectionManager) {
                    // 这里简化处理，实际应该从当前状态中查找连线信息
                }
                break;
                
            case 'deleteConnection':
                // 重新删除连线
                if (this.connectionManager && action.connection) {
                    this.connectionManager.deleteConnection(action.connection.id);
                }
                break;
                
            case 'updateConnection':
                // 重新应用更新
                if (this.connectionManager) {
                    this.connectionManager.updateConnection(action.connectionId, action.newValues);
                }
                break;
                
            case 'deleteSelectedConnections':
                // 重新删除多个连线
                if (this.connectionManager && action.connections) {
                    action.connections.forEach(connectionData => {
                        this.connectionManager.deleteConnection(connectionData.id);
                    });
                }
                break;
                
            case 'delete-text-contents':
                // 重新删除文字对象
                if (this.viewManager && action.textContents) {
                    action.textContents.forEach(textData => {
                        this.viewManager.removeTextContent(textData.id);
                    });
                } else if (action.editor && action.textContents) {
                    // 单参数模式下，直接调用editor的方法
                    action.textContents.forEach(textData => {
                        action.editor.removeTextContent(textData.id);
                    });
                }
                break;
                
            case 'update-text-content':
                // 重新应用文字对象的更新
                if (this.viewManager && action.newState) {
                    const textContent = this.viewManager.getTextContentById(action.textContentId);
                    if (textContent) {
                        textContent.text = action.newState.text;
                    }
                } else if (action.editor && action.newState) {
                    // 单参数模式下，直接调用editor的方法
                    const textContent = action.editor.getTextContentById(action.textContentId);
                    if (textContent) {
                        textContent.text = action.newState.text;
                    }
                }
                break;
                
            // 可以根据需要添加更多的重做类型
        }
    }
    
    // 检查是否可以撤销
    canUndo() {
        return this.historyIndex >= 0;
    }
    
    // 检查是否可以重做
    canRedo() {
        return this.historyIndex < this.historyStack.length - 1;
    }
    
    // 清空历史记录
    clearHistory() {
        this.historyStack = [];
        this.historyIndex = -1;
        
        // 触发历史状态变更回调
        this.notifyHistoryChange();
    }
    
    // 获取历史状态信息
    getHistoryState() {
        return {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historyIndex: this.historyIndex,
            historyCount: this.historyStack.length
        };
    }
    
    // 通知历史状态变更
    notifyHistoryChange() {
        if (this.onHistoryChange) {
            this.onHistoryChange(this.getHistoryState());
        }
    }
    
    // 检查是否正在执行撤销或重做操作
    isInHistoryOperation() {
        return this.isUndoing || this.isRedoing;
    }
}