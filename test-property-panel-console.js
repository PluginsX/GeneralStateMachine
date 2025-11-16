// 属性面板测试脚本
// 在浏览器控制台中运行此脚本来测试属性面板

console.log('开始属性面板测试...');

// 获取NodeGraphEditorController实例
const controller = window.nodeGraphEditorController;

if (!controller) {
    console.error('找不到NodeGraphEditorController实例');
} else {
    console.log('找到NodeGraphEditorController实例:', controller);
    
    // 测试1: 创建一个简单的测试节点
    const testNode = {
        id: 'test_node_' + Date.now(),
        type: 'node',
        name: '测试节点',
        x: 100,
        y: 100,
        width: 120,
        height: 60,
        color: '#ff6b6b',
        visible: true,
        selected: false
    };
    
    console.log('创建测试节点:', testNode);
    
    // 将测试节点添加到控制器中
    controller.nodes.push(testNode);
    
    // 测试2: 选择这个节点
    console.log('选择测试节点...');
    controller.selectedElements = [testNode];
    
    // 测试3: 调用属性面板更新
    console.log('调用属性面板更新...');
    controller.propertyPanelAdapter.update([testNode], controller.nodes, controller.connections);
    
    console.log('属性面板测试完成！');
    
    // 测试4: 测试空选择
    setTimeout(() => {
        console.log('测试空选择...');
        controller.selectedElements = [];
        controller.propertyPanelAdapter.update([], controller.nodes, controller.connections);
    }, 3000);
}