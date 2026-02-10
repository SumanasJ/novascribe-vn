import { VNGraph, VNNodeData, VNCondition, VNEffect, StateDependency, NarrativeConflict } from '../types';

/**
 * StateAnalyzer - Analyzes narrative graph for state dependencies and conflicts
 */
export class StateAnalyzer {
  /**
   * Extract all state dependencies from graph
   */
  static extractDependencies(graph: VNGraph): StateDependency[] {
    return graph.nodes.map(node => ({
      nodeId: node.id,
      dependsOn: [
        ...node.preconditions.map(c => c.variableId),
        ...(node.options || []).flatMap(opt => opt.conditions.map(c => c.variableId))
      ],
      modifies: [
        ...node.effects.map(e => e.variableId),
        ...(node.options || []).flatMap(opt => opt.effects.map(e => e.variableId))
      ]
    }));
  }

  /**
   * Check if a node is reachable from start nodes
   */
  static isNodeReachable(targetNodeId: string, graph: VNGraph): boolean {
    const visited = new Set<string>();
    const queue: string[] = [];

    // Find start nodes (no incoming edges)
    const nodesWithIncoming = new Set(graph.edges.map(e => e.target));
    const startNodes = graph.nodes.filter(n => !nodesWithIncoming.has(n.id));

    if (startNodes.length === 0 && graph.nodes.length > 0) {
      // No clear start nodes, try first node
      queue.push(graph.nodes[0].id);
    } else {
      queue.push(...startNodes.map(n => n.id));
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetNodeId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      // Add all outgoing targets
      const outgoing = graph.edges.filter(e => e.source === current);
      outgoing.forEach(edge => {
        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      });
    }

    return false;
  }

  /**
   * Detect all narrative conflicts
   */
  static detectConflicts(graph: VNGraph): NarrativeConflict[] {
    const conflicts: NarrativeConflict[] = [];

    // 1. Unreachable nodes
    graph.nodes.forEach(node => {
      if (!this.isNodeReachable(node.id, graph)) {
        conflicts.push({
          id: `unreachable-${node.id}`,
          type: 'unreachable',
          severity: 'warning',
          nodeIds: [node.id],
          message: `节点 "${node.label}" 无法从任何起点到达`,
          suggestion: '添加入边或删除此节点'
        });
      }
    });

    // 2. Dead ends (non-END nodes with no outgoing edges)
    graph.nodes.forEach(node => {
      const hasOutgoing = graph.edges.some(e => e.source === node.id);
      const nodesWithIncoming = new Set(graph.edges.map(e => e.target));
      const isEndNode = !nodesWithIncoming.has(node.id);

      if (!hasOutgoing && !isEndNode && !node.isPoolMember) {
        conflicts.push({
          id: `deadend-${node.id}`,
          type: 'dead_end',
          severity: 'warning',
          nodeIds: [node.id],
          message: `节点 "${node.label}" 没有出边（剧情死胡同）`,
          suggestion: '添加出边或将其标记为结局'
        });
      }
    });

    // 3. Contradictory preconditions
    const nodesWithContradictions = this.findContradictoryPreconditions(graph);
    nodesWithContradictions.forEach(({ nodeId, contradictions }) => {
      const node = graph.nodes.find(n => n.id === nodeId);
      conflicts.push({
        id: `contradiction-${nodeId}`,
        type: 'contradictory',
        severity: 'error',
        nodeIds: [nodeId],
        message: `节点 "${node?.label || nodeId}" 有矛盾的前置条件: ${contradictions.join(', ')}`,
        suggestion: '删除或修改冲突的条件'
      });
    });

    // 4. Edge-level contradictory conditions
    const edgesWithContradictions = this.findEdgeContradictions(graph);
    edgesWithContradictions.forEach(({ edgeId, contradictions }) => {
      const edge = graph.edges.find(e => e.id === edgeId);
      conflicts.push({
        id: `edge-contradiction-${edgeId}`,
        type: 'contradictory',
        severity: 'error',
        edgeIds: [edgeId],
        nodeIds: [edge?.source || '', edge?.target || ''],
        message: `连线有矛盾的条件: ${contradictions.join(', ')}`,
        suggestion: '删除或修改冲突的条件'
      });
    });

    return conflicts;
  }

