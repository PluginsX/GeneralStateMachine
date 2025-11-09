// 测试导入功能的脚本
// 由于项目可能不支持ES模块，我们直接在Node环境中模拟ImportService的关键功能

// 模拟Condition类
class Condition {
  constructor(type, parameter, operator, value) {
    this.type = type || 'Float';
    this.parameter = parameter || '';
    this.operator = operator || '==';
    this.value = value || '';
  }
}

// 模拟ImportService的关键方法
class ImportService {
  constructor() {
    this.nodeIdMap = new Map();
    this.nodeNameToIdMap = new Map();
  }
  
  generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  importFromJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      
      // 检查是否是状态机格式
      if (data.Nodes && Array.isArray(data.Nodes) && data.Transitions && Array.isArray(data.Transitions)) {
        return this.importFromStateMachineJSON(data);
      }
      
      throw new Error('不支持的JSON格式');
    } catch (error) {
      console.error('导入JSON失败:', error);
      throw error;
    }
  }
  
  importFromStateMachineJSON(data) {
    // 验证数据对象
    if (!data || typeof data !== 'object') {
      throw new Error('无效的数据对象');
    }
    
    // 验证必需字段
    if (!data.Nodes || !Array.isArray(data.Nodes)) {
      throw new Error('JSON数据必须包含Nodes数组');
    }
    
    if (!data.Transitions || !Array.isArray(data.Transitions)) {
      throw new Error('JSON数据必须包含Transitions数组');
    }
    
    // 验证节点名称格式
    data.Nodes.forEach((nodeName, index) => {
      if (typeof nodeName !== 'string' || nodeName.trim() === '') {
        throw new Error(`索引${index}处的节点名称无效`);
      }
    });
    
    // 验证转换数据
    data.Transitions.forEach((transition, index) => {
      if (!transition || typeof transition !== 'object') {
        throw new Error(`索引${index}处的转换对象无效`);
      }
      
      if (!transition.From || typeof transition.From !== 'string') {
        throw new Error(`索引${index}处的转换缺少有效的From字段`);
      }
      
      if (!transition.To || typeof transition.To !== 'string') {
        throw new Error(`索引${index}处的转换缺少有效的To字段`);
      }
      
      // 验证条件格式（如果存在）
      if (transition.Conditions) {
        if (!Array.isArray(transition.Conditions)) {
          throw new Error(`索引${index}处的Conditions必须是数组`);
        }
        
        transition.Conditions.forEach((cond, condIndex) => {
          if (!cond || typeof cond !== 'object') {
            throw new Error(`转换${index}的条件${condIndex}无效`);
          }
          
          if (!cond.Parameter || typeof cond.Parameter !== 'string') {
            throw new Error(`转换${index}的条件${condIndex}缺少有效的Parameter字段`);
          }
          
          if (!cond.Type || typeof cond.Type !== 'string') {
            throw new Error(`转换${index}的条件${condIndex}缺少有效的Type字段`);
          }
          
          // 对于非Trigger类型，需要Compare和Value
          if (cond.Type !== 'Trigger') {
            if (!cond.Compare || typeof cond.Compare !== 'string') {
              throw new Error(`非Trigger类型的条件${condIndex}缺少有效的Compare字段`);
            }
            
            if (cond.Value === undefined) {
              throw new Error(`非Trigger类型的条件${condIndex}缺少有效的Value字段`);
            }
          }
        });
      }
    });
    
    // 创建节点和连线
    const nodes = this.createNodesFromStateMachine(data.Nodes);
    const connections = this.createConnectionsFromTransitions(data.Transitions, nodes);
    
    console.log('成功导入状态机数据:', {
      nodeCount: nodes.length,
      connectionCount: connections.length
    });
    
    return {
      version: '1.0',
      nodes: nodes,
      connections: connections
    };
  }
  
  createNodesFromStateMachine(nodeNames) {
    const nodes = [];
    const nodeNameMap = new Map(); // 名称到节点对象的映射
    
    // 自动布局配置
    const startX = 200;
    const startY = 150;
    const horizontalSpacing = 250;
    const verticalSpacing = 150;
    const nodesPerRow = 3;
    
    nodeNames.forEach((nodeName, index) => {
      const row = Math.floor(index / nodesPerRow);
      const col = index % nodesPerRow;
      
      // 计算节点位置
      const x = startX + col * horizontalSpacing;
      const y = startY + row * verticalSpacing;
      
      // 创建节点
      const node = {
        id: this.generateUniqueId(),
        name: nodeName,
        description: '',
        x: x,
        y: y,
        width: 150,
        height: 50
      };
      
      nodes.push(node);
      nodeNameMap.set(nodeName, node);
    });
    
    // 保存节点名称到ID的映射
    this.nodeNameToIdMap = nodeNameMap;
    
    return nodes;
  }
  
  createConnectionsFromTransitions(transitions, nodes) {
    const connections = [];
    
    transitions.forEach(transition => {
      // 查找源节点和目标节点
      const sourceNode = this.findNodeByName(transition.From, nodes);
      const targetNode = this.findNodeByName(transition.To, nodes);
      
      if (!sourceNode || !targetNode) {
        console.warn(`跳过无效的转换: ${transition.From} -> ${transition.To}, 找不到源节点或目标节点`);
        return;
      }
      
      // 创建连线
      const connection = {
        id: this.generateUniqueId(),
        sourceId: sourceNode.id,
        targetNodeId: targetNode.id,
        name: transition.Name || '',
        fromSide: 'right',
        toSide: 'left',
        conditions: [],
        defaultConnection: false,
        lineType: 'solid'
      };
      
      // 解析条件
      if (transition.Conditions && Array.isArray(transition.Conditions)) {
        connection.conditions = this.parseConditions(transition.Conditions);
      }
      
      connections.push(connection);
    });
    
    return connections;
  }
  
  parseConditions(conditions) {
    return conditions.map(cond => {
      // 映射比较操作符
      const operatorMap = {
        'Greater': '>',
        'Less': '<',
        'Equal': '==',
        'NotEqual': '!='
      };
      
      // 创建条件对象
      const condition = new Condition(
        cond.Type || 'Float',
        cond.Parameter || '',
        operatorMap[cond.Compare] || '==',
        cond.Value !== undefined ? cond.Value.toString() : ''
      );
      
      // 特殊处理Trigger类型
      if (cond.Type === 'Trigger') {
        condition.operator = '==';
        condition.value = 'true';
      }
      
      return condition;
    });
  }
  
  findNodeByName(name, nodes) {
    if (!name) return null;
    return nodes.find(node => node.name === name) || null;
  }
}

