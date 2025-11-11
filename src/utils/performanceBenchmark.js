// 性能基准测试工具
// 用于测量优化前后的渲染性能差异

/**
 * 性能测试类
 */
export class PerformanceBenchmark {
    constructor(editor) {
        this.editor = editor;
        this.results = [];
        this.running = false;
    }

    /**
     * 开始性能测试
     * @param {number} iterations 测试迭代次数
     * @param {Function} beforeIteration 每次迭代前执行的函数
     * @param {Function} afterIteration 每次迭代后执行的函数
     */
    async run(iterations = 100, beforeIteration = null, afterIteration = null) {
        if (this.running) {
            console.warn('性能测试已经在运行中');
            return;
        }

        this.running = true;
        this.results = [];
        console.log(`开始性能测试，迭代 ${iterations} 次...`);

        // 先执行一次渲染以预热
        if (this.editor && typeof this.editor.render === 'function') {
            this.editor.render(performance.now());
        }

        for (let i = 0; i < iterations; i++) {
            if (beforeIteration) {
                beforeIteration(i);
            }

            const startTime = performance.now();
            
            // 执行渲染或其他要测试的操作
            if (this.editor && typeof this.editor.render === 'function') {
                this.editor.render(performance.now());
            }

            const endTime = performance.now();
            const duration = endTime - startTime;
            
            this.results.push(duration);
            
            if (afterIteration) {
                afterIteration(i, duration);
            }

            // 短暂延迟以避免阻塞UI
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const stats = this.calculateStats(this.results);
        this.printResults(stats);
        
        this.running = false;
        return stats;
    }

    /**
     * 计算性能统计数据
     */
    calculateStats(results) {
        const sorted = [...results].sort((a, b) => a - b);
        const sum = sorted.reduce((acc, val) => acc + val, 0);
        
        return {
            iterations: results.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            mean: sum / results.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p90: sorted[Math.floor(sorted.length * 0.9)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            totalTime: sum
        };
    }

    /**
     * 打印性能测试结果
     */
    printResults(stats) {
        console.log('=== 性能测试结果 ===');
        console.log(`迭代次数: ${stats.iterations}`);
        console.log(`最短时间: ${stats.min.toFixed(2)}ms`);
        console.log(`最长时间: ${stats.max.toFixed(2)}ms`);
        console.log(`平均时间: ${stats.mean.toFixed(2)}ms`);
        console.log(`中位数: ${stats.median.toFixed(2)}ms`);
        console.log(`90%分位数: ${stats.p90.toFixed(2)}ms`);
        console.log(`95%分位数: ${stats.p95.toFixed(2)}ms`);
        console.log(`99%分位数: ${stats.p99.toFixed(2)}ms`);
        console.log(`总耗时: ${stats.totalTime.toFixed(2)}ms`);
        console.log(`每秒帧数: ${(1000 / stats.mean).toFixed(2)} FPS`);
        console.log('===================');
    }

    /**
     * 比较两个测试结果
     */
    compareResults(before, after) {
        console.log('=== 性能优化效果对比 ===');
        console.log(`平均时间: ${before.mean.toFixed(2)}ms -> ${after.mean.toFixed(2)}ms`);
        console.log(`性能提升: ${((before.mean - after.mean) / before.mean * 100).toFixed(2)}%`);
        console.log(`FPS提升: ${(1000 / after.mean).toFixed(2)} FPS vs ${(1000 / before.mean).toFixed(2)} FPS`);
        console.log('======================');
    }

    /**
     * 获取可视对象统计信息
     */
    getVisibilityStats() {
        if (!this.editor) return null;

        const totalNodes = this.editor.nodes ? this.editor.nodes.length : 0;
        const visibleNodes = this.editor.visibleNodes ? this.editor.visibleNodes.length : 0;
        const totalConnections = this.editor.connections ? this.editor.connections.length : 0;
        const visibleConnections = this.editor.visibleConnections ? this.editor.visibleConnections.length : 0;

        const nodeVisibilityRatio = totalNodes > 0 ? (visibleNodes / totalNodes * 100) : 0;
        const connectionVisibilityRatio = totalConnections > 0 ? (visibleConnections / totalConnections * 100) : 0;

        console.log('=== 可视对象统计 ===');
        console.log(`总节点数: ${totalNodes}`);
        console.log(`可视节点数: ${visibleNodes} (${nodeVisibilityRatio.toFixed(1)}%)`);
        console.log(`总连线数: ${totalConnections}`);
        console.log(`可视连线数: ${visibleConnections} (${connectionVisibilityRatio.toFixed(1)}%)`);
        console.log('==================');

        return {
            totalNodes,
            visibleNodes,
            nodeVisibilityRatio,
            totalConnections,
            visibleConnections,
            connectionVisibilityRatio
        };
    }

    /**
     * 模拟高负载场景进行测试
     */
    async simulateHighLoadTest(nodeCount = 500, connectionDensity = 0.5) {
        console.log(`开始高负载测试，模拟 ${nodeCount} 个节点，连接密度 ${connectionDensity}...`);
        
        // 保存当前状态
        const originalNodes = this.editor.nodes;
        const originalConnections = this.editor.connections;
        
        try {
            // 生成大量节点和连接
            const nodes = [];
            const connections = [];
            
            // 生成节点
            for (let i = 0; i < nodeCount; i++) {
                nodes.push({
                    id: `test-node-${i}`,
                    x: Math.random() * 10000 - 5000,
                    y: Math.random() * 10000 - 5000,
                    width: 150,
                    height: 70,
                    name: `Node ${i}`,
                    description: `Description for node ${i}`,
                    type: 'default',
                    color: '#3498db',
                    isSelected: false,
                    isHovered: false,
                    conditions: []
                });
            }
            
            // 生成连接
            for (let i = 0; i < nodeCount * connectionDensity; i++) {
                const sourceIndex = Math.floor(Math.random() * nodeCount);
                let targetIndex = Math.floor(Math.random() * nodeCount);
                
                // 确保源和目标不同
                while (sourceIndex === targetIndex) {
                    targetIndex = Math.floor(Math.random() * nodeCount);
                }
                
                connections.push({
                    id: `test-connection-${i}`,
                    sourceNodeId: nodes[sourceIndex].id,
                    targetNodeId: nodes[targetIndex].id,
                    conditions: [],
                    isBidirectional: Math.random() > 0.7,
                    isSelected: false
                });
            }
            
            // 设置测试数据
            this.editor.nodes = nodes;
            this.editor.connections = connections;
            
            // 执行性能测试
            const stats = await this.run(30, null, null);
            
            // 恢复原始状态
            return stats;
        } finally {
            // 恢复原始状态
            this.editor.nodes = originalNodes;
            this.editor.connections = originalConnections;
            console.log('高负载测试完成，已恢复原始状态');
        }
    }
}

/**
 * 在控制台运行性能测试的快捷函数
 */
window.runPerformanceTest = async (editor, iterations = 100) => {
    const benchmark = new PerformanceBenchmark(editor);
    
    // 先获取可视对象统计
    benchmark.getVisibilityStats();
    
    // 运行基准测试
    const stats = await benchmark.run(iterations, 
        (i) => {
            if (i % 10 === 0) console.log(`进行中... ${i}/${iterations}`);
        },
        (i, duration) => {
            if (i % 20 === 0) console.log(`迭代 ${i}: ${duration.toFixed(2)}ms`);
        }
    );
    
    return stats;
};

/**
 * 运行高负载测试的快捷函数
 */
window.runHighLoadTest = async (editor, nodeCount = 500, connectionDensity = 0.5) => {
    const benchmark = new PerformanceBenchmark(editor);
    return await benchmark.simulateHighLoadTest(nodeCount, connectionDensity);
};

/**
 * 比较优化前后性能的快捷函数
 */
window.comparePerformance = async (editor, beforeStats) => {
    const benchmark = new PerformanceBenchmark(editor);
    const afterStats = await benchmark.run(100);
    benchmark.compareResults(beforeStats, afterStats);
    return afterStats;
};