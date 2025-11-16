/**
 * 属性面板测试套件
 * 测试属性面板的所有功能和边界情况
 */

import PropertyPanelManager from '../managers/PropertyPanelManager.js';
import ObjectBasePropertyHandler from '../managers/ObjectBasePropertyHandler.js';
import ComponentFactory from '../utils/ComponentFactory.js';
import TypeRegistry from '../reflection/TypeRegistry.js';
import ThemeManager from '../utils/ThemeManager.js';
import EventBus from '../utils/EventBus.js';
import BindingManager from '../utils/BindingManager.js';

// 模拟ObjectBase类
class ObjectBase {
    constructor() {
        this.id = Math.random().toString(36).substr(2, 9);
        this.name = 'ObjectBase';
    }
    
    // 用于测试的getter和setter
    get displayName() {
        return this.name;
    }
    
    set displayName(value) {
        this.name = value;
    }
}

// 模拟ObjectBase子类
class TestObject extends ObjectBase {
    constructor() {
        super();
        this.name = 'TestObject';
        this.stringValue = 'test';
        this.numberValue = 42;
        this.booleanValue = true;
        this.arrayValue = [1, 2, 3];
        this.objectValue = { key: 'value', nested: { prop: 'test' } };
        this.nullValue = null;
        this.undefinedValue = undefined;
    }
    
    get calculatedValue() {
        return this.numberValue * 2;
    }
}

class PropertyPanelTestSuite {
    constructor() {
        this.tests = [];
        this.results = [];
        this.currentTest = null;
        
        // 创建测试容器
        this._createTestEnvironment();
        
        // 注册所有测试
        this._registerTests();
    }
    
    // 创建测试环境
    _createTestEnvironment() {
        // 创建测试容器
        this.testContainer = document.createElement('div');
        this.testContainer.id = 'property-panel-test-container';
        this.testContainer.style.display = 'none';
        document.body.appendChild(this.testContainer);
        
        // 创建属性面板容器
        this.panelContainer = document.createElement('div');
        this.panelContainer.id = 'property-panel-test';
        this.testContainer.appendChild(this.panelContainer);
    }
    
    // 注册所有测试
    _registerTests() {
        this.tests = [
            this.testBasicDataTypes.bind(this),
            this.testComplexDataTypes.bind(this),
            this.testObjectBaseReflection.bind(this),
            this.testTwoWayBinding.bind(this),
            this.testEventHandling.bind(this),
            this.testThemeSwitching.bind(this),
            this.testErrorHandling.bind(this),
            this.testPerformance.bind(this),
            this.testComponentFactory.bind(this),
            this.testTypeRegistry.bind(this)
        ];
    }
    
    // 运行所有测试
    runAllTests() {
        console.log('开始运行属性面板测试套件...');
        this.results = [];
        
        return this.tests.reduce((promise, test) => {
            return promise.then(() => {
                this.currentTest = test.name;
                console.log(`运行测试: ${this.currentTest}`);
                return test().then(result => {
                    this.results.push({ name: this.currentTest, success: result });
                    console.log(`测试 ${this.currentTest}: ${result ? '通过' : '失败'}`);
                    return Promise.resolve();
                });
            });
        }, Promise.resolve()).then(() => {
            this._printResults();
            return this._allTestsPassed();
        });
    }
    
    // 打印测试结果
    _printResults() {
        const passed = this.results.filter(r => r.success).length;
        const total = this.results.length;
        
        console.log('============================');
        console.log('属性面板测试套件结果');
        console.log('============================');
        console.log(`总测试数: ${total}`);
        console.log(`通过测试: ${passed}`);
        console.log(`失败测试: ${total - passed}`);
        console.log('----------------------------');
        
        // 打印详细结果
        this.results.forEach(result => {
            console.log(`${result.name}: ${result.success ? '✓ 通过' : '✗ 失败'}`);
        });
    }
    
    // 检查是否所有测试都通过
    _allTestsPassed() {
        return this.results.every(r => r.success);
    }
    
