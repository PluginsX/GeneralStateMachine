import NodeGraphEditor from './core/editor.js';

// 禁用默认右键菜单
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', e => e.preventDefault());
    
    // 初始化编辑器
    const editor = new NodeGraphEditor('editor-canvas');
});