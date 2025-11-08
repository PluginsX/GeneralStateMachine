// 节点管理器 - 视图模型层
// 负责节点的业务逻辑：添加、删除、合并、复制等
import Node from '../model/Node.js';
import { deepClone } from '../../../utils/common.js';

export default class NodeManager {
    constructor(editorState, historyManager) {
        this.nodes = new Map(); // 存储所有节点，key为nodeId
        this.editorState = editorState;
        this.historyManager = historyManager;
        this.onChange = null; // 变更回调函数
    }
    
    // 设置变更回调
    setOnChangeCallback(callback) {
        this.onChange = callback;
    }
    
    // 添加节点
    addNode(name, x, y) {
        const node = new Node(name, x, y);
        this.nodes.set(node.id, node);
        
        // 记录历史
        if (this.historyManager) {
            this.historyManager.addHistory({
                type: 'addNode',
                nodeId: node.id
            });
        }
        
        // 触发变更
        this.notifyChange();
        return node;
    }
    
    // 删除节点
    deleteNode(nodeId) {
        if (!this.nodes.has(nodeId)) return false;
        
        const node = this.nodes.get(nodeId);
        this.nodes.delete(nodeId);
        
        // 从选中状态中移除
        this.editorState.selectedNodeIds.delete(nodeId);
        
        // 记录历史
        if (this.historyManager) {
            this.historyManager.addHistory({
                type: 'deleteNode',
                node: deepClone(node)
            });
        }
        
        // 触发变更
        this.notifyChange();
        return true;
    }
    
    // 删除选中的节点
    deleteSelectedNodes() {
        const deletedNodes = [];
        const selectedIds = Array.from(this.editorState.selectedNodeIds);
        
        // 记录要删除的节点
        for (const nodeId of selectedIds) {
            if (this.nodes.has(nodeId)) {
                deletedNodes.push(deepClone(this.nodes.get(nodeId)));
                this.nodes.delete(nodeId);
            }
        }
        
        // 清空选中状态
        this.editorState.selectedNodeIds.clear();
        
        // 记录历史
        if (this.historyManager && deletedNodes.length > 0) {
            this.historyManager.addHistory({
                type: 'deleteSelectedNodes',
                nodes: deletedNodes
            });
        }
        
        // 触发变更
        this.notifyChange();
        return deletedNodes.length > 0;
    }
    
    // 更新节点属性
    updateNode(nodeId, updates) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;
        
        // 记录旧值用于历史
        const oldValues = {};
        Object.keys(updates).forEach(key => {
            oldValues[key] = node[key];
            node[key] = updates[key];
        });
        
        // 记录历史
        if (this.historyManager) {
            this.historyManager.addHistory({
                type: 'updateNode',
                nodeId: nodeId,
                oldValues: oldValues,
                newValues: updates
            });
        }
        
        // 触发变更
        this.notifyChange();
        return true;
    }
    
    // 获取节点
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    
    // 获取所有节点
    getAllNodes() {
        return Array.from(this.nodes.values());
    }
    
    // 移动节点
    moveNode(nodeId, deltaX, deltaY) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;
        
        node.x += deltaX;
        node.y += deltaY;
        
        // 触发变更
        this.notifyChange();
        return true;
    }
    
    // 移动选中的节点
    moveSelectedNodes(deltaX, deltaY) {
        let moved = false;
        this.editorState.selectedNodeIds.forEach(nodeId => {
            if (this.moveNode(nodeId, deltaX, deltaY)) {
                moved = true;
            }
        });
        return moved;
    }
    
    // 选中节点
    selectNode(nodeId, multiSelect = false) {
        if (!this.nodes.has(nodeId)) return false;
        
        if (!multiSelect) {
            this.editorState.clearSelection();
        }
        
        this.editorState.selectedNodeIds.add(nodeId);
        
        // 触发变更
        this.notifyChange();
        return true;
    }
    
    // 检查点是否在节点内
    isPointInNode(nodeId, x, y) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;
        
        return x >= node.x && x <= node.x + node.width &&
               y >= node.y && y <= node.y + node.height;
    }
    
    // 获取包含指定点的节点
    getNodeAtPoint(x, y) {
        for (const node of this.nodes.values()) {
            if (this.isPointInNode(node.id, x, y)) {
                return node;
            }
        }
        return null;
    }
    
    // 通知变更
    notifyChange() {
        if (this.onChange) {
            this.onChange();
        }
    }
    
    // 从数据加载节点
    loadFromData(data) {
        this.nodes.clear();
        if (data.nodes && Array.isArray(data.nodes)) {
            data.nodes.forEach(nodeData => {
                const node = new Node(nodeData.name, nodeData.x, nodeData.y);
                Object.assign(node, nodeData);
                this.nodes.set(node.id, node);
            });
        }
        this.notifyChange();
    }
}