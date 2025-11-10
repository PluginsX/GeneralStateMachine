// 性能优化工具类
// 包含可视性检测、LOD分级绘制、空间索引等功能

/**
 * 全局日志控制
 * 设置为 false 可禁用所有性能优化相关的日志输出
 * 修改此变量即可控制全局日志开关
 */
export const PERFORMANCE_LOG_ENABLED = false;

/**
 * 可视性检测器
 * 计算可视区域并判断节点/连线是否可见
 */
export class VisibilityCuller {
    constructor(canvas, pan, zoom) {
        this.canvas = canvas;
        this.pan = pan;
        this.zoom = zoom;
        this.buffer = 50; // 可视区域缓冲（像素），避免边缘闪烁
    }

    /**
     * 计算当前可视区域（世界坐标）
     * 坐标转换公式：屏幕坐标 = 世界坐标 * zoom + pan.x
     * 因此：世界坐标 = (屏幕坐标 - pan.x) / zoom
     */
    getVisibleBounds() {
        const { width, height } = this.canvas;
        // 将屏幕坐标转换为世界坐标
        const worldMinX = (0 - this.pan.x) / this.zoom;
        const worldMinY = (0 - this.pan.y) / this.zoom;
        const worldMaxX = (width - this.pan.x) / this.zoom;
        const worldMaxY = (height - this.pan.y) / this.zoom;
        
        // 添加缓冲区域（转换为世界坐标单位）
        const bufferWorld = this.buffer / this.zoom;
        
        return {
            minX: worldMinX - bufferWorld,
            minY: worldMinY - bufferWorld,
            maxX: worldMaxX + bufferWorld,
            maxY: worldMaxY + bufferWorld
        };
    }

    /**
     * 判断节点是否可见
     */
    isNodeVisible(node, visibleBounds) {
        return !(
            node.x + node.width < visibleBounds.minX ||
            node.x > visibleBounds.maxX ||
            node.y + node.height < visibleBounds.minY ||
            node.y > visibleBounds.maxY
        );
    }

    /**
     * 判断连线是否可见
     * 如果两端节点有一个可见，或连线穿过可视区域，则可见
     */
    isConnectionVisible(connection, sourceNode, targetNode, visibleBounds) {
        if (!sourceNode || !targetNode) return false;

        // 两端节点有一个可见 → 连线可见
        if (this.isNodeVisible(sourceNode, visibleBounds) || 
            this.isNodeVisible(targetNode, visibleBounds)) {
            return true;
        }

        // 连线穿过可视区域 → 可见（判断线段与矩形是否相交）
        const start = { 
            x: sourceNode.x + sourceNode.width / 2, 
            y: sourceNode.y + sourceNode.height / 2 
        };
        const end = { 
            x: targetNode.x + targetNode.width / 2, 
            y: targetNode.y + targetNode.height / 2 
        };
        return this.lineIntersectsRect(start, end, visibleBounds);
    }

    /**
     * 判断线段是否与矩形相交
     */
    lineIntersectsRect(start, end, rect) {
        // 快速排除：如果线段完全在矩形外
        if ((start.x < rect.minX && end.x < rect.minX) ||
            (start.x > rect.maxX && end.x > rect.maxX) ||
            (start.y < rect.minY && end.y < rect.minY) ||
            (start.y > rect.maxY && end.y > rect.maxY)) {
            return false;
        }

        // 如果起点或终点在矩形内，则相交
        if ((start.x >= rect.minX && start.x <= rect.maxX && 
             start.y >= rect.minY && start.y <= rect.maxY) ||
            (end.x >= rect.minX && end.x <= rect.maxX && 
             end.y >= rect.minY && end.y <= rect.maxY)) {
            return true;
        }

        // 检查线段是否与矩形边相交（简化版：检查是否穿过矩形）
        // 使用射线法：从起点到终点，检查是否与矩形边界相交
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        // 检查与左右边界的交点
        if (dx !== 0) {
            const tLeft = (rect.minX - start.x) / dx;
            const tRight = (rect.maxX - start.x) / dx;
            if (tLeft >= 0 && tLeft <= 1) {
                const y = start.y + dy * tLeft;
                if (y >= rect.minY && y <= rect.maxY) return true;
            }
            if (tRight >= 0 && tRight <= 1) {
                const y = start.y + dy * tRight;
                if (y >= rect.minY && y <= rect.maxY) return true;
            }
        }

        // 检查与上下边界的交点
        if (dy !== 0) {
            const tTop = (rect.minY - start.y) / dy;
            const tBottom = (rect.maxY - start.y) / dy;
            if (tTop >= 0 && tTop <= 1) {
                const x = start.x + dx * tTop;
                if (x >= rect.minX && x <= rect.maxX) return true;
            }
            if (tBottom >= 0 && tBottom <= 1) {
                const x = start.x + dx * tBottom;
                if (x >= rect.minX && x <= rect.maxX) return true;
            }
        }

        return false;
    }

