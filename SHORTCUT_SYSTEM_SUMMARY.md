# 快捷键配置系统总结

## ✅ 已完成的功能

### 1. 配置文件系统 ✅
- **默认配置**: `config/shortcuts.default.json` 和 `public/config/shortcuts.default.json`
- **自定义配置**: 支持 `shortcuts.custom.json` 覆盖默认配置
- **格式**: JSON格式，结构清晰，易于编辑

### 2. 核心组件 ✅

#### ShortcutConfig (`src/config/ShortcutConfig.js`)
- 配置模型类
- 支持从JSON加载和导出
- 配置验证功能
- 快捷键查询功能

#### CommandService (`src/services/CommandService.js`)
- 统一命令注册和执行
- 命令历史记录
- 命令查询和管理

#### ShortcutManager (`src/services/ShortcutManager.js`)
- 加载默认和自定义配置
- 合并配置（自定义覆盖默认）
- 快捷键映射和解析
- 上下文管理（global/canvas/input）
- 键盘事件处理

#### KeyboardHandler (`src/interactions/KeyboardHandler.js`)
- 重构为使用新的快捷键系统
- 注册所有编辑器命令
- 处理键盘事件并执行命令

### 3. 配置UI ✅
- **ShortcutSettingsPanel** (`src/ui/ShortcutSettingsPanel.js`)
- 查看所有快捷键
- 编辑快捷键
- 导入/导出配置
- 重置为默认

## 配置文件结构

```json
{
  "version": "1.0",
  "description": "配置描述",
  "shortcuts": {
    "category": {
      "name": {
        "keys": ["Ctrl+C"],
        "description": "命令描述",
        "command": "command.id"
      }
    }
  },
  "contexts": {
    "contextName": {
      "description": "上下文描述",
      "shortcuts": ["category.name"]
    }
  }
}
```

## 使用方式

### 1. 基本使用（自动加载）

```javascript
import KeyboardHandler from './interactions/KeyboardHandler.js';

const keyboardHandler = new KeyboardHandler(editorController);
// 自动加载默认配置并注册所有命令
```

### 2. 加载自定义配置

```javascript
// 从文件加载
await keyboardHandler.loadCustomConfig('./config/shortcuts.custom.json');

// 从JSON对象加载
keyboardHandler.loadConfigFromJSON({
  shortcuts: {
    edit: {
      delete: {
        keys: ["X"],
        command: "editor.deleteSelected"
      }
    }
  }
});
```

### 3. 导出配置

```javascript
const json = keyboardHandler.exportConfig();
// 保存到文件或显示给用户
```

### 4. 显示设置面板

```javascript
import ShortcutSettingsPanel from './ui/ShortcutSettingsPanel.js';

const panel = new ShortcutSettingsPanel(keyboardHandler.getShortcutManager());
panel.show();
```

## 快捷键格式

### 支持的格式
- `Ctrl+C` - Windows/Linux
- `Meta+C` - macOS（自动转换为Ctrl）
- `Ctrl+Shift+Z` - 多个修饰键
- `Delete`, `Backspace` - 特殊键
- `f`, `F` - 字母键（大小写不敏感）

### 多键绑定
一个命令可以绑定多个快捷键：
```json
{
  "keys": ["Delete", "Backspace"],
  "command": "editor.deleteSelected"
}
```

## 命令系统

### 命令ID格式
`模块.操作`
- `editor.deleteSelected` - 编辑器删除操作
- `view.zoomIn` - 视图放大操作
- `file.save` - 文件保存操作

### 注册新命令

```javascript
// 在KeyboardHandler中
this.commandService.registerCommand('editor.newCommand', () => {
    // 执行操作
}, '命令描述');
```

## 上下文系统

### 支持的上下文
- **global**: 全局快捷键（任何情况下都可用）
- **canvas**: 画布上的快捷键
- **input**: 输入框中的快捷键（禁用大部分快捷键）

### 设置上下文

```javascript
keyboardHandler.setContext('canvas');
```

## 配置优先级

1. **自定义配置** > **默认配置**
2. 自定义配置中的快捷键会覆盖默认配置
3. 如果自定义配置不存在，使用内置默认配置（fallback）

## 优势

1. **易于配置**: JSON格式，结构清晰
2. **灵活扩展**: 轻松添加新命令和快捷键
3. **多平台支持**: 自动处理Windows/Linux/macOS差异
4. **上下文感知**: 根据当前上下文启用/禁用快捷键
5. **用户友好**: 提供UI界面查看和编辑快捷键
6. **向后兼容**: 内置默认配置，即使文件加载失败也能工作

## 文件结构

```
config/
  shortcuts.default.json          # 默认配置文件
  shortcuts.custom.json           # 自定义配置文件（可选）

src/
  config/
    ShortcutConfig.js             # 配置模型
  services/
    CommandService.js             # 命令服务
    ShortcutManager.js            # 快捷键管理器
  interactions/
    KeyboardHandler.js            # 键盘事件处理器（重构）
  ui/
    ShortcutSettingsPanel.js      # 快捷键设置面板
```

## 下一步

1. 完善命令实现（部分命令还是TODO）
2. 添加快捷键冲突检测
3. 添加快捷键提示UI
4. 支持快捷键组合录制
5. 添加快捷键导入/导出功能到UI

