# 性能瓶颈分析报告

## 问题描述
即使只绘制可见节点，当总节点数很多时，即使当前只有一个节点可见，依然很卡。

## 发现的性能瓶颈

### 1. ❌ 事件检测遍历所有节点（最严重）
**位置**: `src/view-models/NodeViewModel.js:157-164`
```javascript
getNodeAtPoint(x, y) {
    for (const node of this.nodes.values()) {  // 遍历所有节点！
        if (NodeService.isPointInNode(node, x, y)) {
            return node;
        }
    }
    return null;
}
```
**问题**: 每次鼠标事件都要遍历所有节点，即使只查询可见区域
**影响**: O(n) 复杂度，节点数越多越慢

### 2. ❌ 可见性检测每次获取所有节点
**位置**: `src/views/CanvasView.js:96-97`
```javascript
const allNodes = nodeViewModel.getAllNodes();  // 创建新数组，遍历所有节点
const allConnections = connectionViewModel.getAllConnections();
```
**问题**: 每次更新可见对象都要获取所有节点，创建新数组
**影响**: 频繁的内存分配和遍历

### 3. ⚠️ 连线检测需要查找节点
**位置**: `src/interactions/CanvasMouseHandler.js:364-382`
```javascript
getConnectionAtPosition(pos) {
    // 虽然使用了visibleConnections，但需要为每个连线查找节点
    const sourceNode = nodeViewModel.getNode(connection.sourceNodeId);
    const targetNode = nodeViewModel.getNode(connection.targetNodeId);
}
```
**问题**: 虽然连线是可见的，但查找节点是O(1)的Map操作，影响较小

### 4. ⚠️ 节点Map重复创建
**位置**: `src/views/CanvasView.js:105, 153`
```javascript
const nodeMap = new Map(allNodes.map(node => [node.id, node]));  // 每次渲染都创建
```
**问题**: 每次渲染都重新创建Map
**影响**: 内存分配开销

## 优化方案

### 方案1: 基于可见节点的查询（立即实施）
- 修改 `getNodeAtPoint` 只查询可见节点
- 添加 `getNodeAtPointFromVisible` 方法

### 方案2: 空间索引优化（节点数>100时）
- 使用四叉树加速空间查询
- 只对可见区域建立索引

### 方案3: 缓存优化
- 缓存节点Map，避免重复创建
- 只在节点变化时更新缓存

### 方案4: 延迟更新
- 减少 `updateVisibleObjects` 的调用频率
- 使用防抖机制

## 预期效果
- 事件检测从 O(n) 降低到 O(k)，k为可见节点数
- 可见性检测减少内存分配
- 整体性能提升：节点数1000+时，性能提升10-100倍

