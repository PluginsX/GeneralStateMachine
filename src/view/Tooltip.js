// 节点提示框渲染 - 视图层
// 负责显示节点的详细信息提示框
export default class Tooltip {
    constructor() {
        // 创建提示框元素
        this.tooltip = null;
        this.isVisible = false;
        this.lastNode = null;
        this.init();
    }
    
    // 初始化提示框
    init() {
        // 创建提示框DOM元素
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'node-tooltip';
        this.tooltip.style.position = 'absolute';
        this.tooltip.style.zIndex = '1000';
        this.tooltip.style.pointerEvents = 'none';
        this.tooltip.style.visibility = 'hidden';
        this.tooltip.style.opacity = '0';
        
        // 添加到文档中
        document.body.appendChild(this.tooltip);
    }
    
    // 显示提示框
    show(node, x, y, options = {}) {
        // 如果是同一个节点且已经显示，则不重复显示
        if (this.isVisible && this.lastNode === node) {
            return;
        }
        
        // 存储当前节点引用
        this.lastNode = node;
        
        // 构建提示框内容
        const content = this.buildTooltipContent(node);
        
        // 设置提示框内容和位置
        this.tooltip.innerHTML = content;
        
        // 计算位置，避免提示框超出视口
        const rect = this.tooltip.getBoundingClientRect();
        let left = x + (options.offsetX || 10);
        let top = y + (options.offsetY || 10);
        
        // 调整位置避免超出视口右侧
        if (left + rect.width > window.innerWidth) {
            left = x - rect.width - (options.offsetX || 10);
        }
        
        // 调整位置避免超出视口底部
        if (top + rect.height > window.innerHeight) {
            top = y - rect.height - (options.offsetY || 10);
        }
        
        // 设置位置
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
        
        // 显示提示框
        this.tooltip.style.visibility = 'visible';
        this.tooltip.style.opacity = '1';
        this.tooltip.style.transition = 'opacity 0.2s ease-in-out';
        
        this.isVisible = true;
    }
    
    // 隐藏提示框
    hide() {
        if (!this.isVisible) {
            return;
        }
        
        // 隐藏提示框
        this.tooltip.style.opacity = '0';
        
        // 延迟设置visibility为hidden，以支持淡出动画
        setTimeout(() => {
            if (this.tooltip) {
                this.tooltip.style.visibility = 'hidden';
            }
        }, 200);
        
        this.isVisible = false;
        this.lastNode = null;
    }
    
    // 构建提示框内容
    buildTooltipContent(node) {
        if (!node) {
            return '';
        }
        
        let content = `<div class="tooltip-title">${node.name || '未命名节点'}</div>`;
        
        // 如果有描述，显示描述
        if (node.description && node.description.trim()) {
            content += `<div class="tooltip-description">${node.description}</div>`;
        }
        
        // 显示位置信息
        const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
        content += `<div class="tooltip-position">位置: X: ${Math.round(nodePos.x)}, Y: ${Math.round(nodePos.y)}</div>`;
        
        // 显示条件信息（如果有）
        if (node.conditions && node.conditions.length > 0) {
            content += `<div class="tooltip-section-title">条件:</div>`;
            node.conditions.forEach(condition => {
                if (condition && condition.text) {
                    content += `<div class="tooltip-condition">- ${condition.text}</div>`;
                }
            });
        }
        
        // 显示输出信息（如果有输出节点）
        if (node.isOutput) {
            content += `<div class="tooltip-type">类型: 输出节点</div>`;
        }
        
        // 显示ID信息（可选）
        if (node.id) {
            content += `<div class="tooltip-id">ID: ${node.id}</div>`;
        }
        
        return content;
    }
    
    // 更新提示框内容（当节点信息变化时）
    updateContent(node) {
        if (!this.isVisible || this.lastNode !== node) {
            return;
        }
        
        const content = this.buildTooltipContent(node);
        this.tooltip.innerHTML = content;
        
        // 重新计算位置，因为内容可能变化
        this._reposition();
    }
    
    // 重新定位提示框
    _reposition() {
        if (!this.isVisible || !this.lastNode) {
            return;
        }
        
        // 获取当前位置
        const currentLeft = parseInt(this.tooltip.style.left) || 0;
        const currentTop = parseInt(this.tooltip.style.top) || 0;
        
        // 计算新位置
        const rect = this.tooltip.getBoundingClientRect();
        let left = currentLeft;
        let top = currentTop;
        
        // 调整位置避免超出视口
        if (left < 0) left = 10;
        if (top < 0) top = 10;
        if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 10;
        if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 10;
        
        // 设置新位置
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }
    
    // 检查鼠标是否在提示框上
    isMouseOver(event) {
        if (!this.tooltip || !this.isVisible) {
            return false;
        }
        
        const rect = this.tooltip.getBoundingClientRect();
        return event.clientX >= rect.left && 
               event.clientX <= rect.right && 
               event.clientY >= rect.top && 
               event.clientY <= rect.bottom;
    }
    
    // 设置提示框样式
    setStyle(style) {
        if (!this.tooltip) {
            return;
        }
        
        Object.assign(this.tooltip.style, style);
    }
    
    // 销毁提示框
    destroy() {
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        
        this.isVisible = false;
        this.lastNode = null;
    }
}