import { deepClone } from './common.js';
import { AlertDialog, ConfirmDialog } from './popup.js';
import Node from '../core/node.js';
import Connection from '../core/connection.js';
import Condition from '../core/condition.js';

// 合并节点功能
export async function mergeNodes(editor) {
    // 检查是否有选中的节点
    const selectedNodes = editor.selectedElements.filter(el => el.type === 'node');
    
    // 保存历史状态
    const stateBefore = {
        nodes: editor.nodes.map(n => deepClone(n)),
        connections: editor.connections.map(c => deepClone(c))
    };
    
    let totalMergedCount = 0;
    
    if (selectedNodes.length > 0) {
        // 情况1：有选中节点 - 根据选中节点的名称合并重名节点
        // 收集所有选中节点的名称（去重）
        const selectedNames = [...new Set(selectedNodes.map(node => node.name))];
        
        // 对每个选中的节点名称进行合并
        selectedNames.forEach(targetName => {
            // 找到第一个该名称的节点作为目标节点（优先使用选中的节点）
            const targetNode = selectedNodes.find(node => node.name === targetName) || 
                               editor.nodes.find(node => node.name === targetName);
            
            if (targetNode) {
                // 查找所有同名节点（不包括目标节点本身）
                const nodesToMerge = editor.nodes.filter(node => 
                    node.name === targetName && node.id !== targetNode.id
                );
                
                if (nodesToMerge.length > 0) {
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
                    
                    totalMergedCount += nodesToMerge.length;
                }
            }
        });
    } else {
        // 情况2：无选中节点 - 执行全局重名节点合并
        // 统计所有节点名称及其出现次数
        const nameCounts = new Map();
        editor.nodes.forEach(node => {
            nameCounts.set(node.name, (nameCounts.get(node.name) || 0) + 1);
        });
        
        // 找出所有需要合并的节点名称（出现次数大于1的）
        const namesToMerge = Array.from(nameCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([name]) => name);
        
        namesToMerge.forEach(targetName => {
            // 获取所有该名称的节点
            const nodesWithSameName = editor.nodes.filter(node => node.name === targetName);
            
            if (nodesWithSameName.length > 1) {
                // 使用第一个节点作为目标节点
                const targetNode = nodesWithSameName[0];
                const nodesToMerge = nodesWithSameName.slice(1);
                
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
                
                totalMergedCount += nodesToMerge.length;
            }
        });
    }
    
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
    if (selectedNodes.length > 0) {
        // 保留选中的节点（过滤掉已被合并删除的节点）
        editor.selectedElements = selectedNodes.filter(node => 
            editor.nodes.some(n => n.id === node.id)
        );
    } else {
        // 无选中节点时，清空选择
        editor.selectedElements = [];
    }
    
    editor.scheduleRender();
    
    if (totalMergedCount > 0) {
        await AlertDialog(`成功合并了 ${totalMergedCount} 个重名节点`);
    } else {
        await AlertDialog('没有找到需要合并的重名节点');
    }
}

// 合并条件功能
export async function mergeConditions(editor) {
    // 检查是否有选中的节点
    const selectedNodes = editor.selectedElements.filter(el => el.type === 'node');
    if (selectedNodes.length === 0) {
        await AlertDialog('请先选择一个节点作为合并条件的起始节点');
        return;
    }
    
    if (selectedNodes.length > 1) {
        await AlertDialog('请只选择一个节点作为合并条件的起始节点');
        return;
    }
    
    const sourceNode = selectedNodes[0];
    
    // 获取所有从该节点出发的连线
    const outgoingConnections = editor.connections.filter(conn => conn.sourceNodeId === sourceNode.id);
    
    if (outgoingConnections.length === 0) {
        await AlertDialog('该节点没有出发的连线');
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
    
    await AlertDialog('条件合并完成');
}

// 删除重复连接功能
export async function removeDuplicateConnections(editor) {
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
        await AlertDialog(`成功删除了 ${duplicateConnections.length} 个重复连接`);
    } else {
        await AlertDialog('未发现重复连接');
    }
}

