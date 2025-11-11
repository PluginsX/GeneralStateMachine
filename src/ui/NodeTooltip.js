// 节点提示框 - 继承自InternalWindowBase
import InternalWindowBase from './InternalWindowBase.js';

export default class NodeTooltip extends InternalWindowBase {
    constructor() {
        super({
            title: '',
            width: 300,
            height: 'auto',
            modal: false,
            closable: false,
            draggable: false,
            zIndex: 1000
        });
        
        this.currentNode = null;
        this.isPositioned = false;
    }
    
    // 覆盖createContent以自定义内容
    createContent() {
        super.createContent();
        this.content.style.padding = '12px';
        this.content.style.pointerEvents = 'none';
    }
    
    // 显示节点提示
    show(node, x, y, options = {}) {
        if (!node) return;
        
        // 如果是同一个节点且已经显示，则不重复显示
        if (this.isVisible && this.currentNode === node) {
            return;
        }
        
        this.currentNode = node;
        
        // 构建内容
        const content = this.buildTooltipContent(node);
        this.setContent(content);
        
        // 显示窗口
        super.show();
        
        // 定位（不使用居中，而是使用指定坐标）
        this.positionAt(x, y, options);
    }
    
    // 在指定位置显示
    positionAt(x, y, options = {}) {
        if (!this.container) return;
        
        const offsetX = options.offsetX || 10;
        const offsetY = options.offsetY || 10;
        
        // 设置绝对定位
        this.container.style.position = 'absolute';
        this.container.style.margin = '0';
        this.container.style.left = `${x + offsetX}px`;
        this.container.style.top = `${y + offsetY}px`;
        
        // 等待DOM更新后计算位置
        setTimeout(() => {
            this.adjustPosition(x, y, offsetX, offsetY);
        }, 0);
    }
    
    // 调整位置避免超出视口
    adjustPosition(x, y, offsetX, offsetY) {
        if (!this.container) return;
        
        const rect = this.container.getBoundingClientRect();
        let left = x + offsetX;
        let top = y + offsetY;
        
        // 调整位置避免超出视口右侧
        if (left + rect.width > window.innerWidth) {
            left = x - rect.width - offsetX;
        }
        
        // 调整位置避免超出视口底部
        if (top + rect.height > window.innerHeight) {
            top = y - rect.height - offsetY;
        }
        
        // 确保不超出左侧和顶部
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        this.container.style.left = `${left}px`;
        this.container.style.top = `${top}px`;
    }
    
    // 构建提示框内容
    buildTooltipContent(node) {
        if (!node) return '';
        
        let content = `<div class="tooltip-title" style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${node.name || '未命名节点'}</div>`;
        
        // 如果有描述，显示描述
        if (node.description && node.description.trim()) {
            content += `<div class="tooltip-description" style="margin-bottom: 8px; color: ${this.getThemeColor('textSecondary', '#999')};">${node.description}</div>`;
        }
        
        // 显示位置信息
        content += `<div class="tooltip-position" style="margin-bottom: 8px; font-size: 12px; color: ${this.getThemeColor('textSecondary', '#999')};">位置: X: ${Math.round(node.x)}, Y: ${Math.round(node.y)}</div>`;
        
        // 显示条件信息（如果有）
        if (node.conditions && node.conditions.length > 0) {
            content += `<div class="tooltip-section-title" style="font-weight: bold; margin-top: 12px; margin-bottom: 4px;">条件:</div>`;
            node.conditions.forEach(condition => {
                if (condition && condition.text) {
                    content += `<div class="tooltip-condition" style="margin-left: 12px; margin-bottom: 4px; font-size: 12px;">- ${condition.text}</div>`;
                }
            });
        }
        
        // 显示输出信息（如果有输出节点）
        if (node.isOutput) {
            content += `<div class="tooltip-type" style="margin-top: 8px; font-size: 12px; color: ${this.getThemeColor('textSecondary', '#999')};">类型: 输出节点</div>`;
        }
        
        // 显示ID信息（可选）
        if (node.id) {
            content += `<div class="tooltip-id" style="margin-top: 8px; font-size: 11px; color: ${this.getThemeColor('textSecondary', '#666')};">ID: ${node.id}</div>`;
        }
        
        return content;
    }
    
    // 更新内容
    updateContent(node) {
        if (!this.isVisible || this.currentNode !== node) {
            return;
        }
        
        const content = this.buildTooltipContent(node);
        this.setContent(content);
        
        // 重新调整位置
        const rect = this.container.getBoundingClientRect();
        this.adjustPosition(rect.left, rect.top, 0, 0);
    }
    
    // 隐藏提示框
    hide() {
        super.hide();
        this.currentNode = null;
    }
    
    // 检查鼠标是否在提示框上
    isMouseOver(event) {
        if (!this.container || !this.isVisible) {
            return false;
        }
        
        const rect = this.container.getBoundingClientRect();
        return event.clientX >= rect.left && 
               event.clientX <= rect.right && 
               event.clientY >= rect.top && 
               event.clientY <= rect.bottom;
    }
}

