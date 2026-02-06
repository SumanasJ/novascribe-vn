
import React, { useState, useEffect } from 'react';
import { VNGraph, VNNodeData, NodeType, VNVariable, EdgeType, SceneCategory } from '../types';
import { getSceneCategory } from '../constants';
import { Play, RotateCcw, ChevronRight, AlertCircle, MapPin, Dice5, Zap } from 'lucide-react';

interface SimulatorProps {
  graph: VNGraph;
  isOpen: boolean;
  onClose: () => void;
}

const Simulator: React.FC<SimulatorProps> = ({ graph, isOpen, onClose }) => {
  const [currentNode, setCurrentNode] = useState<VNNodeData | null>(null);
  const [simVariables, setSimVariables] = useState<VNVariable[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [isProcessingPool, setIsProcessingPool] = useState(false);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen]);

  const reset = () => {
    // v0.2: Find start node dynamically (nodes without incoming edges)
    const startNode = graph.nodes.find(n => getSceneCategory(n.id, graph) === SceneCategory.START);
    setCurrentNode(startNode || null);
    setSimVariables(graph.variables.map(v => ({ ...v, currentValue: v.defaultValue })));
    setLog(['Timeline initialized.']);
    setIsProcessingPool(false);
  };

  const handleNext = (targetId: string) => {
    const nextNode = graph.nodes.find(n => n.id === targetId);
    if (nextNode) {
      setCurrentNode(nextNode);
      const newVars = [...simVariables];
      nextNode.effects.forEach(eff => {
        const v = newVars.find(v => v.id === eff.variableId);
        if (v) {
          if (eff.operation === 'set') v.currentValue = eff.value;
          if (eff.operation === 'add') v.currentValue = Number(v.currentValue) + Number(eff.value);
          if (eff.operation === 'subtract') v.currentValue = Number(v.currentValue) - Number(eff.value);
          if (eff.operation === 'toggle') v.currentValue = !v.currentValue;
        }
      });
      setSimVariables(newVars);
      setLog(prev => [...prev, `Beat: ${nextNode.label}`]);
      // v0.2: Removed POOL handling - all nodes are SCENE now
      setIsProcessingPool(false);
    }
  };

  const performPoolRoll = (poolId: string) => {
    const edges = graph.edges.filter(e => e.source === poolId);
    if (edges.length === 0) {
      setIsProcessingPool(false);
      return;
    }

    const totalWeight = edges.reduce((acc, e) => acc + (e.weight || 10), 0);
    let random = Math.random() * totalWeight;
    let selectedEdge = edges[0];
    for (const edge of edges) {
      const w = edge.weight || 10;
      if (random < w) {
        selectedEdge = edge;
        break;
      }
      random -= w;
    }
    setLog(prev => [...prev, `[Roll: Selection from Random Pool]`]);
    handleNext(selectedEdge.target);
  };

  if (!isOpen) return null;

  const availableConnections = graph.edges
    .filter(e => e.source === currentNode?.id)
    .map(e => ({ edge: e, target: graph.nodes.find(n => n.id === e.target) }))
    .filter(conn => {
      if (!conn.target) return false;
      // Filter by preconditions
      return conn.target.preconditions.every(cond => {
        const v = simVariables.find(v => v.id === cond.variableId);
        if (!v) return true;
        const curr = v.currentValue;
        const target = cond.value;
        switch(cond.operator) {
          case '==': return curr == target;
          case '!=': return curr != target;
          case '>': return Number(curr) > Number(target);
          case '<': return Number(curr) < Number(target);
          case '>=': return Number(curr) >= Number(target);
          case '<=': return Number(curr) <= Number(target);
          default: return true;
        }
      });
    });

  // v0.2: All nodes are narrative nodes now (SCENE type)
  const isNarrativeNode = currentNode && currentNode.type === NodeType.SCENE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-[2.5rem] w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center p-8 border-b border-white/5 bg-slate-900/40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
              <Play size={20} fill="white" />
            </div>
            <div>
              <h2 className="font-black text-lg tracking-tight uppercase">Live Story Simulator</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Runtime context & logic trace</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="p-3 hover:bg-white/10 rounded-2xl transition-all" title="Restart Session"><RotateCcw size={20} /></button>
            <button onClick={onClose} className="px-6 py-2.5 bg-white/5 hover:bg-rose-600/20 text-slate-300 hover:text-rose-400 rounded-2xl font-black text-[10px] tracking-widest transition-all">TERMINATE</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-12 space-y-12 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_50%_0%,#1e293b,transparent)]">
            {currentNode ? (
              <div className="max-w-3xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className={`relative rounded-[3rem] p-12 border transition-all duration-1000 ${
                  isProcessingPool 
                    ? 'bg-fuchsia-900/5 border-fuchsia-500/50 shadow-fuchsia-500/10 shadow-2xl scale-[1.02]' 
                    : 'bg-slate-800/40 border-white/5 shadow-2xl'
                }`}>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-rose-400 bg-rose-400/5 px-4 py-1.5 rounded-full border border-rose-400/10">
                      <MapPin size={14} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{currentNode.location || 'Limbo'}</span>
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-500`}>
                       {getSceneCategory(currentNode.id, graph) === SceneCategory.START && <Zap size={12} className="text-emerald-500 animate-pulse" />}
                       {getSceneCategory(currentNode.id, graph)}
                    </div>
                  </div>
                  
                  <h3 className="text-3xl font-black tracking-tight mb-8 flex items-center gap-5">
                    {currentNode.label}
                    {isProcessingPool && <Dice5 className="animate-spin text-fuchsia-400" size={32} />}
                  </h3>

                  {isNarrativeNode && (
                    <div className="relative">
                      <div className="absolute -left-6 top-0 bottom-0 w-1 bg-indigo-500/40 rounded-full" />
                      <p className="text-xl text-slate-100 leading-relaxed italic font-serif pl-2 opacity-95">
                        {currentNode.content || "..."}
                      </p>
                    </div>
                  )}
                </div>

                {!isProcessingPool && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-4 px-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Player Input Options</h4>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {availableConnections.length > 0 ? (
                        availableConnections.map((conn, i) => (
                          <button
                            key={i}
                            onClick={() => handleNext(conn.target!.id)}
                            className="flex items-center justify-between p-6 bg-slate-800/80 hover:bg-indigo-600 border border-white/5 hover:border-indigo-400/50 rounded-3xl transition-all group text-left active:scale-[0.98] shadow-lg hover:shadow-indigo-600/20"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-[10px] font-black transition-colors">
                                {i + 1}
                              </div>
                              <span className="font-black text-sm text-slate-100 group-hover:text-white tracking-tight">
                                {conn.edge.label || conn.target!.label}
                              </span>
                            </div>
                            <ChevronRight size={20} className="text-slate-600 group-hover:text-white group-hover:translate-x-2 transition-all" />
                          </button>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-4 p-12 bg-emerald-900/10 border border-emerald-900/20 rounded-[3rem] text-emerald-400 text-center animate-pulse">
                          <Zap size={32} />
                          <div>
                            <p className="text-lg font-black tracking-tight uppercase">Narrative Vector Complete</p>
                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Timeline has reached a final node or dead end</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <aside className="w-96 border-l border-white/5 bg-slate-900/80 flex flex-col">
            <div className="p-10 border-b border-white/5 space-y-8">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active State Monitor</h4>
              <div className="space-y-6">
                {simVariables.map(v => (
                  <div key={v.id} className="space-y-3">
                    <div className="flex justify-between text-[11px] font-black">
                      <span className="text-slate-400 uppercase tracking-wider">{v.name}</span>
                      <span className="text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded">
                        {v.type === 'boolean' ? (v.currentValue ? 'ON' : 'OFF') : v.currentValue}
                      </span>
                    </div>
                    {v.type === 'number' && (
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                          style={{ width: `${(Number(v.currentValue) / (v.max || 100)) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {simVariables.length === 0 && (
                   <div className="py-8 text-center border border-dashed border-white/10 rounded-2xl opacity-30">
                     <p className="text-[10px] font-bold uppercase tracking-widest">No variables tracked</p>
                   </div>
                )}
              </div>
            </div>
            
            <div className="p-10 flex-1 overflow-y-auto custom-scrollbar bg-black/20">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Temporal Trace Log</h4>
              <div className="space-y-5">
                {log.slice().reverse().map((l, i) => (
                  <div key={i} className={`text-[12px] p-3 leading-relaxed rounded-2xl border transition-all ${
                    i === 0 
                      ? 'text-white border-indigo-500/50 bg-indigo-600/10 font-bold shadow-lg shadow-indigo-600/5 scale-[1.02]' 
                      : 'text-slate-500 border-transparent opacity-60 hover:opacity-100 hover:bg-white/5'
                  }`}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Simulator;
