# 快捷键配置系统使用示例

## 快速开始

### 1. 基本使用（自动加载默认配置）

```javascript
import EditorController from './controllers/EditorController.js';

const editorController = new EditorController('editor-canvas');
// KeyboardHandler会自动初始化并加载默认配置
```

### 2. 创建自定义配置文件

创建 `public/config/shortcuts.custom.json`:

```json
{
  "version": "1.0",
  "description": "我的自定义快捷键配置",
  "shortcuts": {
    "edit": {
      "delete": {
        "keys": ["X"],
        "description": "删除（改为X键）",
        "command": "editor.deleteSelected"
      }
    },
    "view": {
      "zoomIn": {
        "keys": ["Ctrl+=", "Meta+="],
        "description": "放大（移除+键）",
        "command": "editor.zoomIn"
      }
    }
  }
}
```

系统会自动加载并合并自定义配置。

### 3. 在代码中动态修改快捷键

```javascript
const keyboardHandler = editorController.keyboardHandler;
const shortcutManager = keyboardHandler.getShortcutManager();
const config = shortcutManager.getConfig();

// 修改删除快捷键为X键
config.setShortcut('edit', 'delete', {
    keys: ['X'],
    command: 'editor.deleteSelected',
    description: '删除选中对象'
});

// 应用配置
shortcutManager.applyConfig(config);
```

### 4. 添加新命令和快捷键

```javascript
// 1. 注册新命令
keyboardHandler.getCommandService().registerCommand('editor.customAction', () => {
    console.log('执行自定义操作');
}, '自定义操作');

// 2. 在配置中添加快捷键
const config = shortcutManager.getConfig();
config.setShortcut('custom', 'myAction', {
    keys: ['Ctrl+K', 'Meta+K'],
    description: '自定义操作',
    command: 'editor.customAction'
});

// 3. 添加到上下文
if (!config.contexts.global) {
    config.contexts.global = { shortcuts: [] };
}
config.contexts.global.shortcuts.push('custom.myAction');

// 4. 应用配置
shortcutManager.applyConfig(config);
```

### 5. 导出和导入配置

```javascript
// 导出配置
const json = keyboardHandler.exportConfig();
console.log(json);

// 导入配置（从JSON对象）
const customConfig = {
    shortcuts: {
        edit: {
            delete: {
                keys: ['X'],
                command: 'editor.deleteSelected'
            }
        }
    }
};
keyboardHandler.loadConfigFromJSON(customConfig);
```

### 6. 显示快捷键设置面板

```javascript
import ShortcutSettingsPanel from './ui/ShortcutSettingsPanel.js';

const panel = new ShortcutSettingsPanel(keyboardHandler.getShortcutManager());
panel.show();
```

## 配置文件示例

### 完整配置示例

```json
{
  "version": "1.0",
  "description": "完整快捷键配置示例",
  "shortcuts": {
    "edit": {
      "delete": {
        "keys": ["Delete", "Backspace", "X"],
        "description": "删除选中对象",
        "command": "editor.deleteSelected"
      },
      "copy": {
        "keys": ["Ctrl+C", "Meta+C"],
        "description": "复制",
        "command": "editor.copySelected"
      }
    },
    "custom": {
      "myAction": {
        "keys": ["Ctrl+K", "Meta+K"],
        "description": "我的自定义操作",
        "command": "editor.customAction"
      }
    }
  },
  "contexts": {
    "global": {
      "description": "全局快捷键",
      "shortcuts": ["edit.delete", "edit.copy", "custom.myAction"]
    },
    "canvas": {
      "description": "画布快捷键",
      "shortcuts": ["edit.selectAll"]
    }
  }
}
```

## 快捷键格式说明

### 修饰键
- `Ctrl` - Control键（Windows/Linux）
- `Meta` - Command键（macOS，会自动转换为Ctrl）
- `Shift` - Shift键
- `Alt` - Alt键

### 主键
- 字母: `a`, `b`, `c` 等（大小写不敏感）
- 数字: `0`, `1`, `2` 等
- 功能键: `F1`, `F2`, `F3` 等
- 特殊键: `Space`, `Enter`, `Escape`, `Delete`, `Backspace`, `Tab` 等

