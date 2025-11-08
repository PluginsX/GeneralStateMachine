import { deepClone } from './common.js';
import Node from '../core/node.js';
import Connection from '../core/connection.js';
import Condition from '../core/condition.js';

// 合并节点功能
export function mergeNodes(editor) {
    // 检查是否有选中的节点
    const selectedNodes = editor.selectedElements.filter(el => el.type === 'node');
    if (selectedNodes.length === 0) {
        alert('请先选择一个节点作为合并目标');
        return;
    }
    
    if (selectedNodes.length > 1) {
        alert('请只选择一个节点作为合并目标');
        return;
    }
    
    const targetNode = selectedNodes[0];
    const targetName = targetNode.name;
    
    // 查找所有同名节点
    const nodesToMerge = editor.nodes.filter(node => node.name === targetName && node.id !== targetNode.id);
    
    if (nodesToMerge.length === 0) {
        alert(`没有找到其他名为"${targetName}"的节点`);
        return;
    }
    
    // 保存历史状态
    const stateBefore = {
        nodes: editor.nodes.map(n => deepClone(n)),
        connections: editor.connections.map(c => deepClone(c))
    };
    
    // 合并所有同名节点的连接关系到目标节点
    nodesToMerge.forEach(node => {
        // 转移所有从该节点出发的连线
        editor.connections.forEach(conn => {
            if (conn.sourceNodeId === node.id) {
                conn.sourceNodeId = targetNode.id;
            }
        });
        
        // 转移所有到达该节点的连线
        editor.connections.forEach(conn => {
            if (conn.targetNodeId === node.id) {
                conn.targetNodeId = targetNode.id;
            }
        });
        
        // 删除该节点
        editor.removeNode(node.id);
    });
    
    // 保存历史状态
    const stateAfter = {
        nodes: editor.nodes.map(n => deepClone(n)),
        connections: editor.connections.map(c => deepClone(c))
    };
    
    editor.historyManager.addHistory('merge-nodes', {
        before: stateBefore,
        after: stateAfter
    });
    
    // 更新选择
    editor.selectedElements = [targetNode];
    editor.scheduleRender();
    
    alert(`成功合并了 ${nodesToMerge.length} 个同名节点`);
}

// 合并条件功能
export function mergeConditions(editor) {
    // 检查是否有选中的节点
    const selectedNodes = editor.selectedElements.filter(el => el.type === 'node');
    if (selectedNodes.length === 0) {
        alert('请先选择一个节点作为合并条件的起始节点');
        return;
    }
    
    if (selectedNodes.length > 1) {
        alert('请只选择一个节点作为合并条件的起始节点');
        return;
    }
    
    const sourceNode = selectedNodes[0];
    
    // 获取所有从该节点出发的连线
    const outgoingConnections = editor.connections.filter(conn => conn.sourceNodeId === sourceNode.id);
    
    if (outgoingConnections.length === 0) {
        alert('该节点没有出发的连线');
        return;
    }
    
    // 保存历史状态
    const stateBefore = {
        nodes: editor.nodes.map(n => deepClone(n)),
        connections: editor.connections.map(c => deepClone(c))
    };
    
    // 执行合并条件算法
    let currentConnections = [...outgoingConnections];
    let currentNode = sourceNode;
    let nodeCounter = 1;
    
    // 递归合并条件
    function mergeConditionsRecursive(node, connections) {
        if (connections.length <= 1) {
            return; // 没有需要合并的连线
        }
        
        // 找出所有连线的条件
        const allConditions = connections.map(conn => ({
            conn,
            conditions: conn.conditions.map(c => JSON.stringify(c))
        }));
        
        // 找出所有连线的共同条件
        const commonConditionsMap = new Map();
        
        // 遍历所有连线对，找出共同条件
        for (let i = 0; i < connections.length; i++) {
            for (let j = i + 1; j < connections.length; j++) {
                const conn1 = connections[i];
                const conn2 = connections[j];
                
                // 找出两个连线的共同条件
                const common = conn1.conditions.filter(c1 => 
                    conn2.conditions.some(c2 => 
                        c1.parameter === c2.parameter && 
                        c1.operator === c2.operator && 
                        c1.value === c2.value
                    )
                );
                
                // 为每个共同条件创建键
                common.forEach(cond => {
                    const key = JSON.stringify(cond);
                    if (!commonConditionsMap.has(key)) {
                        commonConditionsMap.set(key, {
                            condition: cond,
                            connections: new Set()
                        });
                    }
                    commonConditionsMap.get(key).connections.add(conn1);
                    commonConditionsMap.get(key).connections.add(conn2);
                });
            }
        }
        
        // 如果没有共同条件，停止递归
        if (commonConditionsMap.size === 0) {
            return;
        }
        
        // 找出包含最多连线的共同条件
        let bestCommon = null;
        let maxConnections = 0;
        
        commonConditionsMap.forEach((value, key) => {
            if (value.connections.size > maxConnections) {
                maxConnections = value.connections.size;
                bestCommon = {
                    condition: value.condition,
                    connections: Array.from(value.connections)
                };
            }
        });
        
        if (!bestCommon || bestCommon.connections.length < 2) {
            return; // 没有足够的共同条件
        }
        
        // 创建新节点（直接添加到数组，避免重复历史记录）
        const newNodeName = `${node.name}_${nodeCounter++}`;
        const newNode = new Node(newNodeName, node.x + 200, node.y);
        newNode.description = `由合并条件自动创建的节点`;
        newNode.width = 150;
        newNode.height = 50;
        newNode.autoSize = false;
        editor.nodes.push(newNode);
        
        // 创建从当前节点到新节点的连线（包含共同条件）
        const newConnection = new Connection(node.id, newNode.id);
        newConnection.conditions = [JSON.parse(JSON.stringify(bestCommon.condition))];
        editor.connections.push(newConnection);
        
        // 更新所有包含共同条件的连线
        bestCommon.connections.forEach(conn => {
            // 移除共同条件
            conn.conditions = conn.conditions.filter(c => 
                !(c.parameter === bestCommon.condition.parameter &&
                  c.operator === bestCommon.condition.operator &&
                  c.value === bestCommon.condition.value)
            );
            
            // 将连线的源节点改为新节点
            conn.sourceNodeId = newNode.id;
        });
        
        // 递归处理新节点的连线
        const newConnections = editor.connections.filter(conn => conn.sourceNodeId === newNode.id);
        mergeConditionsRecursive(newNode, newConnections);
    }
    
    // 开始合并
    mergeConditionsRecursive(currentNode, currentConnections);
    
    // 保存历史状态
    const stateAfter = {
        nodes: editor.nodes.map(n => deepClone(n)),
        connections: editor.connections.map(c => deepClone(c))
    };
    
    editor.historyManager.addHistory('merge-conditions', {
        before: stateBefore,
        after: stateAfter
    });
    
    // 更新选择
    editor.selectedElements = [sourceNode];
    editor.scheduleRender();
    
    alert('条件合并完成');
}