    /**
     * 更新视图参数
     */
    updateView(pan, zoom) {
        this.pan = pan;
        this.zoom = zoom;
    }
}

/**
 * LOD（Level of Detail）管理器
 * 根据缩放比例提供不同精度的绘制方案
 */
export class LODManager {
    constructor() {
        // LOD等级定义（四级LOD阈值：1.0, 0.6, 0.4, 0.3）
        this.lodLevels = {
            LOD0: { minZoom: 1.0, name: '高精度' },      // zoom >= 1.0
            LOD1: { minZoom: 0.6, name: '中精度' },      // 0.6 <= zoom < 1.0
            LOD2: { minZoom: 0.4, name: '低精度' },      // 0.4 <= zoom < 0.6
            LOD3: { minZoom: 0.3, name: '占位符' }       // zoom < 0.4 (最低级别，0.3为参考阈值)
        };
    }

    /**
     * 根据缩放比例获取LOD等级
     * 四级LOD阈值：1.0, 0.6, 0.4, 0.3
     */
    getLODLevel(zoom) {
        if (zoom >= 1.0) return 'LOD0';   // >= 1.0: 高精度
        if (zoom >= 0.6) return 'LOD1';   // 0.6 <= zoom < 1.0: 中精度
        if (zoom >= 0.4) return 'LOD2';   // 0.4 <= zoom < 0.6: 低精度
        return 'LOD3';                    // zoom < 0.4: 占位符（0.3为参考阈值）
    }

    /**
     * 判断是否应该绘制节点细节
     */
    shouldDrawNodeDetails(zoom) {
        return zoom >= 0.6; // LOD0和LOD1绘制细节
    }

    /**
     * 判断是否应该绘制节点文字
     */
    shouldDrawNodeText(zoom) {
        return zoom >= 0.6; // LOD0和LOD1绘制文字
    }

    /**
     * 判断是否应该绘制连线箭头
     */
    shouldDrawArrow(zoom) {
        return zoom >= 0.6; // LOD0和LOD1绘制箭头
    }

    /**
     * 判断是否应该使用贝塞尔曲线
     */
    shouldUseBezier(zoom) {
        return zoom >= 1.0; // 仅LOD0使用贝塞尔曲线
    }
}

/**
 * 简化的四叉树实现
 * 用于加速空间查询（节点数 > 500 时使用）
 */
export class QuadTree {
    constructor(bounds, maxObjects = 10, maxLevels = 5, level = 0) {
        this.bounds = bounds; // { x, y, width, height }
        this.maxObjects = maxObjects;
        this.maxLevels = maxLevels;
        this.level = level;
        this.objects = [];
        this.nodes = []; // 四个子节点
    }

    /**
     * 将区域分割为四个子区域
     */
    split() {
        const subWidth = this.bounds.width / 2;
        const subHeight = this.bounds.height / 2;
        const x = this.bounds.x;
        const y = this.bounds.y;

        this.nodes[0] = new QuadTree(
            { x: x + subWidth, y: y, width: subWidth, height: subHeight },
            this.maxObjects,
            this.maxLevels,
            this.level + 1
        );
        this.nodes[1] = new QuadTree(
            { x: x, y: y, width: subWidth, height: subHeight },
            this.maxObjects,
            this.maxLevels,
            this.level + 1
        );
        this.nodes[2] = new QuadTree(
            { x: x, y: y + subHeight, width: subWidth, height: subHeight },
            this.maxObjects,
            this.maxLevels,
            this.level + 1
        );
        this.nodes[3] = new QuadTree(
            { x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight },
            this.maxObjects,
            this.maxLevels,
            this.level + 1
        );
    }

