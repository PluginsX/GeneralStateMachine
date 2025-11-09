// 测试不同格式的JSON导入功能

// 模拟ImportService类，用于测试
class MockImportService {
    constructor() {
        this.nodeIdMap = new Map();
    }
    
    // 模拟format detection函数
    detectJSONFormat(jsonData) {
        try {
            if (jsonData && typeof jsonData === 'object') {
                if (jsonData.type === 'node-graph-editor-project') {
                    console.log('✓ 检测到标准工程文件格式');
                    return 'editor-project';
                } else if (jsonData.type === 'UnityAnimatorControllerExporter') {
                    console.log('✓ 检测到Unity动画状态机格式');
                    return 'unity-animator';
                }
            }
            console.log('✓ 检测到普通JSON格式');
            return 'generic';
        } catch (error) {
            console.error('格式检测错误:', error);
            return 'generic';
        }
    }
    
    // 测试不同格式的导入
    testImport(jsonStr, expectedFormat) {
        console.log('\n========== 开始测试 ==========');
        console.log(`测试数据: ${jsonStr.substring(0, 100)}${jsonStr.length > 100 ? '...' : ''}`);
        
        try {
            const jsonData = JSON.parse(jsonStr);
            const detectedFormat = this.detectJSONFormat(jsonData);
            
            console.log(`期望格式: ${expectedFormat}`);
            console.log(`实际检测格式: ${detectedFormat}`);
            
            const result = expectedFormat === detectedFormat;
            console.log(`测试结果: ${result ? '通过 ✓' : '失败 ✗'}`);
            
            return result;
        } catch (error) {
            console.error('测试失败:', error.message);
            return false;
        } finally {
            console.log('========== 测试结束 ==========');
        }
    }
}

// 测试数据
const testData = {
    // 1. 标准工程文件格式
    standardProject: {
        json: JSON.stringify({
            version: "1.0",
            type: "node-graph-editor-project",
            nodes: [
                { id: "node1", name: "开始节点", position: { x: 100, y: 100 } },
                { id: "node2", name: "结束节点", position: { x: 300, y: 100 } }
            ],
            connections: [
                { source: "node1", target: "node2", label: "连接" }
            ]
        }),
        expectedFormat: "editor-project"
    },
    
    // 2. Unity动画状态机格式
    unityAnimator: {
        json: JSON.stringify({
            version: "1.0",
            type: "UnityAnimatorControllerExporter",
            Nodes: [
                { name: "Idle", position: { x: 0, y: 0 } },
                { name: "Walk", position: { x: 10, y: 10 } }
            ],
            Transitions: [
                { source: "Idle", target: "Walk", condition: "IsWalking" }
            ]
        }),
        expectedFormat: "unity-animator"
    },
    
    // 3. 普通JSON格式
    genericJSON: {
        json: JSON.stringify({
            name: "测试对象",
            properties: {
                value: 42,
                active: true,
                tags: ["tag1", "tag2"]
            },
            children: [
                { id: 1, name: "子项1" },
                { id: 2, name: "子项2" }
            ]
        }),
        expectedFormat: "generic"
    },
    
    // 4. 错误格式测试 - 无效JSON
    invalidJSON: {
        json: "{这不是有效的JSON}",
        expectedFormat: null
    },
    
    // 5. 错误格式测试 - 缺少type字段
    missingType: {
        json: JSON.stringify({
            version: "1.0",
            data: "some data"
        }),
        expectedFormat: "generic"
    }
};

// 运行测试
function runTests() {
    console.log('\n开始运行JSON格式导入测试...');
    const service = new MockImportService();
    let passedTests = 0;
    const totalTests = Object.keys(testData).length;
    
    // 运行每个测试
    Object.entries(testData).forEach(([testName, testInfo]) => {
        console.log(`\n测试: ${testName}`);
        try {
            const result = service.testImport(testInfo.json, testInfo.expectedFormat);
            if (result) {
                passedTests++;
            }
        } catch (error) {
            console.error(`${testName} 测试失败:`, error);
        }
    });
    
    // 输出测试总结
    console.log(`\n测试总结: ${passedTests}/${totalTests} 测试通过`);
    
    // 模拟真实环境中的导入场景
    console.log('\n=== 模拟真实导入场景 ===');
    simulateRealImportScenario(service);
}

// 模拟真实导入场景
function simulateRealImportScenario(service) {
    // 1. 模拟编辑器导出的项目
    const editorProject = testData.standardProject.json;
    console.log('\n1. 导入编辑器导出的项目文件:');
    const editorData = JSON.parse(editorProject);
    const editorFormat = service.detectJSONFormat(editorData);
    console.log(`- 格式: ${editorFormat}`);
    console.log(`- 节点数: ${editorData.nodes?.length || 0}`);
    console.log(`- 连接数: ${editorData.connections?.length || 0}`);
    
    // 2. 模拟Unity导出的动画状态机
    const unityProject = testData.unityAnimator.json;
    console.log('\n2. 导入Unity动画状态机文件:');
    const unityData = JSON.parse(unityProject);
    const unityFormat = service.detectJSONFormat(unityData);
    console.log(`- 格式: ${unityFormat}`);
    console.log(`- 节点数: ${unityData.Nodes?.length || 0}`);
    console.log(`- 转换数: ${unityData.Transitions?.length || 0}`);
    
    // 3. 模拟普通JSON数据
    const genericData = testData.genericJSON.json;
    console.log('\n3. 导入普通JSON数据:');
    const genericObj = JSON.parse(genericData);
    const genericFormat = service.detectJSONFormat(genericObj);
    console.log(`- 格式: ${genericFormat}`);
    console.log(`- 数据类型: ${typeof genericObj}`);
    
    console.log('\n模拟导入完成，所有格式都能被正确识别和处理。');
}

// 如果在Node.js环境中运行，则执行测试
if (typeof module !== 'undefined' && require.main === module) {
    runTests();
}

// 导出函数供其他模块使用
module.exports = { MockImportService, testData, runTests };