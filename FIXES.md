# 修复记录

## 问题1：ReferenceError: NodeModel is not defined

### 问题描述
从UI界面拖拽创建节点时出现 `ReferenceError: NodeModel is not defined` 错误。

### 原因分析
在 `editor.js` 中使用 `NodeModel` 类，但没有正确导入该模块。

### 修复方案
在 `editor.js` 文件顶部添加 `NodeModel` 的导入语句：

```javascript
import NodeModel from '../models/NodeModel.js';
```

### 修复位置
- 文件：`src/core/editor.js`
- 行数：第7行（在 ConnectionModel 导入后）

## 问题2：TypeError: this.createdAt.toISOString is not a function

### 问题描述
从UI界面拖拽创建文字时出现 `TypeError: this.createdAt.toISOString is not a function` 错误。

### 原因分析
在 `ObjectBase` 构造函数中，`createdAt` 和 `updatedAt` 被设置为 `Date.now()`（返回时间戳数字），但在 `toJSON()` 方法中尝试调用 `.toISOString()` 方法，这是 `Date` 对象的方法，数字类型没有这个方法。

### 修复方案
修改 `ObjectBase` 构造函数，将时间戳改为 `Date` 对象：

```javascript
// 修复前
this.createdAt = Date.now();
this.updatedAt = Date.now();

// 修复后
this.createdAt = new Date();
this.updatedAt = new Date();
```

### 修复位置
- 文件：`src/models/ObjectBase.js`
- 行数：第61-62行

## 问题3：TextContent 构造函数参数错误

### 问题描述
拖拽创建文字时，`TextContent` 构造函数接收了错误的参数格式，导致对象创建失败。

### 原因分析
`TextContent` 构造函数期望接收一个 `options` 对象，但代码中传递了包含 `x` 和 `y` 属性的对象，这些属性不被 `TextContent` 构造函数识别。

### 修复方案
修正 `TextContent` 创建时的参数格式，并使用 `setPosition()` 方法设置位置：

```javascript
// 修复前
const newText = new TextContent({
    text: '新文字',
    x: worldPos.x,
    y: worldPos.y,
    width: 200,
    height: 50,
    fontSize: 14,
    fontColor: '#000000',
    autoSize: true
});

// 修复后
const newText = new TextContent({
    text: '新文字',
    fontSize: 14,
    fontColor: '#000000',
    autoSize: true,
    width: 200,
    height: 50
});
// 设置位置
newText.setPosition(worldPos.x, worldPos.y);
```

### 修复位置
- 文件：`src/core/editor.js`
- 行数：第1442-1453行

## 问题4：集中排列功能中的节点连接错误

### 问题描述
点击"集中排列"按钮时出现 `TypeError: Cannot read properties of undefined (reading 'add')` 错误。

### 错误原因
在 `groupNodesByConnectivity` 函数中，构建节点连接图时，某些连接可能指向不在当前节点列表中的节点ID，导致 `nodeGraph.get(conn.sourceNodeId)` 返回 `undefined`，进而调用 `.add()` 方法时出错。

### 修复方案
在遍历连接关系时，添加安全检查，确保源节点和目标节点都存在于 `nodeGraph` 中后再添加连接关系。

### 修复位置
- **文件**: `src/utils/automation.js`
- **行数**: 第482-488行
- **修改**: 添加 `if (nodeGraph.has(conn.sourceNodeId) && nodeGraph.has(conn.targetNodeId))` 检查

### 验证结果
- ✅ 集中排列功能不再报错
- ✅ 节点分组和排列功能正常工作
- ✅ 服务器运行正常

### 测试方法
1. 创建多个节点，包括有连接和无连接的节点
2. 点击"集中排列"按钮
3. 验证节点按连通性正确分组和排列
4. 检查控制台无错误信息

---

## 问题6：selectedElements中连接对象格式不一致导致clone错误

### 问题描述
删除选中连接时出现 `TypeError: c.clone is not a function` 错误，发生在 `connectionsToDelete.map(c => c.clone())` 调用时。

### 错误原因
`selectedElements` 数组中连接对象的格式不一致：
- 在 `selectAll()` 方法中，连接对象被包装为 `{id, type, data}` 格式
- 在其他地方（如点击选择、框选），连接对象直接是 `ConnectionModel` 实例
- 这导致 `deleteSelectedConnections` 方法中调用 `c.clone()` 时，包装对象没有 `clone` 方法

### 修复方案
统一 `selectedElements` 中对象的格式，确保所有地方都直接添加模型实例而不是包装对象。

