// 连线管理器 - 视图模型层
// 负责连线的业务逻辑：创建、删除、去重、条件管理等
import Connection from '../model/Connection.js';
import { deepClone } from '../../../utils/common.js';

export default class ConnectionManager {
    constructor(editorState, historyManager) {
        this.connections = new Map(); // 存储所有连线，key为connectionId
        this.editorState = editorState;
        this.historyManager = historyManager;
        this.onChange = null; // 变更回调函数
    }
    
    // 设置变更回调
    setOnChangeCallback(callback) {
        this.onChange = callback;
    }
    
    // 添加连线
    addConnection(sourceNodeId, targetNodeId, fromSide, toSide) {
        // 检查是否存在相同的连线
        if (this.hasConnection(sourceNodeId, targetNodeId)) {
            return null;
        }
        
        const connection = new Connection(sourceNodeId, targetNodeId, fromSide, toSide);
        this.connections.set(connection.id, connection);
        
        // 记录历史
        if (this.historyManager) {
            this.historyManager.addHistory({
                type: 'addConnection',
                connectionId: connection.id
            });
        }
        
        // 触发变更
        this.notifyChange();
        return connection;
    }
    
    // 删除连线
    deleteConnection(connectionId) {
        if (!this.connections.has(connectionId)) return false;
        
        const connection = this.connections.get(connectionId);
        this.connections.delete(connectionId);
        
        // 从选中状态中移除
        this.editorState.selectedConnectionIds.delete(connectionId);
        
        // 记录历史
        if (this.historyManager) {
            this.historyManager.addHistory({
                type: 'deleteConnection',
                connection: deepClone(connection)
            });
        }
        
        // 触发变更
        this.notifyChange();
        return true;
    }
    
    // 删除选中的连线
    deleteSelectedConnections() {
        const deletedConnections = [];
        const selectedIds = Array.from(this.editorState.selectedConnectionIds);
        
        // 记录要删除的连线
        for (const connectionId of selectedIds) {
            if (this.connections.has(connectionId)) {
                deletedConnections.push(deepClone(this.connections.get(connectionId)));
                this.connections.delete(connectionId);
            }
        }
        
        // 清空选中状态
        this.editorState.selectedConnectionIds.clear();
        
        // 记录历史
        if (this.historyManager && deletedConnections.length > 0) {
            this.historyManager.addHistory({
                type: 'deleteSelectedConnections',
                connections: deletedConnections
            });
        }
        
        // 触发变更
        this.notifyChange();
        return deletedConnections.length > 0;
    }
    
    // 更新连线属性
    updateConnection(connectionId, updates) {
        const connection = this.connections.get(connectionId);
        if (!connection) return false;
        
        // 记录旧值用于历史
        const oldValues = {};
        Object.keys(updates).forEach(key => {
            oldValues[key] = connection[key];
            connection[key] = updates[key];
        });
        
        // 记录历史
        if (this.historyManager) {
            this.historyManager.addHistory({
                type: 'updateConnection',
                connectionId: connectionId,
                oldValues: oldValues,
                newValues: updates
            });
        }
        
        // 触发变更
        this.notifyChange();
        return true;
    }
    
    // 获取连线
    getConnection(connectionId) {
        return this.connections.get(connectionId);
    }
    
    // 获取所有连线
    getAllConnections() {
        return Array.from(this.connections.values());
    }
    
    // 检查是否存在相同的连线
    hasConnection(sourceNodeId, targetNodeId) {
        for (const connection of this.connections.values()) {
            if (connection.sourceNodeId === sourceNodeId && 
                connection.targetNodeId === targetNodeId) {
                return true;
            }
        }
        return false;
    }
    
    // 获取从指定节点出发的连线
    getConnectionsFromNode(nodeId) {
        const connections = [];
        for (const connection of this.connections.values()) {
            if (connection.sourceNodeId === nodeId) {
                connections.push(connection);
            }
        }
        return connections;
    }
    
    // 获取到达指定节点的连线
    getConnectionsToNode(nodeId) {
        const connections = [];
        for (const connection of this.connections.values()) {
            if (connection.targetNodeId === nodeId) {
                connections.push(connection);
            }
        }
        return connections;
    }
    
    // 获取与指定节点相关的所有连线
    getConnectionsForNode(nodeId) {
        const connections = [];
        for (const connection of this.connections.values()) {
            if (connection.sourceNodeId === nodeId || 
                connection.targetNodeId === nodeId) {
                connections.push(connection);
            }
        }
        return connections;
    }
    
    // 删除与指定节点相关的所有连线
    deleteConnectionsForNode(nodeId) {
        const connectionsToDelete = [];
        
        // 找出所有相关连线
        for (const connection of this.connections.values()) {
            if (connection.sourceNodeId === nodeId || 
                connection.targetNodeId === nodeId) {
                connectionsToDelete.push(connection.id);
            }
        }
        
        // 删除连线
        for (const connectionId of connectionsToDelete) {
            this.deleteConnection(connectionId);
        }
        
        return connectionsToDelete.length > 0;
    }
    
    // 选中连线
    selectConnection(connectionId, multiSelect = false) {
        if (!this.connections.has(connectionId)) return false;
        
        if (!multiSelect) {
            this.editorState.clearSelection();
        }
        
        this.editorState.selectedConnectionIds.add(connectionId);
        
        // 触发变更
        this.notifyChange();
        return true;
    }
    
    // 通知变更
    notifyChange() {
        if (this.onChange) {
            this.onChange();
        }
    }
    
    // 从数据加载连线
    loadFromData(data) {
        this.connections.clear();
        if (data.connections && Array.isArray(data.connections)) {
            data.connections.forEach(connectionData => {
                const connection = new Connection(
                    connectionData.sourceNodeId,
                    connectionData.targetNodeId,
                    connectionData.fromSide,
                    connectionData.toSide
                );
                Object.assign(connection, connectionData);
                this.connections.set(connection.id, connection);
            });
        }
        this.notifyChange();
    }
}