
import { GoogleGenAI, Type } from "@google/genai";
import { VNGraph, NodeType, EdgeType, VNNodeData } from "../types";

export interface TreeGenConfig {
  branchPoints?: number;
  optionsPerNode?: number;
  minDepth?: number;
  maxDepth?: number;
  randomEvents?: number;      // v0.5: 随机日常事件数量
  treeStructure?: string;      // v0.5: 树结构描述
}

export class GeminiService {
  /**
   * Brainstorms a branching narrative structure based on a summary.
   * @param model Optional model name (default: gemini-2.5-flash)
   * @param apiKey Optional API key (overrides environment variable)
   */
  async brainstormStructure(summary: string, config?: TreeGenConfig, model?: string, apiKey?: string): Promise<Partial<VNGraph>> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.API_KEY : undefined);
    if (!key) {
      throw new Error("API key not found. Please provide an API key.");
    }
    const ai = new GoogleGenAI({ apiKey: key });
    const modelName = model || "gemini-2.5-flash";

    const dimensionsPrompt = config ? `
      结构约束：
      - 分支点数量：${config.branchPoints || 3}
      - 每个分支场景的选项数量：${config.optionsPerNode || 2}
      - 剧情深度：${config.minDepth || 3} 到 ${config.maxDepth || 5} 层级。
      - 随机日常事件数量：${config.randomEvents || 0} 个（isPoolMember: true）
      ${config.treeStructure ? `- 树结构要求：${config.treeStructure}` : ''}
    ` : "";

    const prompt = `
      你是一位视觉小说（Visual Novel）叙事架构师。
      请将以下故事梗概转化为一套逻辑严密的剧情树结构。

      故事梗概：
      ${summary}

      ${dimensionsPrompt}

      生成规则：
      1. 'label'（标题）、'content'（剧情）、'location'（地点）和变量名称必须使用中文。
      2. 所有节点统一使用 'SCENE' 类型。
      3. 节点分类：
         - 起始节点：只有出边，没有入边（故事起点）
         - 标准剧情节点：既有入边又有出边
         - 结局节点：只有入边，没有出边（故事终点）
         - 随机事件节点：isPoolMember 设为 true（独立的日常/侧边事件）
      4. 'isPoolMember'：布尔值。主线剧情设为 false，随机日常事件设为 true。
      5. 逻辑变量：定义 2-5 个核心变量（如"信任度"、"勇气"），并在 preconditions 和 effects 中合理使用。
      6. 确保 id 唯一。

      重要：edges 数组中的每个连线必须使用以下格式：
      {
        "id": "唯一标识",
        "source": "起始节点id",
        "target": "目标节点id",
        "type": "FLOW"
      }
      注意：使用 "source" 和 "target"，不要使用 "from" 和 "to"！
    `;

    // Implement a simple retry mechanism for robustness against transient 500 errors
    let lastError: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          // Use specified model or default to gemini-2.5-flash
          model: modelName,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                nodes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      label: { type: Type.STRING },
                      type: { type: Type.STRING },
                      content: { type: Type.STRING },
                      location: { type: Type.STRING },
                      isPoolMember: { type: Type.BOOLEAN },
                      options: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            text: { type: Type.STRING },
                            targetId: { type: Type.STRING }
                          },
                          required: ["id", "text", "targetId"]
                        }
                      },
                      preconditions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            variableId: { type: Type.STRING },
                            operator: { type: Type.STRING },
                            value: { type: Type.NUMBER }
                          },
                          required: ["variableId", "operator", "value"]
                        }
                      },
                      effects: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            variableId: { type: Type.STRING },
                            operation: { type: Type.STRING },
                            value: { type: Type.NUMBER }
                          },
                          required: ["variableId", "operation", "value"]
                        }
                      }
                    },
                    required: ["id", "label", "type", "content", "location"]
                  }
                },
                edges: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      source: { type: Type.STRING },
                      target: { type: Type.STRING },
                      type: { type: Type.STRING },
                      label: { type: Type.STRING }
                    },
                    required: ["id", "source", "target", "type"]
                  }
                },
                variables: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      type: { type: Type.STRING },
                      defaultValue: { type: Type.NUMBER }
                    },
                    required: ["id", "name", "type", "defaultValue"]
                  }
                }
              },
              required: ["nodes", "edges", "variables"]
            }
          }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response");
        return JSON.parse(text);
      } catch (e) {
        lastError = e;
        console.warn(`Gemini Attempt ${attempt + 1} failed:`, e);
        // Wait 1s before retry
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    throw lastError;
  }

  /**
   * Generates or regenerates content for a single node based on context.
   * Considers adjacent nodes and story summary for coherent content.
   * @param nodeId The target node ID
   * @param graph The current story graph
   * @param storySummary Overall story summary for context
   * @param model Optional model name
   * @param apiKey Optional API key (overrides environment variable)
   * @param customPrompt Optional custom prompt from user
   */
  async generateNodeContent(
    nodeId: string,
    graph: VNGraph,
    storySummary: string,
    model?: string,
    apiKey?: string,
    customPrompt?: string
  ): Promise<Partial<VNNodeData>> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.API_KEY : undefined);
    if (!key) {
      throw new Error("API key not found. Please provide an API key.");
    }
    const ai = new GoogleGenAI({ apiKey: key });
    const modelName = model || "gemini-2.5-flash";

    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Find connected nodes for context
    const incomingNodes = graph.edges
      .filter(e => e.target === nodeId)
      .map(e => graph.nodes.find(n => n.id === e.source))
      .filter(Boolean);

    const outgoingNodes = graph.edges
      .filter(e => e.source === nodeId)
      .map(e => graph.nodes.find(n => n.id === e.target))
      .filter(Boolean);

    // Analyze narrative function based on connections
    let narrativeFunction = "延续剧情";
    if (incomingNodes.length === 0 && outgoingNodes.length > 0) {
      narrativeFunction = "起点开场";
    } else if (incomingNodes.length > 0 && outgoingNodes.length === 0) {
      narrativeFunction = "结局收束";
    } else if (outgoingNodes.length > 1) {
      narrativeFunction = "分支点";
    } else if (incomingNodes.length > 1) {
      narrativeFunction = "汇聚点";
    }

    const customPromptSection = customPrompt ? `
      【用户自定义要求】
      ${customPrompt}
    ` : "";

    const contextPrompt = `
      你是一位视觉小说（Visual Novel）编剧。请为以下剧情节点生成或重新生成内容。

      【整体故事背景】
      ${storySummary || "暂无整体背景"}

      【当前节点】
      ID: ${node.id}
      当前标签: ${node.label}
      叙事功能: ${narrativeFunction}

      【前置节点（来源）】
      ${incomingNodes.length > 0 ? incomingNodes.map(n => `- ${n!.label}: ${n!.content?.slice(0, 100) || "暂无内容"}`).join('\n') : "无（这是起点节点）"}

      【后置节点（去向）】
      ${outgoingNodes.length > 0 ? outgoingNodes.map(n => `- ${n!.label}: ${n!.content?.slice(0, 100) || "暂无内容"}`).join('\n') : "无（这是终点节点）"}

      ${customPromptSection}

      请生成以下内容（JSON格式）：
      {
        "label": "节点标题（简短有力，中文）",
        "content": "简明的剧情描述（50-150字，中文），说明发生了什么，不需要详细对话",
        "location": "场景地点（中文）",
        "hasChoice": true/false,
        "preconditions": [
          {
            "variableId": "变量ID（从现有变量中选择或留空）",
            "operator": "==|!=|>|<|>=|<=",
            "value": 数值
          }
        ],
        "effects": [
          {
            "variableId": "变量ID（从现有变量中选择或留空）",
            "operation": "set|add|subtract|toggle",
            "value": 数值
          }
        ],
        "isPoolMember": false
      }

      要求：
      1. 内容简明扼要（50-150字），直接说明发生了什么
      2. 不要引入新角色，除非故事背景中已存在
      3. 根据叙事功能调整内容风格：
         - 起点开场：吸引注意，快速切入主题
         - 延续剧情：承接上文，推进情节
         - 分支点：呈现选择的关键时刻
         - 汇聚点：收束多条线，汇总发展
         - 结局收束：给出明确结局
      4. hasChoice根据是否有分支决定
      5. preconditions和effects要符合叙事逻辑
      6. 优先满足【用户自定义要求】中的所有要求
    `;

    let lastError: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ parts: [{ text: contextPrompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                content: { type: Type.STRING },
                location: { type: Type.STRING },
                hasChoice: { type: Type.BOOLEAN },
                preconditions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      variableId: { type: Type.STRING },
                      operator: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    }
                  }
                },
                effects: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      variableId: { type: Type.STRING },
                      operation: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    }
                  }
                },
                isPoolMember: { type: Type.BOOLEAN }
              },
              required: ["label", "content", "location"]
            }
          }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response");
        return JSON.parse(text);
      } catch (e) {
        lastError = e;
        console.warn(`Gemini node generation attempt ${attempt + 1} failed:`, e);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    throw lastError;
  }
}