    // 基本数据类型测试
    testBasicDataTypes() {
        return new Promise((resolve) => {
            try {
                const testObject = new TestObject();
                const manager = new PropertyPanelManager(this.panelContainer);
                
                // 渲染测试对象
                manager.renderObject(testObject);
                
                // 验证基本数据类型组件是否正确创建
                const stringInputs = this.panelContainer.querySelectorAll('input[type="text"]');
                const numberInputs = this.panelContainer.querySelectorAll('input[type="number"]');
                const booleanInputs = this.panelContainer.querySelectorAll('input[type="checkbox"]');
                
                // 清理
                manager.clear();
                
                resolve(stringInputs.length > 0 && numberInputs.length > 0 && booleanInputs.length > 0);
            } catch (error) {
                console.error('基本数据类型测试失败:', error);
                resolve(false);
            }
        });
    }
    
    // 复合数据类型测试
    testComplexDataTypes() {
        return new Promise((resolve) => {
            try {
                const testObject = new TestObject();
                const manager = new PropertyPanelManager(this.panelContainer);
                
                // 渲染测试对象
                manager.renderObject(testObject);
                
                // 验证复合数据类型组件是否正确创建
                const arrayComponents = this.panelContainer.querySelectorAll('.array-property-component');
                const objectComponents = this.panelContainer.querySelectorAll('.object-property-component');
                
                // 清理
                manager.clear();
                
                resolve(arrayComponents.length > 0 && objectComponents.length > 0);
            } catch (error) {
                console.error('复合数据类型测试失败:', error);
                resolve(false);
            }
        });
    }
    
    // ObjectBase反射测试
    testObjectBaseReflection() {
        return new Promise((resolve) => {
            try {
                const handler = new ObjectBasePropertyHandler();
                const testObject = new TestObject();
                
                // 获取属性信息
                const properties = handler.getObjectProperties(testObject);
                
                // 验证是否正确获取了属性信息
                const hasStringValue = properties.some(p => p.name === 'stringValue');
                const hasNumberValue = properties.some(p => p.name === 'numberValue');
                const hasBooleanValue = properties.some(p => p.name === 'booleanValue');
                const hasCalculatedValue = properties.some(p => p.name === 'calculatedValue' && p.isReadOnly);
                
                // 清理
                handler.destroy();
                
                resolve(hasStringValue && hasNumberValue && hasBooleanValue && hasCalculatedValue);
            } catch (error) {
                console.error('ObjectBase反射测试失败:', error);
                resolve(false);
            }
        });
    }
    
    // 双向绑定测试
    testTwoWayBinding() {
        return new Promise((resolve) => {
            try {
                const bindingManager = new BindingManager();
                const testObject = new TestObject();
                
                // 创建测试输入元素
                const input = document.createElement('input');
                input.type = 'text';
                this.testContainer.appendChild(input);
                
                // 建立双向绑定
                bindingManager.bind(input, testObject, 'stringValue');
                
                // 测试从数据到视图的绑定
                testObject.stringValue = 'new value';
                bindingManager.updateView(testObject, 'stringValue');
                const viewUpdateSuccess = input.value === 'new value';
                
                // 测试从视图到数据的绑定
                input.value = 'updated value';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                const dataUpdateSuccess = testObject.stringValue === 'updated value';
                
                // 清理
                bindingManager.unbind(input);
                this.testContainer.removeChild(input);
                
                resolve(viewUpdateSuccess && dataUpdateSuccess);
            } catch (error) {
                console.error('双向绑定测试失败:', error);
                resolve(false);
            }
        });
    }
    
    // 事件处理测试
    testEventHandling() {
        return new Promise((resolve) => {
            try {
                const eventBus = EventBus.getInstance();
                let eventReceived = false;
                let receivedData = null;
                
                // 注册事件监听器
                const handler = (data) => {
                    eventReceived = true;
                    receivedData = data;
                };
                eventBus.on('testEvent', handler);
                
                // 触发事件
                const testData = { value: 'test data' };
                eventBus.emit('testEvent', testData);
                
                // 检查事件是否被正确处理
                const success = eventReceived && receivedData === testData;
                
                // 清理
                eventBus.off('testEvent', handler);
                
                resolve(success);
            } catch (error) {
                console.error('事件处理测试失败:', error);
                resolve(false);
            }
        });
    }
    