### 组合示例
- `Ctrl+C` - Ctrl+C
- `Ctrl+Shift+Z` - Ctrl+Shift+Z
- `Alt+F4` - Alt+F4
- `Ctrl+Space` - Ctrl+空格
- `F1` - F1键

## 命令ID规范

### 命名格式
`模块.操作`

### 示例
- `editor.deleteSelected` - 编辑器删除操作
- `editor.copySelected` - 编辑器复制操作
- `view.zoomIn` - 视图放大操作
- `file.save` - 文件保存操作
- `layout.arrange` - 布局排列操作

## 上下文使用

### 设置上下文

```javascript
// 在画布上
keyboardHandler.setContext('canvas');

// 在输入框中
keyboardHandler.setContext('input');

// 全局（默认）
keyboardHandler.setContext('global');
```

### 自动上下文切换

```javascript
// 在输入框获得焦点时
inputElement.addEventListener('focus', () => {
    keyboardHandler.setContext('input');
});

// 在输入框失去焦点时
inputElement.addEventListener('blur', () => {
    keyboardHandler.setContext('canvas');
});
```

## 高级用法

### 1. 快捷键冲突检测

```javascript
const bindings = shortcutManager.getAllBindings();
const keyMap = new Map();

for (const binding of bindings) {
    if (keyMap.has(binding.key)) {
        console.warn(`快捷键冲突: ${binding.key} 被 ${binding.command} 和 ${keyMap.get(binding.key)} 使用`);
    } else {
        keyMap.set(binding.key, binding.command);
    }
}
```

### 2. 动态启用/禁用快捷键

```javascript
// 临时禁用某个快捷键
const config = shortcutManager.getConfig();
config.removeShortcut('edit', 'delete');
shortcutManager.applyConfig(config);

// 重新启用
config.setShortcut('edit', 'delete', {
    keys: ['Delete'],
    command: 'editor.deleteSelected'
});
shortcutManager.applyConfig(config);
```

### 3. 快捷键提示

```javascript
// 获取命令的快捷键
const shortcut = shortcutManager.getShortcutByCommand('editor.deleteSelected');
console.log('删除快捷键:', shortcut); // 输出: "delete" 或 "backspace"

// 获取所有快捷键
const allBindings = shortcutManager.getAllBindings();
allBindings.forEach(binding => {
    console.log(`${binding.description}: ${binding.key}`);
});
```

## 故障排除

### 快捷键不工作

1. **检查命令是否注册**
```javascript
const hasCommand = keyboardHandler.getCommandService().hasCommand('editor.deleteSelected');
console.log('命令是否存在:', hasCommand);
```

2. **检查快捷键格式**
- 确保使用正确的格式: `Ctrl+C` 而不是 `ctrl+c`（系统会自动转换）
- 检查是否有拼写错误

3. **检查上下文**
```javascript
const context = keyboardHandler.getShortcutManager().getContext();
console.log('当前上下文:', context);
```

4. **检查配置是否加载**
```javascript
const config = keyboardHandler.getShortcutManager().getConfig();
console.log('配置:', config);
```

### 配置文件加载失败

1. **检查文件路径**
   - 确保文件在 `public/config/` 目录下
   - 检查文件名是否正确

2. **检查JSON格式**
   - 使用JSON验证工具检查格式
   - 确保所有引号、括号匹配

3. **查看控制台错误**
   - 打开浏览器开发者工具
   - 查看Console标签的错误信息

## 最佳实践

1. **不要修改默认配置**
   - 所有自定义应该放在 `shortcuts.custom.json`
   - 默认配置应该保持不变

2. **使用有意义的命令ID**
   - 格式: `模块.操作`
   - 例如: `editor.deleteSelected`

3. **提供清晰的描述**
   - 帮助用户理解快捷键的作用

4. **支持多平台**
   - 同时提供 `Ctrl` 和 `Meta` 键
   - 系统会自动处理平台差异

5. **考虑用户习惯**
   - 使用常见的快捷键组合
   - 避免与系统快捷键冲突

