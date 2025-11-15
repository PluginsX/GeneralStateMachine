import { deepClone } from './common.js';
import { AlertDialog, ConfirmDialog } from './popup.js';
import NodeModel from '../models/NodeModel.js';
import ConnectionModel from '../models/ConnectionModel.js';
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
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            const newNode = new NodeModel(newNodeName, nodePos.x + 200, nodePos.y);
            newNode.description = `由合并条件自动创建的节点`;
            newNode.group = ''; // 初始化Group属性
            newNode.width = 150;
            newNode.height = 50;
            newNode.autoSize = false;
            editor.nodes.push(newNode);
            
            // 创建从当前节点到新节点的连线（包含共同条件）
            const newConnection = new ConnectionModel(node.id, newNode.id);
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
    editor.connections.forEach((connection) => {
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
    duplicateConnections.forEach((connId) => {
        const connectionIndex = editor.connections.findIndex(c => c.id === connId);
        if (connectionIndex !== -1) {
            editor.connections.splice(connectionIndex, 1);
            
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

// 集中排列功能
export async function concentrateArrange(editor) {
    // 实现互斥逻辑：如果实时排列正在运行，则先停止它
    let wasRealTimeActive = false;
    if (editor.isRealTimeArrangeActive) {
        wasRealTimeActive = true;
        editor.stopForceLayout();
        
        // 如果编辑器有showNotification方法，则显示通知
        if (editor.showNotification) {
            editor.showNotification('已停止实时排列，开始集中排列');
        }
    }
    
    // 保存历史状态
    const stateBefore = {
        nodes: editor.nodes.map(n => deepClone(n)),
        connections: editor.connections.map(c => deepClone(c))
    };
    
    if (editor.nodes.length === 0) {
        await AlertDialog('画布中没有节点需要排列');
        return;
    }
    
    // 1. 分组节点：孤立节点和连通组
    const { isolatedNodes, connectedGroups } = groupNodesByConnectivity(editor.nodes, editor.connections);
    
    // 2. 计算每个组的包围盒
    const groupBoundingBoxes = [];
    
    // 计算连通组的包围盒
    connectedGroups.forEach((group) => {
        const box = calculateBoundingBox(group);
        groupBoundingBoxes.push({
            nodes: group,
            box
        });
    });
    
    // 3. 排列孤立节点（矩阵排列）
    const baseX = 200; // 基础X坐标
    const baseY = 150; // 基础Y坐标
    const groupSpacing = 150; // 组间间距，增加到150确保足够空间
    
    // 计算孤立节点组的占用空间
    let isolatedGroupHeight = 0;
    if (isolatedNodes.length > 0) {
        arrangeIsolatedNodes(isolatedNodes, baseX, baseY);
        
        // 计算排列后孤立节点组的实际高度
        const isolatedBox = calculateBoundingBox(isolatedNodes);
        isolatedGroupHeight = isolatedBox.height;
    }
    
    // 4. 排列连通组（纵向排列，考虑每个组的实际高度）
    let currentY = baseY + isolatedGroupHeight + groupSpacing; // 从孤立节点组下方开始，留出足够间距
    
    // 按组的高度从大到小排序，先排列大组，使布局更稳定
    groupBoundingBoxes.sort((a, b) => b.box.height - a.box.height);
    
    groupBoundingBoxes.forEach(({ nodes, box }) => {
        // 计算组的移动偏移量
        // 使用原始边界计算移动，而不是带padding的边界
        const originalWidth = box.originalRight - box.originalLeft;
        const originalHeight = box.originalBottom - box.originalTop;
        
        // 新的组左上角位置
        const targetLeft = baseX - (originalWidth / 2); // 居中对齐
        
        // 计算组的移动向量
        const translateX = targetLeft - box.originalLeft;
        const translateY = currentY - box.originalTop;
        
        // 移动组内所有节点（保持相对位置）
        nodes.forEach(node => {
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            
            nodePos.x += translateX;
            nodePos.y += translateY;
            
            // 确保transform对象存在并更新位置
            if (!node.transform) {
                node.transform = { position: { x: nodePos.x, y: nodePos.y } };
            } else {
                node.transform.position = nodePos;
            }
        });
        
        // 更新下一组的起始Y坐标，基于当前组的实际高度加上组间距
        currentY += originalHeight + groupSpacing;
    });
    
    // 保存历史状态
    const stateAfter = {
        nodes: editor.nodes.map(n => deepClone(n)),
        connections: editor.connections.map(c => deepClone(c))
    };
    
    editor.historyManager.addHistory('concentrate-arrange', {
        before: stateBefore,
        after: stateAfter
    });
    
    editor.scheduleRender();
    
    // 集中排列完成后自动重置视图，让所有节点居中显示
    if (editor.resetView && typeof editor.resetView === 'function') {
        editor.resetView();
    }
}

// 根据连通性分组节点
function groupNodesByConnectivity(nodes, connections) {
    const isolatedNodes = [];
    const connectedGroups = [];
    const visited = new Set();
    
    // 构建节点连接图
    const nodeGraph = new Map();
    nodes.forEach(node => {
        nodeGraph.set(node.id, new Set());
    });
    
    // 添加连接关系
    connections.forEach(conn => {
        // 确保连接对象有必要的属性
        if (!conn || typeof conn !== 'object') {
            console.warn('发现无效的连接对象:', conn);
            return;
        }
        
        // 确保源节点和目标节点ID存在
        const sourceId = conn.sourceNodeId || conn.source;
        const targetId = conn.targetNodeId || conn.target;
        
        if (!sourceId || !targetId) {
            console.warn('连接缺少源节点或目标节点ID:', conn);
            return;
        }
        
        // 确保源节点和目标节点都存在于nodeGraph中
        if (nodeGraph.has(sourceId) && nodeGraph.has(targetId)) {
            nodeGraph.get(sourceId).add(targetId);
            nodeGraph.get(targetId).add(sourceId);
        } else {
            console.warn('连接引用了不存在的节点:', {
                sourceId: sourceId,
                targetId: targetId,
                sourceExists: nodeGraph.has(sourceId),
                targetExists: nodeGraph.has(targetId),
                connection: conn
            });
        }
    });
    
    // 检查节点是否有连接
    function hasConnections(nodeId) {
        return nodeGraph.get(nodeId).size > 0;
    }
    
    // DFS查找连通组件
    function findConnectedComponent(startNodeId) {
        const component = [];
        const stack = [startNodeId];
        visited.add(startNodeId);
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            const currentNode = nodes.find(n => n.id === currentId);
            if (currentNode) {
                component.push(currentNode);
            }
            
            // 访问所有未访问的邻居
            for (const neighborId of nodeGraph.get(currentId)) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    stack.push(neighborId);
                }
            }
        }
        
        return component;
    }
    
    // 分组节点
    nodes.forEach(node => {
        if (!visited.has(node.id)) {
            if (hasConnections(node.id)) {
                // 有连接的节点，查找连通组件
                const component = findConnectedComponent(node.id);
                connectedGroups.push(component);
            } else {
                // 孤立节点
                isolatedNodes.push(node);
                visited.add(node.id);
            }
        }
    });
    
    return { isolatedNodes, connectedGroups };
}

// 计算节点组的包围盒
function calculateBoundingBox(nodes) {
    if (nodes.length === 0) {
        return { left: 0, top: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    nodes.forEach(node => {
        // 确保节点有默认的宽高值，防止计算错误
        const nodeWidth = node.width || 150;
        const nodeHeight = node.height || 80;
        
        // 获取节点位置
        const nodePos = (node.transform && node.transform.position) ? 
            node.transform.position : { x: 0, y: 0 };
        
        // 计算节点的实际边界
        const nodeLeft = nodePos.x - nodeWidth / 2;
        const nodeTop = nodePos.y - nodeHeight / 2;
        const nodeRight = nodePos.x + nodeWidth / 2;
        const nodeBottom = nodePos.y + nodeHeight / 2;
        
        // 更新包围盒边界
        minX = Math.min(minX, nodeLeft);
        minY = Math.min(minY, nodeTop);
        maxX = Math.max(maxX, nodeRight);
        maxY = Math.max(maxY, nodeBottom);
    });
    
    // 添加额外的边距，确保组与组之间有足够的安全距离
    const padding = 20;
    return {
        left: minX - padding,
        top: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2),
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        // 添加原始边界信息，用于精确移动
        originalLeft: minX,
        originalTop: minY,
        originalRight: maxX,
        originalBottom: maxY
    };
}

// 查找与给定节点相连的所有节点（连通组件）
export function findConnectedNodes(startNode, allNodes, allConnections) {
    const visited = new Set();
    const connectedNodes = [];
    
    // 构建节点连接图
    const nodeGraph = new Map();
    allNodes.forEach(node => {
        nodeGraph.set(node.id, new Set());
    });
    
    // 添加连接关系（双向）
    allConnections.forEach(conn => {
        if (nodeGraph.has(conn.sourceNodeId)) {
            nodeGraph.get(conn.sourceNodeId).add(conn.targetNodeId);
        }
        if (nodeGraph.has(conn.targetNodeId)) {
            nodeGraph.get(conn.targetNodeId).add(conn.sourceNodeId);
        }
    });
    
    // DFS查找连通组件
    function dfs(nodeId) {
        if (visited.has(nodeId)) return;
        
        visited.add(nodeId);
        const node = allNodes.find(n => n.id === nodeId);
        if (node) {
            connectedNodes.push(node);
        }
        
        // 访问所有未访问的邻居
        const neighbors = nodeGraph.get(nodeId) || new Set();
        for (const neighborId of neighbors) {
            dfs(neighborId);
        }
    }
    
    // 从起始节点开始DFS
    dfs(startNode.id);
    
    return connectedNodes;
}

// 矩阵排列孤立节点
function arrangeIsolatedNodes(nodes, startX, startY) {
    if (nodes.length === 0) return;
    
    // 获取节点的平均尺寸或使用默认值
    const defaultNodeWidth = 180; // 增加默认宽度以确保有足够空间
    const defaultNodeHeight = 100; // 增加默认高度
    
    // 根据节点数量计算合适的矩阵布局
    // 对于少量节点采用更紧凑的布局，避免浪费空间
    let nodesPerRow;
    if (nodes.length <= 4) {
        // 4个或更少节点时使用2x2矩阵
        nodesPerRow = 2;
    } else if (nodes.length <= 9) {
        // 5-9个节点时使用3x3矩阵
        nodesPerRow = 3;
    } else if (nodes.length <= 16) {
        // 10-16个节点时使用4x4矩阵
        nodesPerRow = 4;
    } else {
        // 更多节点时使用5列矩阵
        nodesPerRow = 5;
    }
    
    // 增加节点间距，确保节点之间有足够的空间
    const horizontalSpacing = defaultNodeWidth * 1.2; // 横向间距为节点宽度的1.2倍
    const verticalSpacing = defaultNodeHeight * 1.5; // 纵向间距为节点高度的1.5倍
    
    // 计算总列数和行数
    const totalRows = Math.ceil(nodes.length / nodesPerRow);
    
    nodes.forEach((node, index) => {
        const row = Math.floor(index / nodesPerRow);
        const col = index % nodesPerRow;
        
        // 计算新位置
        let newX, newY;
        
        // 居中排列：如果最后一行节点不足，居中显示
        if (row === totalRows - 1) {
            const lastRowNodes = nodes.length % nodesPerRow || nodesPerRow;
            const offset = (nodesPerRow - lastRowNodes) / 2 * horizontalSpacing;
            newX = startX + col * horizontalSpacing + offset;
        } else {
            newX = startX + col * horizontalSpacing;
        }
        
        newY = startY + row * verticalSpacing;
        
        // 更新transform.position，如果不存在则创建
        if (!node.transform) {
            node.transform = {};
        }
        if (!node.transform.position) {
            node.transform.position = { x: 0, y: 0 };
        }
        
        node.transform.position.x = newX;
        node.transform.position.y = newY;
    });
}

