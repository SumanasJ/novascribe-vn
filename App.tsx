
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import NodePalette from './components/NodePalette';
import PropertyEditor from './components/PropertyEditor';
import Simulator from './components/Simulator';
import VariableManager from './components/VariableManager';
import LocationView from './components/LocationView';
import DatabaseView from './components/DatabaseView';
import { VNGraph, NodeType, VNNodeData, EdgeType, VNVariable, VNNodePosition, HistorySnapshot, SceneCategory } from './types';
import { INITIAL_GRAPH, getSceneCategory, SCENE_CATEGORY_COLORS, SCENE_CATEGORY_LABELS } from './constants';
import {
  Play,
  BrainCircuit,
  Zap,
  Trash2,
  Sparkles,
  MapPin,
  Plus,
  Minus,
  Maximize2,
  GitGraph,
  LayoutTemplate,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Map as MapIcon,
  Database,
  History,
  Save,
  Clock,
  ArrowLeft,
  X,
  Link as LinkIcon,
  Wand2,
  Settings2,
  Download,
  Upload,
  FileJson
} from 'lucide-react';
import { GeminiService, TreeGenConfig } from './services/geminiService';
import { OpenAIService } from './services/openaiService';

const NODE_WIDTH = 256;
const NODE_HEIGHT = 160;
const TREE_SPACING_X = 350;
const TREE_SPACING_Y = 220;
const HISTORY_KEY = 'novascribe_history_v1';
const SETTINGS_KEY = 'novascribe_settings_v1';

type ViewMode = 'canvas' | 'tree' | 'map' | 'database' | 'history';

interface AppSettings {
  aiModel: string;
  aiApiKey: string;
  aiPrompt: string;
  aiConfig: TreeGenConfig;
}

