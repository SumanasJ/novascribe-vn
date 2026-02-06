
import { NodeType, EdgeType, VNGraph, SceneCategory } from './types';
import { VNNodeData } from './types';

// Helper function to determine scene category dynamically based on connections
export function getSceneCategory(nodeId: string, graph: VNGraph): SceneCategory {
  const node = graph.nodes.find(n => n.id === nodeId);

  // v0.3: Check if this is a branch narrative first
  if (node?.isBranch) {
    return SceneCategory.BRANCH;
  }

  const incomingEdges = graph.edges.filter(e => e.target === nodeId);
  const outgoingEdges = graph.edges.filter(e => e.source === nodeId);

  const hasIncoming = incomingEdges.length > 0;
  const hasOutgoing = outgoingEdges.length > 0;

  if (hasIncoming && hasOutgoing) return SceneCategory.STANDARD;
  if (!hasIncoming && !hasOutgoing) return SceneCategory.FREE;
  if (!hasIncoming && hasOutgoing) return SceneCategory.START;
  if (hasIncoming && !hasOutgoing) return SceneCategory.END;

  return SceneCategory.FREE;
}

// Colors for dynamic scene categories
export const SCENE_CATEGORY_COLORS = {
  [SceneCategory.STANDARD]: 'bg-sky-500',      // Blue - Standard scene
  [SceneCategory.FREE]: 'bg-violet-500',       // Purple - Free/isolated scene
  [SceneCategory.START]: 'bg-emerald-500',     // Green - Start point
  [SceneCategory.END]: 'bg-rose-500',          // Red - End point
  [SceneCategory.BRANCH]: 'bg-amber-500',      // Amber - Branch narrative
};

// Icons/labels for scene categories
export const SCENE_CATEGORY_LABELS = {
  [SceneCategory.STANDARD]: '标准剧情',
  [SceneCategory.FREE]: '自由剧情',
  [SceneCategory.START]: '起点',
  [SceneCategory.END]: '终点',
  [SceneCategory.BRANCH]: '分支剧情',
};

