# 快捷键配置系统使用指南

## 架构设计

### 核心组件

1. **ShortcutConfig** (`src/config/ShortcutConfig.js`)
   - 快捷键配置模型
   - 负责配置的加载、解析、验证

2. **CommandService** (`src/services/CommandService.js`)
   - 命令服务
   - 统一管理所有命令的注册和执行

3. **ShortcutManager** (`src/services/ShortcutManager.js`)
   - 快捷键管理器
   - 加载配置、解析快捷键、处理键盘事件

4. **KeyboardHandler** (`src/interactions/KeyboardHandler.js`)
   - 键盘事件处理器
   - 使用ShortcutManager处理键盘事件

## 配置文件格式

### 默认配置文件: `config/shortcuts.default.json`

```json
{
  "version": "1.0",
  "description": "默认快捷键配置",
  "shortcuts": {
    "category": {
      "name": {
        "keys": ["Ctrl+C", "Meta+C"],
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

### 自定义配置文件: `config/shortcuts.custom.json`

格式与默认配置相同，会覆盖默认配置中的相同项。

## 快捷键格式

### 支持的按键格式

- **修饰键**: `Ctrl`, `Shift`, `Alt`, `Meta` (macOS)
- **主键**: 字母、数字、功能键（F1-F12）、特殊键（Space, Enter, Escape等）
- **组合**: `Ctrl+C`, `Ctrl+Shift+Z`, `Alt+F4` 等

### 示例

```json
{
  "keys": ["Ctrl+C", "Meta+C"],  // Windows/Linux 和 macOS 都支持
  "keys": ["Delete", "Backspace"],  // 多个键绑定同一命令
  "keys": ["f", "F"],  // 大小写不敏感
  "keys": ["Ctrl+Shift+R"]  // 多个修饰键
}
```

## 命令系统

### 注册命令

```javascript
commandService.registerCommand('editor.deleteSelected', () => {
    // 执行删除操作
}, '删除选中对象');
```

### 执行命令

```javascript
commandService.execute('editor.deleteSelected');
```

## 上下文系统

### 支持的上下文

- **global**: 全局快捷键（任何情况下都可用）
- **canvas**: 画布上的快捷键
- **input**: 输入框中的快捷键（禁用大部分快捷键）

### 设置上下文

```javascript
shortcutManager.setContext('canvas');
```

## 使用示例

### 1. 基本使用

```javascript
import KeyboardHandler from './interactions/KeyboardHandler.js';

const keyboardHandler = new KeyboardHandler(editorController);
// 自动加载默认配置并注册所有命令
```

### 2. 加载自定义配置

```javascript
// 从文件加载
await keyboardHandler.loadCustomConfig('/config/shortcuts.custom.json');

// 从JSON对象加载
keyboardHandler.loadConfigFromJSON({
  shortcuts: {
    edit: {
      delete: {
        keys: ["Delete"],
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

### 4. 动态修改快捷键

```javascript
const config = shortcutManager.getConfig();
config.setShortcut('edit', 'delete', {
  keys: ['X'],
  command: 'editor.deleteSelected',
  description: '删除'
});
shortcutManager.applyConfig(config);
```

## 配置优先级

1. **自定义配置** > **默认配置**
2. 如果自定义配置中定义了相同的快捷键，会覆盖默认配置
3. 如果自定义配置中定义了新的快捷键，会添加到配置中

## 最佳实践

1. **不要修改默认配置**
   - 默认配置应该保持不变
   - 所有自定义应该放在 `shortcuts.custom.json`

2. **使用有意义的命令ID**
   - 格式: `模块.操作`
   - 例如: `editor.deleteSelected`, `view.zoomIn`

3. **提供清晰的描述**
   - 帮助用户理解快捷键的作用

4. **支持多平台**
   - Windows/Linux 使用 `Ctrl`
   - macOS 使用 `Meta`（会自动转换为Ctrl）

5. **考虑上下文**
   - 在输入框中禁用大部分快捷键
   - 在画布上启用所有快捷键

## 扩展命令

### 添加新命令

```javascript
// 在KeyboardHandler中注册
this.commandService.registerCommand('editor.newCommand', () => {
    // 执行操作
}, '命令描述');

// 在配置文件中添加
{
  "shortcuts": {
    "category": {
      "newCommand": {
        "keys": ["Ctrl+N"],
        "description": "新命令",
        "command": "editor.newCommand"
      }
    }
  }
}
```

## 故障排除

### 快捷键不工作

1. 检查命令是否已注册
2. 检查快捷键格式是否正确
3. 检查当前上下文是否允许此快捷键
4. 检查是否有其他快捷键冲突

### 配置加载失败

1. 检查JSON格式是否正确
2. 检查文件路径是否正确
3. 检查浏览器控制台错误信息

