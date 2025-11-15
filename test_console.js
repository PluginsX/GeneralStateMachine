// 测试自动排列功能的脚本
// 在浏览器控制台中运行此脚本来测试功能

// 等待编辑器加载完成
function waitForEditor() {
    return new Promise((resolve) => {
        const checkEditor = () => {
            if (window.editor && window.editor.isReady) {
                resolve(window.editor);
            } else {
                setTimeout(checkEditor, 100);
            }
        };
        checkEditor();
    });
}

// 测试自动排列功能
async function testAutoArrange() {
    console.log('开始测试自动排列功能...');
    
    try {
        const editor = await waitForEditor();
        
        // 清空现有节点
        editor.clearAll();
        console.log('已清空现有节点');
        
        // 创建测试节点
        const testNodes = [
            { name: '开始', x: 50, y: 50 },
            { name: '步骤1', x: 200, y: 100 },
            { name: '步骤2', x: 350, y: 150 },
            { name: '结束', x: 500, y: 200 }
        ];
        
        // 添加节点
        const createdNodes = [];
        testNodes.forEach(nodeData => {
            const node = editor.createNode(nodeData.x, nodeData.y, nodeData.name);
            editor.addNode(node);
            createdNodes.push(node);
            console.log(`创建节点: ${nodeData.name} (${node.id})`);
        });
        
        // 创建连接
        if (createdNodes.length >= 4) {
            editor.createConnection(createdNodes[0], createdNodes[1]);
            editor.createConnection(createdNodes[1], createdNodes[2]);
            editor.createConnection(createdNodes[2], createdNodes[3]);
            console.log('已创建连接');
        }
        
        // 记录排列前的位置
        const beforePositions = createdNodes.map(node => ({
            name: node.name,
            x: node.transform.position.x,
            y: node.transform.position.y
        }));
        console.log('排列前位置:', beforePositions);
        
        // 执行自动排列
        console.log('执行自动排列...');
        editor.arrangeNodesWithForceLayout();
        
        // 等待排列完成
        setTimeout(() => {
            // 记录排列后的位置
            const afterPositions = createdNodes.map(node => ({
                name: node.name,
                x: node.transform.position.x,
                y: node.transform.position.y
            }));
            console.log('排列后位置:', afterPositions);
            
            // 验证是否按树形结构排列
            const isTreeLayout = afterPositions.every((pos, index) => {
                const nextPos = afterPositions[index + 1];
                if (!nextPos) return true;
                // 检查是否按层级排列（Y坐标递增）
                return pos.y <= nextPos.y;
            });
            
            if (isTreeLayout) {
                console.log('✅ 自动排列测试通过：节点已按树形结构排列');
            } else {
                console.log('❌ 自动排列测试失败：节点未按树形结构排列');
            }
        }, 500);
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

// 测试实时排列开关
async function testRealTimeArrangeToggle() {
    console.log('开始测试实时排列开关...');
    
    try {
        const editor = await waitForEditor();
        
        // 检查当前状态
        const initialState = editor.isRealTimeArrangeActive || false;
        console.log('初始实时排列状态:', initialState);
        
        // 切换状态
        editor.handleRealTimeArrange();
        const newState = editor.isRealTimeArrangeActive || false;
        console.log('切换后实时排列状态:', newState);
        
        if (newState !== initialState) {
            console.log('✅ 实时排列开关测试通过');
        } else {
            console.log('❌ 实时排列开关测试失败');
        }
        
    } catch (error) {
        console.error('实时排列测试失败:', error);
    }
}

// 运行所有测试
async function runAllTests() {
    console.log('=== 开始自动排列功能测试 ===');
    
    await testAutoArrange();
    
    setTimeout(() => {
        testRealTimeArrangeToggle();
        console.log('=== 测试完成 ===');
    }, 2000);
}

// 导出测试函数
window.testAutoArrange = testAutoArrange;
window.testRealTimeArrangeToggle = testRealTimeArrangeToggle;
window.runAllTests = runAllTests;

console.log('测试脚本已加载。请在浏览器控制台中运行:');
console.log('- runAllTests() // 运行所有测试');
console.log('- testAutoArrange() // 测试自动排列');
console.log('- testRealTimeArrangeToggle() // 测试实时排列开关');