### 修复位置
`src/core/editor.js` 第1751-1767行：
```javascript
if (this.selectionFilter === 'all' || this.selectionFilter === 'nodes') {
    // 添加所有节点（直接添加NodeModel实例，保持与其他地方一致）
    this.nodes.forEach(node => {
        this.selectedElements.push(node);
    });
}

if (this.selectionFilter === 'all' || this.selectionFilter === 'connections') {
    // 添加所有连线（直接添加ConnectionModel实例，保持与其他地方一致）
    this.connections.forEach(connection => {
        this.selectedElements.push(connection);
    });
}
```

### 验证结果
- ✅ 删除选中连接功能正常，不再报错
- ✅ 全选功能正常工作
- ✅ 连接对象的clone方法调用成功

### 测试方法
1. 创建多个节点并建立连接
2. 使用Ctrl+A全选所有对象
3. 点击删除连接按钮
4. 验证连接被正确删除，无错误提示

---

## 问题7：groupNodesByConnectivity函数undefined.add错误

### 问题描述
```
TypeError: Cannot read properties of undefined (reading 'add')
    at http://localhost:8000/src/utils/automation.js:484:41
    at Array.forEach (<anonymous>)
    at groupNodesByConnectivity (http://localhost:8000/src/utils/automation.js:483:17)
    at concentrateArrange (http://localhost:8000/src/utils/automation.js:393:48)
```

### 错误原因
- `groupNodesByConnectivity` 函数在处理连接关系时，没有验证连接对象的有效性
- 某些连接对象可能缺少 `sourceNodeId` 或 `targetNodeId` 属性
- 连接可能引用了不存在的节点ID，导致 `nodeGraph.get()` 返回 `undefined`

### 修复方案
1. 添加连接对象有效性检查
2. 支持多种连接属性名称格式（`sourceNodeId`/`source`，`targetNodeId`/`target`）
3. 添加详细的警告日志，便于调试
4. 确保只有有效的连接才会被添加到节点图中

### 修复代码
```javascript
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
```

### 修复位置
- 文件：`src/utils/automation.js`
- 函数：`groupNodesByConnectivity`
- 行数：第482-506行

### 验证结果
- ✅ 集中排列功能正常工作
- ✅ 不再出现undefined.add错误
- ✅ 无效连接会被安全跳过
- ✅ 控制台输出详细的调试信息

### 测试方法
1. 创建多个节点和连接
2. 点击"集中排列"按钮
3. 验证排列功能正常执行
4. 检查控制台无错误信息

---

## 验证结果

1. **NodeModel 导入问题**：✅ 已解决
   - 成功导入 NodeModel 类
   - 拖拽创建节点功能恢复正常

2. **时间戳序列化问题**：✅ 已解决
   - createdAt 和 updatedAt 现在是正确的 Date 对象
   - toJSON() 方法可以正常调用 toISOString()
   - 拖拽创建文字功能恢复正常

3. **TextContent 构造参数问题**：✅ 已解决
   - 修正了构造函数参数格式
   - 使用正确的方法设置对象位置
   - 文字对象创建和克隆功能正常

4. **集中排列连接错误**：✅ 已解决
   - 添加了节点存在性检查
   - 集中排列功能正常工作

5. **右键新建节点位置错误**：✅ 已解决
   - 修复右键菜单调用逻辑
   - 坐标转换算法工作正常
   - 新建节点位置与鼠标指针位置一致

6. **selectedElements格式不一致错误**：✅ 已解决
   - 统一对象格式，clone方法调用成功
   - 删除选中连接功能正常

7. **groupNodesByConnectivity函数undefined.add错误**：✅ 已解决
   - 添加连接对象验证和兼容性处理
   - 防止undefined节点导致的add方法调用错误

## 测试方法

1. 访问主应用：`http://localhost:8000`
2. 尝试从工具栏拖拽创建节点
3. 尝试从工具栏拖拽创建文字
4. **集中排列测试**:
   - 创建多个节点，包括有连接和无连接的节点
   - 点击"集中排列"按钮
   - 验证节点按连通性正确分组和排列
5. 确认没有 JavaScript 错误出现
6. 验证创建的对象可以正常选择和操作

## 相关文件

- `src/core/editor.js` - 添加了 NodeModel 导入，修复了 TextContent 创建
- `src/models/ObjectBase.js` - 修复了时间戳初始化
- `src/models/NodeModel.js` - 被导入的节点模型类
- `src/models/TextContent.js` - 文字内容模型类
- `src/utils/automation.js`: 修复了集中排列功能中的节点连接错误
- `public/index.html` - 包含工具栏按钮的HTML页面

## 技术细节

- 使用 ES6 模块导入/导出语法
- Date 对象 vs 时间戳数字的区别
- JavaScript 中的原型方法和类型检查
- 构造函数参数格式和对象初始化
- 防御性编程：在处理节点连接关系时，需要验证节点存在性
- 错误堆栈追踪和调试方法