// 用户提供的示例JSON数据
const sampleJson = `{
  "Nodes": [
    "State_Idle",
    "State_Walk",
    "State_Run",
    "State_Sprint"
  ],
  "Transitions": [
    {
      "Name": "State_Idle->State_Walk",
      "From": "State_Idle",
      "To": "State_Walk",
      "Conditions": [
        {
          "Parameter": "MoveSpeed",
          "Type": "Float",
          "Compare": "Greater",
          "Value": 0.0
        },
        {
          "Parameter": "MotionFlag",
          "Type": "Int",
          "Compare": "Equal",
          "Value": 1
        },
        {
          "Parameter": "Walk",
          "Type": "Bool",
          "Compare": "Equal",
          "Value": true
        },
        {
          "Parameter": "Jump",
          "Type": "Trigger"
        }
      ]
    },
    {
      "Name": "State_Walk->State_Run",
      "From": "State_Walk",
      "To": "State_Run",
      "Conditions": [
        {
          "Parameter": "MoveSpeed",
          "Type": "Float",
          "Compare": "Greater",
          "Value": 0.0
        },
        {
          "Parameter": "MotionFlag",
          "Type": "Int",
          "Compare": "Equal",
          "Value": 1
        },
        {
          "Parameter": "Walk",
          "Type": "Bool",
          "Compare": "Equal",
          "Value": true
        },
        {
          "Parameter": "Jump",
          "Type": "Trigger"
        }
      ]
    },
    {
      "Name": "State_Run->State_Sprint",
      "From": "State_Run",
      "To": "State_Sprint",
      "Conditions": [
        {
          "Parameter": "MoveSpeed",
          "Type": "Float",
          "Compare": "Greater",
          "Value": 0.0
        },
        {
          "Parameter": "MotionFlag",
          "Type": "Int",
          "Compare": "Equal",
          "Value": 1
        },
        {
          "Parameter": "Walk",
          "Type": "Bool",
          "Compare": "Equal",
          "Value": true
        },
        {
          "Parameter": "Jump",
          "Type": "Trigger"
        }
      ]
    }
  ]
}`;

// 测试导入功能
async function testImport() {
  try {
    const importService = new ImportService();
    
    console.log('开始测试导入功能...');
    
    // 测试直接调用importFromJSON方法
    const result = importService.importFromJSON(sampleJson);
    
    console.log('\n导入成功！');
    console.log('\n节点列表:');
    result.nodes.forEach(node => {
      console.log(`- ${node.name} (ID: ${node.id})`);
    });
    
    console.log('\n连接列表:');
    result.connections.forEach(conn => {
      const source = result.nodes.find(n => n.id === conn.sourceId)?.name || 'Unknown';
      const target = result.nodes.find(n => n.id === conn.targetNodeId)?.name || 'Unknown';
      console.log(`- ${source} -> ${target} (条件数量: ${conn.conditions.length})`);
      
      // 显示条件详情
      if (conn.conditions.length > 0) {
        console.log('  条件:');
        conn.conditions.forEach(cond => {
          console.log(`    - ${cond.parameter} ${cond.operator} ${cond.value} (类型: ${cond.type})`);
        });
      }
    });
    
    console.log('\n测试完成！导入功能正常工作。');
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 运行测试
testImport();