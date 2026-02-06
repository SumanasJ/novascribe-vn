
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { VNGraph, VNNodeData, NodeType } from '../types';
import { MapPin, ArrowUpRight, Activity, Crosshair, Sparkles, X, ChevronRight, Compass, Plus, Grab, Trash2, Edit3 } from 'lucide-react';

interface LocationViewProps {
  graph: VNGraph;
  onSelectNode: (id: string) => void;
  onUpdateNode: (updated: VNNodeData) => void;
  onDeleteNode: (id: string) => void;
  onAddNodeAtLocation: (location: string, position: { x: number, y: number }) => void;
  selectedNodeId: string | null;
}

interface LocationCluster {
  name: string;
  nodes: VNNodeData[];
  center: { x: number, y: number };
}

const LocationView: React.FC<LocationViewProps> = ({ 
  graph, 
  onSelectNode, 
  onUpdateNode, 
  onDeleteNode,
  onAddNodeAtLocation,
  selectedNodeId 
}) => {
  const [selectedLocation, setSelectedLocation] = useState<LocationCluster | null>(null);
  const [draggingLocation, setDraggingLocation] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);

  // Get canvas coordinate bounds for normalization
  const bounds = useMemo(() => {
    const nodesWithPos = graph.nodes.filter(n => n.position);
    if (nodesWithPos.length === 0) return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
    return {
      minX: Math.min(...nodesWithPos.map(n => n.position!.x)) - 100,
      maxX: Math.max(...nodesWithPos.map(n => n.position!.x)) + 100,
      minY: Math.min(...nodesWithPos.map(n => n.position!.y)) - 100,
      maxY: Math.max(...nodesWithPos.map(n => n.position!.y)) + 100
    };
  }, [graph.nodes]);

  // Convert canvas to map %
  const toMapCoord = useCallback((x: number, y: number) => ({
    x: ((x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * 80 + 10,
    y: ((y - bounds.minY) / (bounds.maxY - bounds.minY || 1)) * 70 + 15
  }), [bounds]);

  // Convert map % back to canvas coords
  const fromMapCoord = useCallback((px: number, py: number) => ({
    x: ((px - 10) / 80) * (bounds.maxX - bounds.minX) + bounds.minX,
    y: ((py - 15) / 70) * (bounds.maxY - bounds.minY) + bounds.minY
  }), [bounds]);

  const clusters = useMemo(() => {
    const locMap: Record<string, VNNodeData[]> = {};
    graph.nodes.forEach(node => {
      const loc = node.location || 'Unknown Area';
      if (!locMap[loc]) locMap[loc] = [];
      locMap[loc].push(node);
    });

    return Object.entries(locMap).map(([name, nodes]): LocationCluster => {
      const avgX = nodes.reduce((sum, n) => sum + (n.position?.x || 0), 0) / nodes.length;
      const avgY = nodes.reduce((sum, n) => sum + (n.position?.y || 0), 0) / nodes.length;
      return { name, nodes, center: toMapCoord(avgX, avgY) };
    });
  }, [graph.nodes, toMapCoord]);

  // Update current selected location data when graph changes
  useEffect(() => {
    if (selectedLocation) {
      const updated = clusters.find(c => c.name === selectedLocation.name);
      if (updated) {
        setSelectedLocation(updated);
      } else {
        setSelectedLocation(null);
      }
    }
  }, [graph.nodes, clusters]);

  const connections = useMemo(() => {
    const paths: { from: string; to: string; count: number }[] = [];
    graph.edges.forEach(edge => {
      const source = graph.nodes.find(n => n.id === edge.source);
      const target = graph.nodes.find(n => n.id === edge.target);
      if (source && target && source.location !== target.location) {
        const sLoc = source.location || 'Unknown Area';
        const tLoc = target.location || 'Unknown Area';
        const existing = paths.find(p => (p.from === sLoc && p.to === tLoc) || (p.from === tLoc && p.to === sLoc));
        if (existing) existing.count++;
        else paths.push({ from: sLoc, to: tLoc, count: 1 });
      }
    });
    return paths;
  }, [graph.edges, graph.nodes]);

  const handleRenameRegion = () => {
    if (!selectedLocation || !tempName.trim()) return;
    selectedLocation.nodes.forEach(node => {
      onUpdateNode({ ...node, location: tempName.trim() });
    });
    setIsEditingName(false);
  };

  const handleDeleteRegion = () => {
    if (!selectedLocation) return;
    if (confirm(`Are you sure you want to delete the entire region "${selectedLocation.name}" and its ${selectedLocation.nodes.length} scenes?`)) {
      selectedLocation.nodes.forEach(node => {
        onDeleteNode(node.id);
      });
      setSelectedLocation(null);
    }
  };

  // Dragging logic
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingLocation || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newCanvasPos = fromMapCoord(px, py);
    const cluster = clusters.find(c => c.name === draggingLocation);
    if (!cluster) return;

    // Calculate delta to move all nodes in the cluster together
    const avgX = cluster.nodes.reduce((sum, n) => sum + (n.position?.x || 0), 0) / cluster.nodes.length;
    const avgY = cluster.nodes.reduce((sum, n) => sum + (n.position?.y || 0), 0) / cluster.nodes.length;
    const dx = newCanvasPos.x - avgX;
    const dy = newCanvasPos.y - avgY;

    cluster.nodes.forEach(node => {
      onUpdateNode({
        ...node,
        position: {
          x: (node.position?.x || 0) + dx,
          y: (node.position?.y || 0) + dy
        }
      });
    });
  }, [draggingLocation, clusters, fromMapCoord, onUpdateNode]);

  const handleMouseUp = useCallback(() => setDraggingLocation(null), []);

  useEffect(() => {
    if (draggingLocation) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingLocation, handleMouseMove, handleMouseUp]);

  const handleMapDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const canvasPos = fromMapCoord(px, py);
    onAddNodeAtLocation(`Region ${clusters.length + 1}`, canvasPos);
  };

  const currentClusterNodes = useMemo(() => {
    if (!selectedLocation) return [];
    return graph.nodes.filter(n => (n.location || 'Unknown Area') === selectedLocation.name);
  }, [selectedLocation, graph.nodes]);

  return (
    <div className="absolute inset-0 bg-slate-950 flex overflow-hidden animate-in fade-in duration-500">
      {/* Tactical Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-10" 
          style={{ 
            backgroundImage: `linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)`,
            backgroundSize: '100px 100px'
          }} 
        />
        <div className="absolute top-1/2 left-0 w-full h-px bg-indigo-500/20" />
        <div className="absolute top-0 left-1/2 w-px h-full bg-indigo-500/20" />
      </div>

      {/* Main Map Area */}
      <div 
        ref={mapRef}
        onDoubleClick={handleMapDoubleClick}
        className="relative flex-1 cursor-crosshair overflow-hidden"
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {connections.map((path, i) => {
            const start = clusters.find(c => c.name === path.from)?.center;
            const end = clusters.find(c => c.name === path.to)?.center;
            if (!start || !end) return null;
            return (
              <line 
                key={i}
                x1={`${start.x}%`} y1={`${start.y}%`}
                x2={`${end.x}%`} y2={`${end.y}%`}
                stroke="rgba(99, 102, 241, 0.2)"
                strokeWidth={2}
                strokeDasharray="8,8"
              />
            );
          })}
        </svg>

        {clusters.map((cluster) => {
          const isSelected = selectedLocation?.name === cluster.name;
          return (
            <div 
              key={cluster.name}
              style={{ left: `${cluster.center.x}%`, top: `${cluster.center.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
            >
              <div className="absolute -inset-8 bg-indigo-500/10 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500 blur-2xl" />
              
              <div className="flex flex-col items-center gap-2">
                <div 
                  className={`flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-4 py-1.5 rounded-full backdrop-blur-md shadow-2xl transition-all ${
                    isSelected ? 'border-indigo-500 scale-110' : 'opacity-80 group-hover:opacity-100'
                  }`}
                >
                  <span className="text-[10px] font-black tracking-tight text-slate-100 whitespace-nowrap uppercase">{cluster.name}</span>
                  <div className="w-px h-3 bg-slate-700 mx-1" />
                  <span className="text-[10px] font-black text-indigo-400">{cluster.nodes.length}</span>
                </div>

                <div className="flex gap-1">
                  <button
                    onMouseDown={(e) => { e.stopPropagation(); setDraggingLocation(cluster.name); }}
                    className={`w-12 h-12 rounded-[1.25rem] border-2 flex items-center justify-center transition-all duration-300 shadow-2xl cursor-grab active:cursor-grabbing ${
                      isSelected 
                        ? 'bg-indigo-600 border-white scale-110' 
                        : 'bg-slate-900 border-indigo-500/50 hover:border-indigo-400 group-hover:scale-105'
                    }`}
                    onClick={(e) => { e.stopPropagation(); setSelectedLocation(cluster); setIsEditingName(false); }}
                  >
                    {draggingLocation === cluster.name ? <Grab size={20} className="text-white" /> : <MapPin size={22} className={isSelected ? 'text-white' : 'text-indigo-400'} />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Floating Controls */}
        <div className="absolute bottom-8 left-8 bg-slate-900/80 border border-white/5 p-5 rounded-[2rem] backdrop-blur-xl pointer-events-none shadow-2xl">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Map Navigation</div>
          <div className="space-y-2">
            <div className="text-[10px] text-slate-400 flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" /> Double-click map to spawn new region</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" /> Drag pins to reposition story clusters</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" /> Click pins to manage local narrative beats</div>
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 p-8 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          <h2 className="text-3xl font-black tracking-tighter flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Compass className="text-white" size={24} />
            </div>
            GEOSPATIAL ARCHITECT
          </h2>
          <div className="flex gap-5 mt-3">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-900/50 px-3 py-1 rounded-full border border-white/5">
              <Activity size={12} className="text-emerald-500" /> {clusters.length} Regions Active
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-900/50 px-3 py-1 rounded-full border border-white/5">
              <Crosshair size={12} className="text-indigo-500" /> Spatial Logic: Verified
            </div>
          </div>
        </div>
        
        <div className="pointer-events-auto">
          <button 
            onClick={() => onAddNodeAtLocation(`Region ${clusters.length + 1}`, { x: 500, y: 500 })}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 group"
          >
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" /> 
            ADD NEW REGION
          </button>
        </div>
      </div>

      {/* Side Region Drawer */}
      <div className={`absolute top-0 right-0 bottom-0 w-[440px] bg-slate-900/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl transition-transform duration-500 z-40 flex flex-col ${
        selectedLocation ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {selectedLocation && (
          <>
            <div className="p-8 border-b border-white/5 space-y-8">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1 mr-4">
                  <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                    <MapPin size={12} /> Regional Focus
                  </div>
                  {isEditingName ? (
                    <div className="flex gap-2">
                      <input 
                        autoFocus
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameRegion()}
                        className="bg-slate-800 border border-indigo-500 rounded-xl px-4 py-2 text-xl font-black focus:outline-none w-full"
                      />
                      <button onClick={handleRenameRegion} className="p-2 bg-emerald-600 rounded-xl text-white hover:bg-emerald-500"><Plus size={20}/></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 group/name">
                      <h3 className="text-2xl font-black tracking-tight uppercase truncate">{selectedLocation.name}</h3>
                      <button 
                        onClick={() => { setTempName(selectedLocation.name); setIsEditingName(true); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 opacity-0 group-hover/name:opacity-100 transition-all"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={handleDeleteRegion}
                    className="p-2.5 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-2xl transition-all"
                    title="Delete Region"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button 
                    onClick={() => {
                      const pos = fromMapCoord(selectedLocation.center.x + 5, selectedLocation.center.y + 5);
                      onAddNodeAtLocation(selectedLocation.name, pos);
                    }}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white transition-all shadow-lg"
                    title="Add Scene to Region"
                  >
                    <Plus size={20} />
                  </button>
                  <button 
                    onClick={() => setSelectedLocation(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors ml-2"
                  >
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-5 rounded-[2rem] border border-white/5 shadow-inner">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Beat Count</div>
                  <div className="text-3xl font-black text-indigo-400">{currentClusterNodes.length}</div>
                </div>
                <div className="bg-white/5 p-5 rounded-[2rem] border border-white/5 shadow-inner">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Complexity</div>
                  <div className="text-3xl font-black text-emerald-400">
                    {currentClusterNodes.length > 5 ? 'High' : 'Low'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-5">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">Narrative Beats Stack</h4>
              
              {currentClusterNodes.map(node => (
                <div 
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className={`group bg-slate-950/40 border-2 rounded-[2rem] p-6 transition-all duration-300 cursor-pointer ${
                    selectedNodeId === node.id 
                      ? 'border-indigo-600 bg-indigo-600/5 ring-4 ring-indigo-600/10' 
                      : 'border-white/5 hover:border-indigo-500/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border transition-colors ${
                      selectedNodeId === node.id ? 'bg-indigo-600 text-white border-transparent' : 'bg-white/5 text-slate-500 border-slate-800'
                    }`}>
                      {node.type}
                    </span>
                    <ArrowUpRight size={16} className={`transition-all ${
                      selectedNodeId === node.id ? 'text-indigo-400 scale-125' : 'text-slate-700 opacity-0 group-hover:opacity-100 group-hover:translate-x-1'
                    }`} />
                  </div>

                  <h5 className={`font-black text-base mb-2 leading-tight transition-colors ${
                    selectedNodeId === node.id ? 'text-white' : 'text-slate-200 group-hover:text-indigo-200'
                  }`}>
                    {node.label}
                  </h5>
                  
                  <p className="text-xs text-slate-500 line-clamp-2 italic leading-relaxed group-hover:text-slate-400 font-serif">
                    {node.content || "No narrative content defined for this beat..."}
                  </p>

                  {(node.preconditions.length > 0 || node.effects.length > 0) && (
                    <div className="flex gap-3 mt-5 pt-5 border-t border-white/5">
                      {node.preconditions.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                          <span className="text-[9px] font-black text-slate-600 uppercase">Logic Gate</span>
                        </div>
                      )}
                      {node.effects.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="text-[9px] font-black text-slate-600 uppercase">State Trigger</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {currentClusterNodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-20 gap-4">
                  <MapPin size={48} />
                  <p className="text-sm font-black uppercase tracking-widest">Region is Empty</p>
                </div>
              )}
            </div>

            <div className="p-8 bg-indigo-600/5 border-t border-white/5 text-center">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 opacity-50">Spatial Context Editing Active</p>
               <div className="flex items-center justify-center gap-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  <Sparkles size={14} className="animate-pulse" /> Use Right Panel for Detailed Editing
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LocationView;
