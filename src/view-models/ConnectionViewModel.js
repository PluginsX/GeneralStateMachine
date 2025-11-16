// 连线ViewModel - 管理连线相关的状态和操作
import ConnectionModel from '../models/ConnectionModel.js';
import ConnectionService from '../services/ConnectionService.js';
import { deepClone } from '../utils/common.js';

export default class ConnectionViewModel {
    constructor(editorState, historyManager) {
        this.connections = new Map(); // 存储所有连线，key为connectionId
        this.editorState = editorState;
        this.historyManager = historyManager;
        this.onChange = null;
    }
    
    setOnChangeCallback(callback) {
        this.onChange = callback;
    }
    
    // 添加连线
    addConnection(sourceNodeId, targetNodeId, fromSide, toSide) {
        // 检查是否存在相同的连线
        if (this.hasConnection(sourceNodeId, targetNodeId, fromSide, toSide)) {
            return null;
        }
        
        const connection = new ConnectionModel({
            sourceNodeId: sourceNodeId,
            targetNodeId: targetNodeId,
            fromSide: fromSide,
            toSide: toSide
        });
        this.connections.set(connection.id, connection);
        
        if (this.historyManager) {
            this.historyManager.addHistory('add-connection', {
                connectionId: connection.id,
                connection: deepClone(connection)
            });
        }
        
        this.notifyChange();
        return connection;
    }
    
    // 删除连线
    deleteConnection(connectionId) {
        if (!this.connections.has(connectionId)) return false;
        
        const connection = this.connections.get(connectionId);
        this.connections.delete(connectionId);
        
        this.editorState.selectedConnectionIds.delete(connectionId);
        
        if (this.historyManager) {
            this.historyManager.addHistory('delete-connection', {
                connection: deepClone(connection)
            });
        }
        
        this.notifyChange();
        return true;
    }
    
    // 删除选中的连线
    deleteSelectedConnections() {
        const deletedConnections = [];
        const selectedIds = Array.from(this.editorState.selectedConnectionIds);
        
        for (const connectionId of selectedIds) {
            if (this.connections.has(connectionId)) {
                deletedConnections.push(deepClone(this.connections.get(connectionId)));
                this.connections.delete(connectionId);
            }
        }
        
        this.editorState.selectedConnectionIds.clear();
        
        if (this.historyManager && deletedConnections.length > 0) {
            this.historyManager.addHistory('delete-selected-connections', {
                connections: deletedConnections
            });
        }
        
        this.notifyChange();
        return deletedConnections.length > 0;
    }
    
    // 更新连线属性
    updateConnection(connectionId, updates) {
        const connection = this.connections.get(connectionId);
        if (!connection) return false;
        
        const oldValues = {};
        Object.keys(updates).forEach(key => {
            oldValues[key] = connection[key];
            connection[key] = updates[key];
        });
        
        if (this.historyManager) {
            this.historyManager.addHistory('update-connection', {
                connectionId: connectionId,
                oldValues: oldValues,
                newValues: updates
            });
        }
        
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
    hasConnection(sourceNodeId, targetNodeId, fromSide, toSide) {
        for (const connection of this.connections.values()) {
            if (connection.sourceNodeId === sourceNodeId && 
                connection.targetNodeId === targetNodeId &&
                connection.fromSide === (fromSide || 'right') &&
                connection.toSide === (toSide || 'left')) {
                return true;
            }
        }
        return false;
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
        
        for (const connection of this.connections.values()) {
            if (connection.sourceNodeId === nodeId || 
                connection.targetNodeId === nodeId) {
                connectionsToDelete.push(connection.id);
            }
        }
        
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
        this.notifyChange();
        return true;
    }
    
    // 取消选中连线
    deselectConnection(connectionId) {
        this.editorState.selectedConnectionIds.delete(connectionId);
        this.notifyChange();
    }
    
    // 从数据加载连线
    loadFromData(data) {
        this.connections.clear();
        if (data.connections && Array.isArray(data.connections)) {
            data.connections.forEach(connectionData => {
                const connection = ConnectionModel.fromData(connectionData);
                this.connections.set(connection.id, connection);
            });
        }
        this.notifyChange();
    }
    
    notifyChange() {
        if (this.onChange) {
            this.onChange();
        }
    }
}