    // 主题切换测试
    testThemeSwitching() {
        return new Promise((resolve) => {
            try {
                const themeManager = ThemeManager.getInstance();
                
                // 测试亮主题
                themeManager.setTheme('light');
                const hasLightClass = document.documentElement.classList.contains('theme-light');
                
                // 测试暗主题
                themeManager.setTheme('dark');
                const hasDarkClass = document.documentElement.classList.contains('theme-dark');
                
                // 恢复默认主题
                themeManager.setTheme('light');
                
                resolve(hasLightClass && hasDarkClass);
            } catch (error) {
                console.error('主题切换测试失败:', error);
                resolve(false);
            }
        });
    }
    
    // 错误处理测试
    testErrorHandling() {
        return new Promise((resolve) => {
            try {
                const manager = new PropertyPanelManager(this.panelContainer);
                
                // 测试无效对象
                let errorCaught = false;
                try {
                    manager.renderObject(null);
                } catch (error) {
                    errorCaught = true;
                }
                
                // 测试未知类型
                const unknownObject = { unknownProperty: 'value' };
                manager.renderObject(unknownObject);
                
                // 清理
                manager.clear();
                
                resolve(errorCaught);
            } catch (error) {
                console.error('错误处理测试失败:', error);
                resolve(false);
            }
        });
    }
    
    // 性能测试
    testPerformance() {
        return new Promise((resolve) => {
            try {
                const manager = new PropertyPanelManager(this.panelContainer);
                
                // 创建包含大量属性的测试对象
                const complexObject = new TestObject();
                for (let i = 0; i < 50; i++) {
                    complexObject[`dynamicProp${i}`] = `value${i}`;
                    complexObject[`dynamicNum${i}`] = i;
                }
                
                // 测量渲染时间
                const startTime = performance.now();
                manager.renderObject(complexObject);
                const renderTime = performance.now() - startTime;
                
                // 测量清理时间
                const clearStartTime = performance.now();
                manager.clear();
                const clearTime = performance.now() - clearStartTime;
                
                console.log(`性能测试 - 渲染时间: ${renderTime.toFixed(2)}ms, 清理时间: ${clearTime.toFixed(2)}ms`);
                
                // 渲染时间应该在合理范围内（<200ms）
                resolve(renderTime < 200);
            } catch (error) {
                console.error('性能测试失败:', error);
                resolve(false);
            }
        });
    }
    
    // 组件工厂测试
    testComponentFactory() {
        return new Promise((resolve) => {
            try {
                const factory = new ComponentFactory();
                
                // 测试创建基本组件
                const stringComponent = factory.createComponent('string', { name: 'test', value: 'value' });
                const numberComponent = factory.createComponent('number', { name: 'test', value: 42 });
                const booleanComponent = factory.createComponent('boolean', { name: 'test', value: true });
                
                // 验证组件创建成功
                const success = 
                    stringComponent instanceof HTMLElement &&
                    numberComponent instanceof HTMLElement &&
                    booleanComponent instanceof HTMLElement;
                
                resolve(success);
            } catch (error) {
                console.error('组件工厂测试失败:', error);
                resolve(false);
            }
        });
    }
    
    // 类型注册表测试
    testTypeRegistry() {
        return new Promise((resolve) => {
            try {
                const registry = new TypeRegistry();
                
                // 测试类型注册和查询
                class CustomType {};
                registry.registerType('custom', CustomType);
                const typeInfo = registry.getTypeInfo('custom');
                
                // 测试类型检测
                const isStringType = registry.isType('string', 'test');
                const isNumberType = registry.isType('number', 42);
                const isBooleanType = registry.isType('boolean', true);
                
                const success = 
                    typeInfo !== null &&
                    isStringType &&
                    isNumberType &&
                    isBooleanType;
                
                resolve(success);
            } catch (error) {
                console.error('类型注册表测试失败:', error);
                resolve(false);
            }
        });
    }
}

// 导出测试套件
export default PropertyPanelTestSuite;

// 如果直接运行此文件，自动执行测试
if (typeof window !== 'undefined') {
    window.PropertyPanelTestSuite = PropertyPanelTestSuite;
}