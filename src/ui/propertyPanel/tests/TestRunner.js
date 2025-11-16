/**
 * 属性面板测试运行器
 * 提供一个简单的界面来执行和显示测试结果
 */

import PropertyPanelTestSuite from './PropertyPanelTestSuite.js';

class TestRunner {
    constructor() {
        this.testSuite = null;
        this.resultsElement = null;
        this.statusElement = null;
        this.progressBar = null;
        this.isRunning = false;
    }
    
    // 初始化测试运行器
    initialize() {
        this.testSuite = new PropertyPanelTestSuite();
        this._createUI();
        return this;
    }
    
    // 创建测试界面
    _createUI() {
        // 创建容器
        const container = document.createElement('div');
        container.className = 'property-panel-test-runner';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 400px;
            max-height: 500px;
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;
        
        // 创建标题
        const title = document.createElement('h3');
        title.textContent = '属性面板测试运行器';
        title.style.margin = '0 0 16px 0';
        title.style.color = '#333';
        container.appendChild(title);
        
        // 创建运行按钮
        const runButton = document.createElement('button');
        runButton.textContent = '运行所有测试';
        runButton.style.cssText = `
            padding: 8px 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-bottom: 16px;
        `;
        runButton.addEventListener('click', () => this.runTests());
        runButton.addEventListener('mouseover', () => runButton.style.background = '#45a049');
        runButton.addEventListener('mouseout', () => runButton.style.background = '#4CAF50');
        container.appendChild(runButton);
        
        // 创建状态显示
        this.statusElement = document.createElement('div');
        this.statusElement.className = 'test-status';
        this.statusElement.style.cssText = `
            margin-bottom: 12px;
            font-size: 14px;
            color: #666;
        `;
        this.statusElement.textContent = '就绪';
        container.appendChild(this.statusElement);
        
        // 创建进度条
        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = `
            height: 4px;
            background: #eee;
            border-radius: 2px;
            margin-bottom: 12px;
            overflow: hidden;
        `;
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.cssText = `
            height: 100%;
            width: 0%;
            background: #4CAF50;
            transition: width 0.3s ease;
        `;
        this.progressBar.appendChild(progressFill);
        container.appendChild(this.progressBar);
        
        // 创建结果容器
        const resultsContainer = document.createElement('div');
        resultsContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            background: white;
            border-radius: 4px;
            padding: 12px;
            border: 1px solid #eee;
        `;
        
        // 创建结果标题
        const resultsTitle = document.createElement('div');
        resultsTitle.style.fontWeight = 'bold';
        resultsTitle.style.marginBottom = '8px';
        resultsTitle.style.display = 'flex';
        resultsTitle.style.justifyContent = 'space-between';
        resultsTitle.innerHTML = '<span>测试结果</span><span id="test-summary"></span>';
        resultsContainer.appendChild(resultsTitle);
        
        // 创建结果列表
        this.resultsElement = document.createElement('div');
        this.resultsElement.className = 'test-results';
        resultsContainer.appendChild(this.resultsElement);
        
        container.appendChild(resultsContainer);
        
        // 添加到文档
        document.body.appendChild(container);
    }
    
    // 运行测试
    runTests() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.statusElement.textContent = '测试运行中...';
        this.resultsElement.innerHTML = '';
        this._updateProgress(0);
        
        console.log('开始执行属性面板测试...');
        
        this.testSuite.runAllTests().then(success => {
            this.isRunning = false;
            this.statusElement.textContent = success ? '测试全部通过！' : '部分测试失败';
            this._updateProgress(100);
            
            // 显示摘要
            const summaryElement = document.getElementById('test-summary');
            if (summaryElement) {
                summaryElement.textContent = success ? '全部通过' : '有失败';
                summaryElement.style.color = success ? '#4CAF50' : '#f44336';
            }
            
            console.log('属性面板测试执行完毕:', success ? '全部通过' : '有失败');
        }).catch(error => {
            this.isRunning = false;
            this.statusElement.textContent = '测试执行出错';
            console.error('测试执行错误:', error);
        });
    }
    
    // 更新进度条
    _updateProgress(percent) {
        const fill = this.progressBar.querySelector('.progress-fill');
        if (fill) {
            fill.style.width = `${percent}%`;
        }
    }
    
    // 显示测试结果
    showResult(testName, success) {
        const resultItem = document.createElement('div');
        resultItem.style.cssText = `
            padding: 6px 0;
            border-bottom: 1px solid #eee;
            font-size: 13px;
            display: flex;
            align-items: center;
        `;
        
        const statusIcon = document.createElement('span');
        statusIcon.style.cssText = `
            width: 16px;
            height: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 8px;
            font-size: 12px;
        `;
        
        if (success) {
            statusIcon.textContent = '✓';
            statusIcon.style.color = '#4CAF50';
            resultItem.style.color = '#333';
        } else {
            statusIcon.textContent = '✗';
            statusIcon.style.color = '#f44336';
            resultItem.style.color = '#666';
        }
        
        resultItem.appendChild(statusIcon);
        resultItem.appendChild(document.createTextNode(testName));
        this.resultsElement.appendChild(resultItem);
        
        // 滚动到底部
        this.resultsElement.scrollTop = this.resultsElement.scrollHeight;
    }
    
    // 销毁测试运行器
    destroy() {
        const container = document.querySelector('.property-panel-test-runner');
        if (container) {
            document.body.removeChild(container);
        }
        this.testSuite = null;
        this.resultsElement = null;
        this.statusElement = null;
        this.progressBar = null;
    }
}

// 导出测试运行器
export default TestRunner;

// 创建全局实例
window.PropertyPanelTestRunner = TestRunner;

// 提供一个简单的初始化函数
window.initPropertyPanelTests = function() {
    if (!window.propertyPanelTestRunner) {
        window.propertyPanelTestRunner = new TestRunner().initialize();
    }
    return window.propertyPanelTestRunner;
};