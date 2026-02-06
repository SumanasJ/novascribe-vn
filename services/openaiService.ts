
import OpenAI from "openai";
import { VNGraph, NodeType, EdgeType, VNNodeData } from "../types";

export interface TreeGenConfig {
  branchPoints?: number;
  optionsPerNode?: number;
  minDepth?: number;
  maxDepth?: number;
}

export class OpenAIService {
  /**
   * Brainstorms a branching narrative structure based on a summary.
   * @param model Optional model name (default: gpt-4o)
   */
  async brainstormStructure(summary: string, config?: TreeGenConfig, model?: string): Promise<Partial<VNGraph>> {
    const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not found. Please set OPENAI_API_KEY or API_KEY environment variable.");
    }

    const openai = new OpenAI({ apiKey });
    const modelName = model || "gpt-4o";

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
         - 所有节点统一使用 'SCENE' 类型。
         - 起始节点：只有出边，没有入边。
         - 结局节点：只有入边，没有出边。
         - 标准剧情节点：既有入边又有出边。
         - 自由剧情节点：无入边无出边（孤立场景）。
      3. 'isPoolMember'：布尔值。如果该剧情是主线树的一部分，设为 false；如果是独立的随机/侧边事件，设为 true。
      4. 逻辑变量：定义 2-5 个核心变量（如"信任度"、"勇气"），并在 preconditions 和 effects 中合理使用。
      5. 确保 id 唯一。

      请以 JSON 格式返回，包含以下结构：
      {
        "nodes": [...],
        "edges": [...],
        "variables": [...]
      }
    `;

    // Implement a simple retry mechanism for robustness against transient errors
    let lastError: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await openai.chat.completions.create({
          model: modelName,
          messages: [
            {
              role: "system",
              content: "你是一位专业的视觉小说叙事架构师，擅长构建逻辑严密、分支丰富的剧情结构。请始终以有效的 JSON 格式返回结果。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 8000
        });

        const text = response.choices[0]?.message?.content;
        if (!text) throw new Error("Empty response");
        return JSON.parse(text);
      } catch (e) {
        lastError = e;
        console.warn(`OpenAI Attempt ${attempt + 1} failed:`, e);
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
    const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not found.");
    }

    const openai = new OpenAI({ apiKey });
    const modelName = model || "gpt-4o";

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
            "variableId": "变量ID",
            "operator": "==|!=|>|<|>=|<=",
            "value": 数值
          }
        ],
        "effects": [
          {
            "variableId": "变量ID",
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
        const response = await openai.chat.completions.create({
          model: modelName,
          messages: [
            {
              role: "system",
              content: "你是一位专业的视觉小说编剧，擅长创作引人入胜的剧情内容。请始终以有效的 JSON 格式返回结果。"
            },
            {
              role: "user",
              content: contextPrompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.8,
          max_tokens: 4000
        });

        const text = response.choices[0]?.message?.content;
        if (!text) throw new Error("Empty response");
        return JSON.parse(text);
      } catch (e) {
        lastError = e;
        console.warn(`OpenAI node generation attempt ${attempt + 1} failed:`, e);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    throw lastError;
  }
}
