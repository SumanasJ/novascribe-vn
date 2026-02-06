
import { GoogleGenAI, Type } from "@google/genai";
import { VNGraph, NodeType, EdgeType, VNNodeData } from "../types";

export interface TreeGenConfig {
  branchPoints?: number;
  optionsPerNode?: number;
  minDepth?: number;
  maxDepth?: number;
}

export class GeminiService {
  /**
   * Brainstorms a branching narrative structure based on a summary.
   * @param model Optional model name (default: gemini-2.5-flash)
   */
  async brainstormStructure(summary: string, config?: TreeGenConfig, model?: string): Promise<Partial<VNGraph>> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = model || "gemini-2.5-flash";
    
    const dimensionsPrompt = config ? `
      结构约束：
      - 分支点数量：${config.branchPoints || 3}
      - 每个分支场景的选项数量：${config.optionsPerNode || 2}
      - 剧情深度：${config.minDepth || 3} 到 ${config.maxDepth || 5} 层级。
    ` : "";

    const prompt = `
      你是一位视觉小说（Visual Novel）叙事架构师。
      请将以下故事梗概转化为一套逻辑严密的剧情树结构。

      故事梗概：
      ${summary}

      ${dimensionsPrompt}

      生成规则：
      1. 'label'（标题）、'content'（剧情）、'location'（地点）和变量名称必须使用中文。
      2. 节点说明：
         - 'START'：起始点。
         - 'SCENE'：标准剧情节点，需包含对话或描述。
         - 'GATE'：逻辑条件检查。
         - 'END'：结局。
      3. 'isPoolMember'：布尔值。如果该剧情是主线树的一部分，设为 false；如果是独立的随机/侧边事件，设为 true。
      4. 逻辑变量：定义 2-5 个核心变量（如“信任度”、“勇气”），并在 preconditions 和 effects 中合理使用。
      5. 确保 id 唯一。
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
   */
  async generateNodeContent(
    nodeId: string,
    graph: VNGraph,
    storySummary: string,
    model?: string
  ): Promise<Partial<VNNodeData>> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    const contextPrompt = `
      你是一位视觉小说（Visual Novel）编剧。请为以下剧情节点生成或重新生成内容。

      【整体故事背景】
      ${storySummary || "暂无整体背景"}

      【当前节点】
      ID: ${node.id}
      当前标签: ${node.label}

      【前置节点（来源）】
      ${incomingNodes.length > 0 ? incomingNodes.map(n => `- ${n!.label}: ${n!.content?.slice(0, 100) || "暂无内容"}`).join('\n') : "无（这是起点节点）"}

      【后置节点（去向）】
      ${outgoingNodes.length > 0 ? outgoingNodes.map(n => `- ${n!.label}: ${n!.content?.slice(0, 100) || "暂无内容"}`).join('\n') : "无（这是终点节点）"}

      请生成以下内容（JSON格式）：
      {
        "label": "节点标题（简短有力，中文）",
        "content": "详细的剧情内容（包括对话、场景描写、氛围营造，300-500字，中文）",
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
      1. 内容必须与前后节点逻辑连贯
      2. 如果是起点，要有吸引力的开场
      3. 如果是终点，要有收束感
      4. hasChoice根据是否有分支决定
      5. preconditions和effects要符合叙事逻辑
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