    /**
     * 获取对象所在的象限索引
     */
    getIndex(rect) {
        const verticalMidpoint = this.bounds.x + this.bounds.width / 2;
        const horizontalMidpoint = this.bounds.y + this.bounds.height / 2;

        const topQuadrant = rect.y < horizontalMidpoint && 
                           rect.y + rect.height < horizontalMidpoint;
        const bottomQuadrant = rect.y > horizontalMidpoint;

        if (rect.x < verticalMidpoint && rect.x + rect.width < verticalMidpoint) {
            if (topQuadrant) return 1;
            if (bottomQuadrant) return 2;
        } else if (rect.x > verticalMidpoint) {
            if (topQuadrant) return 0;
            if (bottomQuadrant) return 3;
        }

        return -1; // 对象跨越多个象限
    }

    /**
     * 插入对象
     */
    insert(obj) {
        if (this.nodes.length > 0) {
            const index = this.getIndex(obj);
            if (index !== -1) {
                this.nodes[index].insert(obj);
                return;
            }
        }

        this.objects.push(obj);

        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            if (this.nodes.length === 0) {
                this.split();
            }

            let i = 0;
            while (i < this.objects.length) {
                const index = this.getIndex(this.objects[i]);
                if (index !== -1) {
                    this.nodes[index].insert(this.objects.splice(i, 1)[0]);
                } else {
                    i++;
                }
            }
        }
    }

    /**
     * 查询指定区域内的所有对象
     */
    query(area, found = []) {
        if (!this.intersects(this.bounds, area)) {
            return found;
        }

        for (let i = 0; i < this.objects.length; i++) {
            if (this.intersects(this.objects[i], area)) {
                found.push(this.objects[i].data || this.objects[i]);
            }
        }

        if (this.nodes.length > 0) {
            this.nodes[0].query(area, found);
            this.nodes[1].query(area, found);
            this.nodes[2].query(area, found);
            this.nodes[3].query(area, found);
        }

        return found;
    }

    /**
     * 判断两个矩形是否相交
     */
    intersects(rect1, rect2) {
        return !(rect1.x + rect1.width < rect2.x ||
                 rect1.x > rect2.x + rect2.width ||
                 rect1.y + rect1.height < rect2.y ||
                 rect1.y > rect2.y + rect2.height);
    }

    /**
     * 清空四叉树
     */
    clear() {
        this.objects = [];
        this.nodes = [];
    }
}

/**
 * 性能日志输出函数
 * 统一管理所有性能优化相关的日志输出
 */
export function perfLog(...args) {
    if (PERFORMANCE_LOG_ENABLED) {
        console.log(...args);
    }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.totalRenderTime = 0;
        this.maxRenderTime = 0;
        this.minRenderTime = Infinity;
        this.lastReportTime = performance.now();
        this.reportInterval = 1000; // 每秒报告一次
    }

    /**
     * 记录一帧的渲染时间
     */
    recordFrame(renderTime) {
        this.frameCount++;
        this.totalRenderTime += renderTime;
        this.maxRenderTime = Math.max(this.maxRenderTime, renderTime);
        this.minRenderTime = Math.min(this.minRenderTime, renderTime);

        const now = performance.now();
        if (now - this.lastReportTime >= this.reportInterval) {
            this.report();
            this.reset();
            this.lastReportTime = now;
        }
    }

    /**
     * 报告性能数据
     */
    report() {
        if (this.frameCount === 0) return;

        const avgRenderTime = this.totalRenderTime / this.frameCount;
        const avgFPS = 1000 / avgRenderTime;
        const minFPS = 1000 / this.maxRenderTime;
        const maxFPS = 1000 / this.minRenderTime;

        perfLog(`[性能监控] 平均渲染时间: ${avgRenderTime.toFixed(2)}ms, 平均FPS: ${avgFPS.toFixed(1)}, ` +
                `最小FPS: ${minFPS.toFixed(1)}, 最大FPS: ${maxFPS.toFixed(1)}`);
    }

    /**
     * 重置统计数据
     */
    reset() {
        this.frameCount = 0;
        this.totalRenderTime = 0;
        this.maxRenderTime = 0;
        this.minRenderTime = Infinity;
    }
}