  /**
   * Find nodes with mutually exclusive preconditions
   */
  private static findContradictoryPreconditions(graph: VNGraph): Array<{
    nodeId: string;
    contradictions: string[];
  }> {
    const results: Array<{ nodeId: string; contradictions: string[] }> = [];

    graph.nodes.forEach(node => {
      const byVariable = new Map<string, VNCondition[]>();

      // Group conditions by variable
      node.preconditions.forEach(cond => {
        if (!byVariable.has(cond.variableId)) {
          byVariable.set(cond.variableId, []);
        }
        byVariable.get(cond.variableId)!.push(cond);
      });

      // Check for contradictions
      const contradictions: string[] = [];
      byVariable.forEach((conds, varId) => {
        if (conds.length >= 2) {
          // Check if any pair is contradictory
          for (let i = 0; i < conds.length; i++) {
            for (let j = i + 1; j < conds.length; j++) {
              if (this.areConditionsContradictory(conds[i], conds[j])) {
                contradictions.push(
                  `${varId} ${conds[i].operator} ${conds[i].value} 与 ${conds[j].operator} ${conds[j].value}`
                );
              }
            }
          }
        }
      });

      if (contradictions.length > 0) {
        results.push({ nodeId: node.id, contradictions });
      }
    });

    return results;
  }

  /**
   * Find edges with contradictory conditions
   */
  private static findEdgeContradictions(graph: VNGraph): Array<{
    edgeId: string;
    contradictions: string[];
  }> {
    const results: Array<{ edgeId: string; contradictions: string[] }> = [];

    graph.edges.forEach(edge => {
      if (!edge.conditions || edge.conditions.length === 0) return;

      const byVariable = new Map<string, VNCondition[]>();
      edge.conditions.forEach(cond => {
        if (!byVariable.has(cond.variableId)) {
          byVariable.set(cond.variableId, []);
        }
        byVariable.get(cond.variableId)!.push(cond);
      });

      const contradictions: string[] = [];
      byVariable.forEach((conds, varId) => {
        if (conds.length >= 2) {
          for (let i = 0; i < conds.length; i++) {
            for (let j = i + 1; j < conds.length; j++) {
              if (this.areConditionsContradictory(conds[i], conds[j])) {
                contradictions.push(
                  `${varId} ${conds[i].operator} ${conds[i].value} 与 ${conds[j].operator} ${conds[j].value}`
                );
              }
            }
          }
        }
      });

      if (contradictions.length > 0) {
        results.push({ edgeId: edge.id, contradictions });
      }
    });

    return results;
  }

  /**
   * Check if two conditions are mutually exclusive
   */
  private static areConditionsContradictory(c1: VNCondition, c2: VNCondition): boolean {
    if (c1.variableId !== c2.variableId) return false;

    // Same value with == and != is contradictory
    if (c1.value === c2.value) {
      if ((c1.operator === '==' && c2.operator === '!=') ||
        (c1.operator === '!=' && c2.operator === '==')) {
        return true;
      }
    }

    // Numeric ranges
    if (typeof c1.value === 'number' && typeof c2.value === 'number') {
      // c1: x > 10, c2: x < 10 (strictly contradictory)
      if (c1.operator === '>' && c2.operator === '<' && c1.value >= c2.value) return true;
      if (c1.operator === '<' && c2.operator === '>' && c1.value <= c2.value) return true;
      // c1: x >= 10, c2: x < 10
      if (c1.operator === '>=' && c2.operator === '<' && c1.value >= c2.value) return true;
      if (c1.operator === '<' && c2.operator === '>=' && c1.value <= c2.value) return true;
    }

    return false;
  }
}