// 删除重复连接功能
export function removeDuplicateConnections(editor) {
    // 保存历史状态
    const stateBefore = {
        nodes: editor.nodes.map(n => deepClone(n)),
        connections: editor.connections.map(c => deepClone(c))
    };
    
    // 用于存储唯一连接的键值对
    const uniqueConnections = new Map();
    // 存储要删除的重复连接
    const duplicateConnections = [];
    
    // 遍历所有连接
    editor.connections.forEach(connection => {
        // 创建连接的唯一标识：起始节点ID + 终止节点ID + 条件的JSON字符串
        // 首先确保条件数组的一致性，按相同顺序排序条件以正确比较
        const sortedConditions = [...connection.conditions].sort((a, b) => {
            // 按类型、参数、操作符和值排序
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            if (a.parameter !== b.parameter) return a.parameter.localeCompare(b.parameter);
            if (a.operator !== b.operator) return a.operator.localeCompare(b.operator);
            return a.value.localeCompare(b.value);
        });
        
        // 创建连接标识
        const connectionKey = `${connection.sourceNodeId}-${connection.targetNodeId}-${JSON.stringify(sortedConditions)}`;
        
        // 检查是否已存在相同的连接
        if (uniqueConnections.has(connectionKey)) {
            // 如果存在，将当前连接标记为重复
            duplicateConnections.push(connection.id);
        } else {
            // 否则，将其添加到唯一连接集合中
            uniqueConnections.set(connectionKey, connection);
        }
    });
    
    // 删除所有重复连接
    duplicateConnections.forEach(connId => {
        const index = editor.connections.findIndex(c => c.id === connId);
        if (index !== -1) {
            editor.connections.splice(index, 1);
            
            // 从选中元素中移除
            editor.selectedElements = editor.selectedElements.filter(el => el.id !== connId);
        }
    });
    
    // 保存历史状态
    const stateAfter = {
        nodes: editor.nodes.map(n => deepClone(n)),
        connections: editor.connections.map(c => deepClone(c))
    };
    
    editor.historyManager.addHistory('remove-duplicate-connections', {
        before: stateBefore,
        after: stateAfter
    });
    
    // 更新UI
    editor.scheduleRender();
    
    if (duplicateConnections.length > 0) {
        alert(`成功删除了 ${duplicateConnections.length} 个重复连接`);
    } else {
        alert('未发现重复连接');
    }
}

