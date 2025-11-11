# 工作区对象基类重构总结

## 重构概述

本次重构为工作区对象创建了统一的基类架构，所有可以在Canvas中放置的对象都继承自 `ObjectBase` 基类。

## 新的类结构

### 1. ObjectBase - 工作区对象基类

**位置**: `src/models/ObjectBase.js`

**职责**: 
- 提供所有工作区对象的共同属性和方法
- 统一管理对象ID、类型、颜色等基础属性
- 提供统一的克隆、序列化、验证接口

**主要属性和方法**:
- `id`: 唯一标识符
- `type`: 对象类型（'node', 'connection'等）
- `color`: 颜色（null表示使用默认颜色）
- `createdAt`: 创建时间戳
- `updatedAt`: 更新时间戳
- `clone()`: 复制对象
- `toJSON()`: 转换为JSON
- `validate()`: 验证对象有效性
- `getDisplayName()`: 获取显示名称

### 2. NodeModel - 节点模型

**位置**: `src/models/NodeModel.js`

**继承**: `ObjectBase`

**新增属性**:
- `name`: 节点名称
- `description`: 节点描述
- `x`, `y`: 位置坐标
- `width`, `height`: 尺寸
- `autoSize`: 是否自适应尺寸
- `minWidth`, `minHeight`: 最小尺寸
- `padding`: 内边距

**重写方法**:
- `clone()`: 复制节点，包含所有节点特定属性
- `toJSON()`: 序列化节点数据
- `getDisplayName()`: 返回节点名称
- `validate()`: 验证节点数据有效性

### 3. ConnectionModel - 连接模型

**位置**: `src/models/ConnectionModel.js`

**继承**: `ObjectBase`

**新增属性**:
- `sourceNodeId`, `targetNodeId`: 源节点和目标节点ID
- `fromSide`, `toSide`: 连接点位置
- `conditions`: 条件数组
- `defaultConnection`: 是否为默认连接
- `lineWidth`: 线条粗细
- `lineType`: 线条类型（'solid' 或 'dashed'）
- `arrowStyle`: 箭头样式对象（新增，支持多种箭头类型）

**箭头样式支持**:
- 使用 `ArrowStyle` 类管理箭头样式
- 支持多种箭头类型：三角形、菱形、圆形、箭头形状、无箭头
- 向后兼容：保留 `arrowSize` 和 `arrowColor` 属性，但优先使用 `arrowStyle`

**新增方法**:
- `getArrowSize()`: 获取箭头大小（兼容旧代码）
- `setArrowSize(size)`: 设置箭头大小
- `getArrowColor()`: 获取箭头颜色（兼容旧代码）
- `setArrowColor(color)`: 设置箭头颜色
- `getArrowStyle()`: 获取箭头样式对象
- `setArrowStyle(style)`: 设置箭头样式

### 4. ArrowStyle - 箭头样式类

**位置**: `src/models/ArrowStyle.js`

**职责**: 管理连接对象的箭头样式

**箭头类型** (`ArrowStyleType`):
- `TRIANGLE`: 三角形箭头（默认）
- `DIAMOND`: 菱形箭头
- `CIRCLE`: 圆形箭头
- `ARROW`: 箭头形状（带杆）
- `NONE`: 无箭头

**主要属性**:
- `type`: 箭头类型
- `size`: 箭头大小（像素）
- `color`: 箭头颜色（null表示使用连线颜色）

**主要方法**:
- `clone()`: 复制箭头样式
- `fromData(data)`: 从数据恢复箭头样式
- `toJSON()`: 转换为JSON

## 类继承关系

```
ObjectBase (基类)
├── NodeModel (节点模型)
└── ConnectionModel (连接模型)
    └── 使用 ArrowStyle (箭头样式)
```

## 向后兼容性

### ConnectionModel 兼容性

为了保持向后兼容，`ConnectionModel` 保留了旧的 `arrowSize` 和 `arrowColor` 属性：

1. **读取兼容性**: 
   - `getArrowSize()` 和 `getArrowColor()` 方法优先返回旧属性值，如果旧属性为null则返回 `arrowStyle` 的值
   
2. **写入兼容性**:
   - `setArrowSize()` 和 `setArrowColor()` 方法会同时更新旧属性和 `arrowStyle`
   - 直接设置 `arrowSize` 或 `arrowColor` 也会自动同步到 `arrowStyle`

3. **数据加载兼容性**:
   - `fromData()` 方法会检查数据中是否有 `arrowStyle`，如果没有则从 `arrowSize` 和 `arrowColor` 创建

## 使用示例

### 创建节点

```javascript
import NodeModel from './models/NodeModel.js';

const node = new NodeModel('我的节点', 100, 200);
console.log(node.getDisplayName()); // "我的节点"
console.log(node.validate()); // {valid: true, errors: []}
```

### 创建连接

```javascript
import ConnectionModel from './models/ConnectionModel.js';
import { ArrowStyleType } from './models/ArrowStyle.js';

const connection = new ConnectionModel('node1-id', 'node2-id', 'right', 'left');

// 使用新的箭头样式API
connection.setArrowStyle({
    type: ArrowStyleType.DIAMOND,
    size: 15,
    color: '#ff0000'
});

// 或使用兼容的旧API
connection.setArrowSize(12);
connection.setArrowColor('#00ff00');
```

### 验证对象

```javascript
// 验证节点
const nodeValidation = node.validate();
if (!nodeValidation.valid) {
    console.error('节点验证失败:', nodeValidation.errors);
}

// 验证连接（需要提供节点映射）
const connectionValidation = connection.validate(nodeMap);
if (!connectionValidation.valid) {
    console.error('连接验证失败:', connectionValidation.errors);
}
```

## 未来扩展

所有新的工作区对象都应该继承自 `ObjectBase`，例如：

```javascript
import ObjectBase from './models/ObjectBase.js';

export default class TextBoxModel extends ObjectBase {
    constructor(text, x, y) {
        super('textbox');
        this.text = text;
        this.x = x;
        this.y = y;
        // ... 其他属性
    }
    
    // 重写必要的方法
    getDisplayName() {
        return this.text || '未命名文本框';
    }
}
```

## 注意事项

1. **旧代码兼容**: 旧的 `Node` 和 `Connection` 类（位于 `src/core/`）仍然存在，用于旧的 `editor.js`。新的架构使用 `NodeModel` 和 `ConnectionModel`。

2. **箭头样式渲染**: 箭头样式的实际渲染逻辑需要在渲染器中实现。目前 `ConnectionModel` 只管理数据，具体的绘制逻辑需要根据 `arrowStyle.type` 在渲染器中实现不同的绘制方法。

3. **序列化**: 所有对象都支持 `toJSON()` 方法，可以安全地序列化和反序列化。