export const INITIAL_GRAPH: VNGraph = {
  nodes: [
    {
      id: 'n1',
      label: '醒来：云端实验室',
      type: NodeType.SCENE,
      location: '云端实验室',
      content: '在一场由苏黎主导的手术后醒来。苏黎："手术很成功，肿瘤切除得很干净。"',
      preconditions: [],
      effects: [{ variableId: 'v1', operation: 'set', value: 80 }],
      tags: ['序章'],
      hasChoice: false,
      position: { x: 50, y: 150 }
    },
    {
      id: 'n2',
      label: '任务：情感定制项目',
      type: NodeType.SCENE,
      location: '首席办公室',
      content: '苏黎："你是金牌审核员。扮演好杜玲玲的「完美初恋」，你的治疗费全免。"',
      preconditions: [],
      effects: [],
      tags: ['序章'],
      hasChoice: false,
      position: { x: 380, y: 150 }
    },
    {
      id: 'n3',
      label: '初见杜玲玲：违和感',
      type: NodeType.SCENE,
      location: '高级公寓',
      content: '杜玲玲熟练地拿着便利店的饭团递给你："我知道你爱吃这个。"她的语气完美，但手心冰冷。',
      preconditions: [],
      effects: [],
      hasChoice: true,
      options: [
        { id: 'o1', text: '"味道如何？"(探索)', targetId: 'n4', conditions: [], effects: [{ variableId: 'v4', operation: 'add', value: 10 }] },
        { id: 'o2', text: '"谢谢。"(接受)', targetId: 'n4', conditions: [], effects: [{ variableId: 'v2', operation: 'add', value: 5 }] }
      ],
      tags: ['第一章'],
      position: { x: 710, y: 150 }
    },
    {
      id: 'n4',
      label: '苏黎的坦白：09号供体',
      type: NodeType.SCENE,
      location: '首席办公室',
      content: '苏黎："供体萍萍扣留了10%的情感逻辑区。去安抚她，骗她放手。"',
      preconditions: [],
      effects: [],
      tags: ['第一章'],
      hasChoice: false,
      position: { x: 1040, y: 150 }
    },
    {
      id: 'n5',
      label: '便利店重逢',
      type: NodeType.SCENE,
      location: '24H便利店',
      content: '萍萍见到你，手中货物掉了一地。苏黎耳语："别忘了，你活着是因为她的牺牲。"',
      preconditions: [],
      effects: [{ variableId: 'v2', operation: 'add', value: 15 }],
      tags: ['第二章'],
      hasChoice: false,
      position: { x: 1370, y: 150 }
    },
    {
      id: 'n6',
      label: '潜意识干涉：第一回合',
      type: NodeType.SCENE,
      location: '虚拟记忆空间',
      content: '你在记忆中推开萍萍。她流着泪笑："没关系，只要你活着就好。"',
      preconditions: [],
      effects: [],
      hasChoice: true,
      options: [
        { id: 'o3', text: '决绝狠话', targetId: 'n7', conditions: [], effects: [{ variableId: 'v3', operation: 'add', value: 30 }] },
        { id: 'o4', text: '温和欺骗', targetId: 'n7', conditions: [], effects: [{ variableId: 'v2', operation: 'add', value: 20 }] }
      ],
      tags: ['第二章', '循环'],
      position: { x: 1370, y: 450 }
    },
    {
      id: 'n7',
      label: '逻辑闸：提取进度校验',
      type: NodeType.SCENE,
      location: '系统后台',
      content: '检查情感逻辑区剥离程度...',
      preconditions: [],
      effects: [],
      tags: ['系统'],
      hasChoice: false,
      position: { x: 1040, y: 450 }
    },
    {
      id: 'n8',
      label: '真相爆发：雨檐下',
      type: NodeType.SCENE,
      location: '潜意识深处',
      content: '你看到了湿透的缴费单。真相是：她卖掉记忆是为了救你。',
      preconditions: [{ variableId: 'v2', operator: '>', value: 35 }],
      effects: [{ variableId: 'v5', operation: 'set', value: true }],
      tags: ['高潮'],
      hasChoice: false,
      position: { x: 710, y: 450 }
    },
    {
      id: 'n9',
      label: '最终抉择：强制提取',
      type: NodeType.SCENE,
      location: '云端实验室',
      content: '苏黎："功率全开！拿走最后的10%！"',
      preconditions: [{ variableId: 'v5', operator: '==', value: true }],
      effects: [],
      hasChoice: true,
      options: [
        { id: 'o5', text: '保护她：给予回应', targetId: 'n10', conditions: [], effects: [] },
        { id: 'o6', text: '服从：执行剥离', targetId: 'n11', conditions: [], effects: [] }
      ],
      tags: ['终章'],
      position: { x: 380, y: 450 }
    },
    {
      id: 'n10',
      label: '结局：共振与代价',
      type: NodeType.SCENE,
      location: '便利店(雪夜)',
      content: '提取失败。杜玲玲救了你。几个月后便利店重逢，她虽然失忆，却本能地握住了你的手。',
      preconditions: [],
      effects: [],
      tags: ['真结局'],
      hasChoice: false,
      position: { x: 50, y: 450 }
    },
    {
      id: 'n11',
      label: '结局：完美的空壳',
      type: NodeType.SCENE,
      location: '空荡的城市',
      content: '提取成功。你活了下来，但萍萍成了废人。杜玲玲依然无法感知爱。',
      preconditions: [],
      effects: [],
      tags: ['坏结局'],
      hasChoice: false,
      position: { x: 50, y: 700 }
    }
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2', type: EdgeType.FLOW },
    { id: 'e2', source: 'n2', target: 'n3', type: EdgeType.FLOW },
    { id: 'e3', source: 'n3', target: 'n4', type: EdgeType.OPTION },
    { id: 'e4', source: 'n4', target: 'n5', type: EdgeType.FLOW },
    { id: 'e5', source: 'n5', target: 'n6', type: EdgeType.FLOW },
    { id: 'e6', source: 'n6', target: 'n7', type: EdgeType.OPTION },
    { id: 'e7', source: 'n7', target: 'n8', type: EdgeType.FLOW, label: '解析度充足' },
    { id: 'e8', source: 'n8', target: 'n9', type: EdgeType.FLOW },
    { id: 'e9', source: 'n9', target: 'n10', type: EdgeType.OPTION },
    { id: 'e10', source: 'n9', target: 'n11', type: EdgeType.OPTION }
  ],
  variables: [
    { id: 'v1', name: '精神值(Sanity)', type: 'number', defaultValue: 100, currentValue: 100, min: 0, max: 100 },
    { id: 'v2', name: '萍萍信任(Trust)', type: 'number', defaultValue: 0, currentValue: 0, min: 0, max: 100 },
    { id: 'v3', name: '幻痛指数(Pain)', type: 'number', defaultValue: 0, currentValue: 0, min: 0, max: 100 },
    { id: 'v4', name: '记忆裂缝(Leak)', type: 'number', defaultValue: 0, currentValue: 0, min: 0, max: 100 },
    { id: 'v5', name: '真相揭晓', type: 'boolean', defaultValue: false, currentValue: false }
  ],
  pools: []
};

// Legacy color mapping for backward compatibility
export const NODE_COLORS = {
  [NodeType.SCENE]: 'bg-sky-500',
};