const App: React.FC = () => {
  const [graph, setGraph] = useState<VNGraph>(INITIAL_GRAPH);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  // v0.3: AI Provider configuration
  // v0.4: Read default model from environment variable
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState(() => {
    // Try to get from environment variable, fallback to default
    return (typeof process !== 'undefined' && process.env.DEFAULT_AI_MODEL) || "gemini-2.5-flash";
  });
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null);
  const [nodeCustomPrompt, setNodeCustomPrompt] = useState("");
  const [showNodePromptInput, setShowNodePromptInput] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [aiConfig, setAiConfig] = useState<TreeGenConfig>({
    branchPoints: 3,
    optionsPerNode: 2,
    minDepth: 3,
    maxDepth: 5
  });
  
  // History State
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  
  // Viewport State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Interaction State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Create service instances with dynamic API key
  const gemini = useMemo(() => new GeminiService(), []);
  const openai = useMemo(() => new OpenAIService(), []);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNode = useMemo(() => 
    graph.nodes.find(n => n.id === selectedNodeId) || null
  , [graph.nodes, selectedNodeId]);

  const selectedEdge = useMemo(() => 
    graph.edges.find(e => e.id === selectedEdgeId) || null
  , [graph.edges, selectedEdgeId]);

  // Physical Deletion Handlers
  const handleDeleteEdge = useCallback((id: string) => {
    setGraph(prev => ({
      ...prev,
      edges: prev.edges.filter(e => e.id !== id)
    }));
    if (selectedEdgeId === id) setSelectedEdgeId(null);
  }, [selectedEdgeId]);

  const handleDeleteNode = useCallback((id: string) => {
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.source !== id && e.target !== id)
    }));
    if (selectedNodeId === id) setSelectedNodeId(null);
  }, [selectedNodeId]);

  const handleUpdateNode = useCallback((updated: VNNodeData) => {
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === updated.id ? updated : n)
    }));
  }, []);

  // Keyboard support for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) handleDeleteNode(selectedNodeId);
        else if (selectedEdgeId) handleDeleteEdge(selectedEdgeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, handleDeleteNode, handleDeleteEdge]);

  // Initialize and persist History
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) try { setHistory(JSON.parse(saved)); } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const saveSnapshot = useCallback((label: string, customGraph?: VNGraph) => {
    const targetGraph = customGraph || graph;
    const snapshot: HistorySnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label,
      graph: JSON.parse(JSON.stringify(targetGraph)),
      prompt: aiPrompt || undefined
    };
    setHistory(prev => [snapshot, ...prev].slice(0, 50));
  }, [graph, aiPrompt]);

  const restoreSnapshot = (snapshot: HistorySnapshot) => {
    if (confirm(`确定要恢复到版本 "${snapshot.label}" 吗？`)) {
      setGraph(snapshot.graph);
      if (snapshot.prompt) setAiPrompt(snapshot.prompt);
      setViewMode('tree');
    }
  };

  // v0.4: Export story to JSON file
  const handleExportStory = useCallback(() => {
    const exportData = {
      version: '0.4.0',
      exportedAt: new Date().toISOString(),
      graph: graph,
      aiPrompt: aiPrompt,
      settings: {
        aiModel: aiModel,
        aiConfig: aiConfig
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novascribe-story-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [graph, aiPrompt, aiModel, aiConfig]);

  // v0.4: Import story from JSON file
  const handleImportStory = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        // Validate the structure
        if (!importData.graph || !importData.graph.nodes || !importData.graph.edges) {
          throw new Error('Invalid story file structure');
        }

        if (confirm(`确定要导入故事文件吗？当前的故事将被替换。\n\n文件版本: ${importData.version || '未知'}\n导出时间: ${importData.exportedAt || '未知'}`)) {
          setGraph(importData.graph);
          if (importData.aiPrompt) setAiPrompt(importData.aiPrompt);
          if (importData.settings?.aiModel) setAiModel(importData.settings.aiModel);
          if (importData.settings?.aiConfig) setAiConfig(importData.settings.aiConfig);
          saveSnapshot('导入故事文件', importData.graph);
          setViewMode('tree');
        }
      } catch (error: any) {
        alert(`导入失败：${error.message || '文件格式错误'}`);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be imported again
    event.target.value = '';
  }, [saveSnapshot]);

  // v0.4: Save settings to localStorage
  const saveSettings = useCallback(() => {
    const settings: AppSettings = {
      aiModel,
      aiApiKey,
      aiPrompt,
      aiConfig
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [aiModel, aiApiKey, aiPrompt, aiConfig]);

  // v0.4: Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const settings: AppSettings = JSON.parse(saved);
        if (settings.aiModel) setAiModel(settings.aiModel);
        if (settings.aiApiKey) setAiApiKey(settings.aiApiKey);
        if (settings.aiPrompt) setAiPrompt(settings.aiPrompt);
        if (settings.aiConfig) setAiConfig(settings.aiConfig);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  // v0.4: Auto-save settings when they change
  useEffect(() => {
    saveSettings();
  }, [saveSettings]);

  // Tree Layout calculation logic
  const treeLayout = useMemo(() => {
    const positions: Record<string, VNNodePosition> = {};
    const depths: Record<string, number> = {};
    const visited = new Set<string>();
    const queue: { id: string; depth: number }[] = [];

    const treeNodes = graph.nodes.filter(n => !n.isPoolMember);
    const treeEdges = graph.edges.filter(e => {
      const s = graph.nodes.find(n => n.id === e.source);
      const t = graph.nodes.find(n => n.id === e.target);
      return s && t && !s.isPoolMember && !t.isPoolMember;
    });

    // v0.2: Find root nodes dynamically (nodes without incoming edges)
    const nodesWithIncoming = new Set(treeEdges.map(e => e.target));
    const rootNodes = treeNodes.filter(n => !nodesWithIncoming.has(n.id));

    if (rootNodes.length === 0 && treeNodes.length > 0) queue.push({ id: treeNodes[0].id, depth: 0 });
    else rootNodes.forEach(rn => queue.push({ id: rn.id, depth: 0 }));

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      depths[id] = Math.max(depths[id] || 0, depth);
      treeEdges.filter(e => e.source === id).forEach(e => queue.push({ id: e.target, depth: depth + 1 }));
    }

    treeNodes.forEach(n => { if (!visited.has(n.id)) depths[n.id] = 0; });
    const depthGroups: Record<number, string[]> = {};
    treeNodes.forEach(n => {
      const d = depths[n.id] || 0;
      if (!depthGroups[d]) depthGroups[d] = [];
      depthGroups[d].push(n.id);
    });

    Object.entries(depthGroups).forEach(([depth, ids]) => {
      const d = parseInt(depth);
      const totalHeight = (ids.length - 1) * TREE_SPACING_Y;
      ids.forEach((id, index) => {
        positions[id] = {
          x: d * TREE_SPACING_X + 100,
          y: index * TREE_SPACING_Y - totalHeight / 2 + 400
        };
      });
    });
    return positions;
  }, [graph.nodes, graph.edges]);

  // Permanently apply tree layout to canvas positions
  const handleAutoLayout = useCallback(() => {
    if (confirm('确定要根据树状结构自动重新排列 Canvas 中的节点位置吗？')) {
      setGraph(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => {
          const treePos = treeLayout[n.id];
          if (treePos) return { ...n, position: treePos };
          return n;
        })
      }));
      saveSnapshot('自动排版');
    }
  }, [treeLayout, saveSnapshot]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    // Handle node dragging
    if (draggingNodeId && viewMode === 'canvas') {
      setGraph(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === draggingNodeId ? {
          ...n,
          position: {
            x: (n.position?.x || 0) + e.movementX / zoom,
            y: (n.position?.y || 0) + e.movementY / zoom
          }
        } : n)
      }));
    }

    // Handle canvas panning
    if (isPanning) {
      setPan(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  }, [draggingNodeId, zoom, viewMode, isPanning]);

  const handleMouseUp = useCallback(() => {
    setDraggingNodeId(null);
    setIsPanning(false);
    // End connection if we release the mouse but not on a target node
    if (connectingSourceId) {
      setConnectingSourceId(null);
    }
  }, [connectingSourceId]);

  const handleMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingNodeId(id);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleWheel = (e: React.WheelEvent) => {
    if (['map', 'database', 'history'].includes(viewMode)) return;
    if (e.ctrlKey) setZoom(z => Math.min(Math.max(z - e.deltaY * 0.001, 0.3), 2));
    else setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
  };

  const startConnection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setConnectingSourceId(id);
  };

  // Reconnection logic: drag from the target end circle to start a new connection draft
  const handleReconnectTarget = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const edge = graph.edges.find(e => e.id === edgeId);
    if (!edge) return;
    const sourceId = edge.source;
    setGraph(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== edgeId) }));
    setConnectingSourceId(sourceId);
  };

  // v0.2: Reconnection from source end - keep the target and find new source
  const handleReconnectSource = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const edge = graph.edges.find(e => e.id === edgeId);
    if (!edge) return;
    // Delete the edge and let user create new one
    setGraph(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== edgeId) }));
    // Set a flag to indicate we're reconnecting from source (need to connect to target)
    setConnectingSourceId(edge.target);
  };

  const endConnection = (targetId: string) => {
    if (connectingSourceId && connectingSourceId !== targetId) {
      const sourceNode = graph.nodes.find(n => n.id === connectingSourceId);
      const exists = graph.edges.some(e => e.source === connectingSourceId && e.target === targetId);
      if (!exists) {
        setGraph(prev => ({
          ...prev,
          edges: [...prev.edges, {
            id: `e${Date.now()}`,
            source: connectingSourceId!,
            target: targetId,
            type: sourceNode?.hasChoice ? EdgeType.OPTION : EdgeType.FLOW,
          }]
        }));
      }
    }
    setConnectingSourceId(null);
  };

  const handleAddNode = (type: NodeType, location?: string, pos?: { x: number, y: number }) => {
    const id = `n${Date.now()}`;
    const newNode: VNNodeData = {
      id,
      label: `新建剧情节点`,
      type: NodeType.SCENE, // v0.2: Always SCENE
      location: location || '未命名区域',
      preconditions: [],
      effects: [],
      tags: [],
      options: [],
      isPoolMember: false,
      hasChoice: false, // v0.2: New property
      groupFrame: '', // v0.2: New property
      position: pos || { x: -pan.x / zoom + 200, y: -pan.y / zoom + 200 }
    };
    setGraph(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const handleBrainstorm = async () => {
    if (!aiPrompt) return;
    setIsBrainstorming(true); setAiError(null);
    try {
      // v0.3: Determine service based on aiModel
      const isGemini = aiModel.startsWith('gemini');
      const service = isGemini ? gemini : openai;

      console.log('[AI Brainstorm] Starting full story generation...');
      console.log('[AI Brainstorm] Model:', aiModel);
      console.log('[AI Brainstorm] Has API Key:', !!aiApiKey);
      console.log('[AI Brainstorm] Config:', aiConfig);

      // Pass API key directly to service
      const result = await service.brainstormStructure(aiPrompt, aiConfig, aiModel, aiApiKey || undefined);

      console.log('[AI Brainstorm] Result received:', result ? 'Success' : 'Failed');

      if (!result) {
        throw new Error('API 返回了空结果');
      }

      if (result.nodes && result.nodes.length > 0) {
        const newGraph: VNGraph = {
          nodes: (result.nodes as any[]).map((n, i) => {
            if (!n) {
              console.error('[AI Brainstorm] Invalid node at index', i);
              return null;
            }
            return {
              ...n,
              // v0.2: Convert all nodes to SCENE type
              type: NodeType.SCENE,
              // Determine hasChoice based on options
              hasChoice: !!(n.options && n.options.length > 0),
              location: n.location || '新区域',
              preconditions: n.preconditions || [],
              effects: n.effects || [],
              tags: n.tags || [],
              options: n.options || [],
              isPoolMember: !!n.isPoolMember,
              groupFrame: n.groupFrame || '',
              position: n.position || { x: i * 350 + 50, y: 150 }
            };
          }).filter((n): n is VNNodeData => n !== null),
          edges: (result.edges as any[]) || [],
          variables: (result.variables as any[]) || graph.variables,
          pools: []
        };
        setGraph(newGraph);
        saveSnapshot(`AI 生成: ${aiPrompt.slice(0, 10)}...`, newGraph);
        if (result.nodes[0]?.id) setSelectedNodeId(result.nodes[0].id);
      } else {
        throw new Error('API 未返回任何节点');
      }
    } catch (err: any) {
      console.error('[AI Brainstorm] Error:', err);
      console.error('[AI Brainstorm] Error details:', {
        message: err?.message,
        status: err?.status,
        statusCode: err?.statusCode,
        cause: err?.cause
      });

      let errorMsg = 'AI 引擎遇到错误';
      if (err?.message) {
        if (err.message.includes('API key') || err.message.includes('401')) {
          errorMsg = 'API Key 无效或未设置，请检查 API 设置';
        } else if (err.message.includes('Connection') || err.message.includes('network') || err.message.includes('fetch')) {
          errorMsg = '网络连接失败，请检查网络设置';
        } else if (err.message.includes('rate limit') || err.message.includes('quota') || err.message.includes('429')) {
          errorMsg = 'API 配额已用完或达到速率限制';
        } else {
          errorMsg = `生成失败: ${err.message}`;
        }
      }
      setAiError(errorMsg);
    } finally { setIsBrainstorming(false); }
  };

  // v0.3: Generate single node content with AI
  const handleGenerateNode = async (nodeId: string, customPrompt?: string) => {
    setGeneratingNodeId(nodeId);
    setAiError(null);
    try {
      const isGemini = aiModel.startsWith('gemini');
      const service = isGemini ? gemini : openai;

      console.log('[AI Generation] Starting node content generation...');
      console.log('[AI Generation] Node ID:', nodeId);
      console.log('[AI Generation] Model:', aiModel);
      console.log('[AI Generation] Has API Key:', !!aiApiKey);
      console.log('[AI Generation] Story prompt:', aiPrompt ? aiPrompt.slice(0, 100) : '(empty)');
      console.log('[AI Generation] Custom prompt:', customPrompt || '(none)');

      // Pass API key and custom prompt directly to service method
      const result = await service.generateNodeContent(
        nodeId,
        graph,
        aiPrompt,
        aiModel,
        aiApiKey || undefined,
        customPrompt
      );

      console.log('[AI Generation] Result received:', result);

      // Update node with generated content
      const node = graph.nodes.find(n => n.id === nodeId);
      if (node && result) {
        const updated: VNNodeData = {
          ...node,
          label: result.label || node.label,
          content: result.content || node.content,
          location: result.location || node.location,
          hasChoice: result.hasChoice ?? node.hasChoice,
          preconditions: result.preconditions || node.preconditions,
          effects: result.effects || node.effects,
          isPoolMember: result.isPoolMember ?? node.isPoolMember
        };
        console.log('[AI Generation] Updating node:', updated);
        handleUpdateNode(updated);
        console.log('[AI Generation] Node updated successfully');
      } else {
        console.error('[AI Generation] Failed to update node - node or result is empty');
        setAiError('生成结果为空，请重试');
      }
    } catch (err: any) {
      console.error('[AI Generation] Error:', err);
      console.error('[AI Generation] Error details:', {
        message: err?.message,
        status: err?.status,
        cause: err?.cause
      });

      let errorMsg = '节点内容生成失败';
      if (err?.message) {
        if (err.message.includes('API key') || err.message.includes('401')) {
          errorMsg = 'API Key 无效或未设置，请检查 API 设置';
        } else if (err.message.includes('Connection') || err.message.includes('network') || err.message.includes('fetch')) {
          errorMsg = '网络连接失败，请检查网络设置';
        } else if (err.message.includes('rate limit') || err.message.includes('quota') || err.message.includes('429')) {
          errorMsg = 'API 配额已用完或达到速率限制';
        } else {
          errorMsg = `生成失败: ${err.message}`;
        }
      }
      setAiError(errorMsg);
    } finally {
      setGeneratingNodeId(null);
    }
  };

  const renderDraftEdge = () => {
    if (!connectingSourceId || !canvasRef.current) return null;
    const source = graph.nodes.find(n => n.id === connectingSourceId);
    const pos = viewMode === 'tree' ? treeLayout[connectingSourceId] : source?.position;
    if (!pos) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = pos.x + NODE_WIDTH;
    const startY = pos.y + NODE_HEIGHT / 2;
    const endX = (mousePos.x - rect.left - pan.x) / zoom;
    const endY = (mousePos.y - rect.top - pan.y) / zoom;
    return <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#6366f1" strokeWidth="3" strokeDasharray="5,5" className="animate-pulse pointer-events-none" />;
  };

  const renderEdges = () => {
    return graph.edges.map(edge => {
      const source = graph.nodes.find(n => n.id === edge.source);
      const target = graph.nodes.find(n => n.id === edge.target);
      if (!source || !target) return null;
      const sPos = viewMode === 'tree' ? treeLayout[source.id] : source.position;
      const tPos = viewMode === 'tree' ? treeLayout[target.id] : target.position;
      if (!sPos || !tPos) return null;

      const startX = sPos.x + NODE_WIDTH;
      const startY = sPos.y + NODE_HEIGHT / 2;
      const endX = tPos.x;
      const endY = tPos.y + NODE_HEIGHT / 2;
      const cp1X = startX + Math.abs(endX - startX) / 2;
      const cp2X = endX - Math.abs(endX - startX) / 2;

      const isSelected = selectedEdgeId === edge.id;
      const isEndpointSelected = selectedNodeId === edge.source || selectedNodeId === edge.target;
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;

      return (
        <g key={edge.id} className="group">
          {/* Hit Area for easy selection */}
          <path
            d={`M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`}
            fill="none" stroke="transparent" strokeWidth="25" className="cursor-pointer pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
          />
          {/* Main Visual Path */}
          <path
            d={`M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`}
            fill="none"
            stroke={isSelected ? '#6366f1' : isEndpointSelected ? '#6366f1' : '#334155'}
            strokeWidth={isSelected ? "5" : isEndpointSelected ? "3.5" : "2.5"}
            className="transition-all group-hover:stroke-indigo-400 cursor-pointer pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
          />

          {/* v0.2: Source End Circle - for reconnecting from source */}
          <circle
            cx={startX} cy={startY} r="7"
            fill={isSelected || isEndpointSelected ? "#6366f1" : "#334155"}
            className="cursor-crosshair hover:scale-150 transition-transform pointer-events-auto"
            onMouseDown={(e) => handleReconnectSource(edge.id, e)}
            title="拖拽以重新连接源节点"
          />

          {/* Target End Circle - used for reconnection drag */}
          <circle
            cx={endX} cy={endY} r="7"
            fill={isSelected || isEndpointSelected ? "#6366f1" : "#334155"}
            className="cursor-crosshair hover:scale-150 transition-transform pointer-events-auto"
            onMouseDown={(e) => handleReconnectTarget(edge.id, e)}
            title="拖拽以重新连接目标节点"
          />

          {/* Edge Delete Button (Only visible when selected) */}
          {isSelected && (
            <g
              transform={`translate(${midX}, ${midY})`}
              className="cursor-pointer pointer-events-auto"
              onClick={(e) => { e.stopPropagation(); handleDeleteEdge(edge.id); }}
            >
              <circle r="15" fill="#e11d48" className="shadow-2xl" />
              <line x1="-5" y1="-5" x2="5" y2="5" stroke="white" strokeWidth="3" />
              <line x1="-5" y1="5" x2="5" y2="-5" stroke="white" strokeWidth="3" />
            </g>
          )}
        </g>
      );
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none font-sans">
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap size={18} fill="white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">NovaScribe <span className="text-slate-500 font-normal">Architect</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-800/80 p-1 rounded-lg border border-slate-700 flex gap-1">
             <button onClick={() => { setViewMode('canvas'); setSelectedEdgeId(null); }} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${viewMode === 'canvas' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}><LayoutTemplate size={12} className="inline mr-1" /> CANVAS</button>
             <button onClick={() => { setViewMode('tree'); setSelectedEdgeId(null); }} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${viewMode === 'tree' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}><GitGraph size={12} className="inline mr-1" /> TREE</button>
             <button onClick={() => { setViewMode('map'); setSelectedEdgeId(null); }} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}><MapIcon size={12} className="inline mr-1" /> MAP</button>
             <button onClick={() => { setViewMode('database'); setSelectedEdgeId(null); }} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${viewMode === 'database' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}><Database size={12} className="inline mr-1" /> DB</button>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <button onClick={() => setViewMode('history')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400" title="历史快照"><History size={18}/></button>
          <button onClick={() => saveSnapshot(`快照 ${new Date().toLocaleTimeString()}`)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400" title="保存快照"><Save size={18}/></button>
          <button onClick={handleExportStory} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400" title="导出故事"><Download size={18}/></button>
          <label className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer" title="导入故事">
            <Upload size={18}/>
            <input
              type="file"
              accept=".json"
              onChange={handleImportStory}
              className="hidden"
            />
          </label>
          <div className="h-6 w-px bg-slate-800" />
          <button onClick={() => setIsSimulating(true)} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm font-semibold transition-all"><Play size={16} fill="currentColor" className="inline mr-2" /> RUN</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* History Overlay */}
        {viewMode === 'history' && (
          <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col p-12 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full space-y-4">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black flex items-center gap-3"><Clock className="text-indigo-400"/> 版本历史</h2>
                <button onClick={() => setViewMode('tree')} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
              </div>
              {history.map(snap => (
                <div key={snap.id} onClick={() => restoreSnapshot(snap)} className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl hover:border-indigo-500 cursor-pointer flex justify-between items-center group">
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-indigo-400">{snap.label}</h3>
                    <p className="text-xs text-slate-500 mt-1">{new Date(snap.timestamp).toLocaleString()} • {snap.graph.nodes.length} 节点</p>
                  </div>
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-all">恢复此版本</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <aside className="w-72 border-r border-slate-800 bg-slate-900/40 backdrop-blur-sm flex flex-col z-30 overflow-y-auto custom-scrollbar">
          <NodePalette onAddNode={handleAddNode} />
          <div className="p-4 border-t border-slate-800 space-y-4">
             <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-indigo-400">
                <div className="flex items-center gap-2"><Sparkles size={16} /><span className="text-[10px] font-bold uppercase">AI 剧情引擎</span></div>
                <div className="flex gap-1">
                  <button onClick={() => setShowApiSettings(!showApiSettings)} className="p-1 hover:bg-white/10 rounded" title="API 设置"><Settings2 size={14}/></button>
                  <button onClick={() => setShowAiConfig(!showAiConfig)} className="p-1 hover:bg-white/10 rounded">{showAiConfig ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</button>
                </div>
              </div>

              {/* API Settings Panel */}
              {showApiSettings && (
                <div className="space-y-3 p-3 bg-slate-950/50 rounded-lg border border-slate-700">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AI 模型</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">API Key (可选)</label>
                    <input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder="留空使用环境变量"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                    />
                  </div>
                  <div className="text-[9px] text-slate-600 italic">
                    当前模型: <span className="text-indigo-400 font-bold">{aiModel}</span>
                  </div>
                </div>
              )}

              {showAiConfig && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>分支: {aiConfig.branchPoints} <input type="range" min="1" max="10" value={aiConfig.branchPoints} onChange={e => setAiConfig({...aiConfig, branchPoints: +e.target.value})} className="w-full h-1 accent-indigo-500" /></div>
                  <div>层级: {aiConfig.maxDepth} <input type="range" min="1" max="10" value={aiConfig.maxDepth} onChange={e => setAiConfig({...aiConfig, maxDepth: +e.target.value})} className="w-full h-1 accent-indigo-500" /></div>
                </div>
              )}
              <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="输入剧情梗概..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs h-24 focus:outline-none focus:border-indigo-500 resize-none" />
              <button onClick={handleBrainstorm} disabled={isBrainstorming || !aiPrompt} className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                {isBrainstorming ? <RefreshCw className="animate-spin" size={14} /> : <BrainCircuit size={14} />} 生成剧情
              </button>
              {/* Error message display */}
              {aiError && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={12} />
                    <span className="font-bold">错误</span>
                  </div>
                  <p className="mt-1">{aiError}</p>
                </div>
              )}
            </div>
          </div>
          {/* 变量管理器 - 滚动到底部可见 */}
          <VariableManager variables={graph.variables} onUpdate={(vars) => setGraph(g => ({ ...g, variables: vars }))} />
        </aside>

        <section
          ref={canvasRef}
          className="flex-1 relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] overflow-hidden cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
          onMouseDown={(e) => {
            // Start panning if clicking on empty space (not on a node)
            if (e.target === e.currentTarget && !connectingSourceId) {
              setIsPanning(true);
              setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }
          }}
        >
          {viewMode === 'map' ? (
            <LocationView graph={graph} onSelectNode={setSelectedNodeId} onUpdateNode={handleUpdateNode} onDeleteNode={handleDeleteNode} onAddNodeAtLocation={(loc, pos) => handleAddNode(NodeType.SCENE, loc, pos)} selectedNodeId={selectedNodeId} />
          ) : viewMode === 'database' ? (
            <DatabaseView graph={graph} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} onUpdateNode={handleUpdateNode} onDeleteNode={handleDeleteNode} onAddNode={handleAddNode} />
          ) : (
            <>
              <div className="absolute inset-0 transition-all duration-300 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
                <svg className="absolute inset-0 w-[10000px] h-[10000px] pointer-events-none overflow-visible">
                  {renderEdges()}
                  {renderDraftEdge()}
                </svg>
                {graph.nodes.map((node) => {
                  const pos = viewMode === 'tree' ? treeLayout[node.id] : node.position;
                  if (!pos) return null;
                  const isSelected = selectedNodeId === node.id;

                  // v0.2: Dynamic scene category based on connections
                  const category = getSceneCategory(node.id, graph);
                  const categoryColor = SCENE_CATEGORY_COLORS[category];
                  const categoryLabel = SCENE_CATEGORY_LABELS[category];

                  return (
                    <div
                      key={node.id}
                      onMouseDown={(e) => handleMouseDown(node.id, e)}
                      onMouseUp={() => connectingSourceId && endConnection(node.id)}
                      style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
                      className={`absolute p-5 rounded-2xl border-2 transition-all duration-300 z-10 ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-slate-900' : 'border-slate-800 bg-slate-900/60'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border border-slate-700 ${node.isPoolMember ? 'text-fuchsia-400' : categoryColor.replace('bg-', 'text-')}`}>
                          {categoryLabel}
                          {node.hasChoice && ' + 选项'}
                        </span>
                        <div className="text-[9px] text-slate-500 flex items-center gap-1"><MapPin size={10}/>{node.location || '未知'}</div>
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 truncate">{node.label}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-3 italic mt-1">{node.content || "..."}</p>

                      {/* v0.3: AI Generate Button for single node */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateNode(node.id);
                        }}
                        disabled={generatingNodeId === node.id}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600/20 to-fuchsia-600/20 hover:from-indigo-600/40 hover:to-fuchsia-600/40 border border-indigo-500/30 text-indigo-300"
                        title="根据相邻节点和剧情梗概AI生成此节点内容（可在右侧面板添加自定义提示词）"
                      >
                        {generatingNodeId === node.id ? (
                          <>
                            <RefreshCw size={10} className="animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Wand2 size={10} />
                            AI 生成
                          </>
                        )}
                      </button>

                      {/* v0.2: Enhanced connection points with clear visual distinction */}
                      {/* Input Port (Left) - Triangle pointing left */}
                      <div
                        onMouseDown={(e) => startConnection(node.id, e)}
                        className="absolute -left-3 top-1/2 -translate-y-1/2 w-0 h-0 cursor-crosshair hover:scale-125 transition-transform z-20"
                        style={{
                          borderTop: '8px solid transparent',
                          borderBottom: '8px solid transparent',
                          borderRight: '12px solid #3b82f6', // Blue for input
                          filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))'
                        }}
                        title="输入端口 - 拖拽可连线"
                      />

                      {/* Output Port (Right) - Triangle pointing right */}
                      <div
                        onMouseDown={(e) => startConnection(node.id, e)}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 w-0 h-0 cursor-crosshair hover:scale-125 transition-transform z-20"
                        style={{
                          borderTop: '8px solid transparent',
                          borderBottom: '8px solid transparent',
                          borderLeft: '12px solid #10b981', // Green for output
                          filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.5))'
                        }}
                        title="输出端口 - 拖拽可连线"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Action FABs */}
              <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-3">
                <div className="bg-slate-900/90 border border-slate-700 p-2 rounded-2xl shadow-2xl flex flex-col gap-1">
                  <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><Plus size={20}/></button>
                  <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><Minus size={20}/></button>
                  <button onClick={() => { setZoom(1); setPan({x:0,y:0}); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><Maximize2 size={20}/></button>
                </div>
                <button 
                  onClick={handleAutoLayout}
                  className="bg-indigo-600 hover:bg-indigo-500 p-4 rounded-2xl text-white shadow-2xl transition-all active:scale-95 group flex items-center gap-2"
                  title="自动排版 (Sync Tree to Canvas)"
                >
                  <Wand2 size={20} className="group-hover:rotate-12 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block transition-all">Auto Layout</span>
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="w-80 border-l border-slate-800 bg-slate-900 z-30">
          <PropertyEditor
            node={selectedNode}
            edge={selectedEdge}
            variables={graph.variables}
            graph={graph}
            onUpdate={handleUpdateNode}
            onDelete={handleDeleteNode}
            onDeleteEdge={handleDeleteEdge}
            onGenerateNode={handleGenerateNode}
            isGenerating={generatingNodeId !== null}
          />
        </aside>
      </main>
      <Simulator graph={graph} isOpen={isSimulating} onClose={() => setIsSimulating(false)} />
    </div>
  );
};

export default App;
