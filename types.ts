
// Simplified: All nodes are SCENE nodes now
export enum NodeType {
  SCENE = 'SCENE'       // Universal scene node (all nodes are scenes)
}

// Dynamic classification based on connections
export enum SceneCategory {
  STANDARD = 'STANDARD',   // Has both incoming and outgoing edges
  FREE = 'FREE',          // No incoming, no outgoing (isolated)
  START = 'START',        // Only outgoing edges, no incoming
  END = 'END',            // Only incoming edges, no outgoing
  BRANCH = 'BRANCH'       // v0.3: Branch narrative (choice-specific storyline)
}

export enum EdgeType {
  FLOW = 'FLOW',        // Default sequence
  OPTION = 'OPTION',    // Linked to a specific choice in a Scene
  TRIGGER = 'TRIGGER',
  CONSTRAINT = 'CONSTRAINT'
}

export interface VNVariable {
  id: string;
  name: string;
  type: 'boolean' | 'number' | 'string';
  defaultValue: any;
  currentValue: any;
  min?: number;
  max?: number;
}

export interface VNCondition {
  variableId: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  value: any;
}

export interface VNEffect {
  variableId: string;
  operation: 'set' | 'add' | 'subtract' | 'toggle';
  value: any;
}

export interface VNChoiceOption {
  id: string;
  text: string;
  targetId?: string; // Target scene or logic node
  conditions: VNCondition[];
  effects: VNEffect[];
}

export interface VNNodePosition {
  x: number;
  y: number;
}

export interface VNNodeData {
  id: string;
  label: string;
  type: NodeType;
  content?: string;      // Narrative text
  location?: string;
  preconditions: VNCondition[];
  effects: VNEffect[];
  options?: VNChoiceOption[]; // Internal choices
  mutexGroup?: string;
  priority?: number;
  tags: string[];
  isPoolMember?: boolean;
  position?: VNNodePosition;

  // v0.2 New properties
  hasChoice?: boolean;     // Whether this scene contains player choices
  groupFrame?: string;     // Group frame for story pool/chunk planning (reserved for future use)

  // v0.3 New properties
  isBranch?: boolean;      // Whether this is a branch narrative (choice-specific storyline)
  branchChoiceIndex?: number; // Which choice index this branch corresponds to (0-based)
}

export interface VNGraph {
  nodes: VNNodeData[];
  edges: {
    id: string;
    source: string;
    target: string;
    type: EdgeType;
    label?: string;
    weight?: number; // Used by POOL for scheduling
  }[];
  variables: VNVariable[];
  pools: {
    id: string;
    name: string;
    memberIds: string[];
    cooldown: number;
    weightPolicy: 'uniform' | 'weighted';
  }[];
}

export interface HistorySnapshot {
  id: string;
  timestamp: number;
  label: string;
  graph: VNGraph;
  prompt?: string;
}
