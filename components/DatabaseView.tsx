
import React, { useMemo, useState } from 'react';
import { VNGraph, VNNodeData, NodeType, SceneCategory } from '../types';
import { getSceneCategory, SCENE_CATEGORY_COLORS } from '../constants';
import {
  Search,
  Filter,
  Tag,
  MapPin,
  Trash2,
  ArrowUpRight,
  FileText,
  CheckCircle,
  Clock,
  CircleDashed,
  Layers,
  ChevronDown,
  Zap,
  Plus
} from 'lucide-react';

interface DatabaseViewProps {
  graph: VNGraph;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onUpdateNode: (updated: VNNodeData) => void;
  onDeleteNode: (id: string) => void;
  onAddNode: (type: NodeType) => void;
}

const DatabaseView: React.FC<DatabaseViewProps> = ({ 
  graph, 
  selectedNodeId, 
  onSelectNode, 
  onUpdateNode, 
  onDeleteNode,
  onAddNode
}) => {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const filteredNodes = useMemo(() => {
    return graph.nodes.filter(node => {
      const matchesSearch =
        node.label.toLowerCase().includes(search.toLowerCase()) ||
        (node.location?.toLowerCase().includes(search.toLowerCase()) || "") ||
        (node.content?.toLowerCase().includes(search.toLowerCase()) || "");
      // v0.2: All nodes are SCENE type now, filter by scene category instead
      const category = getSceneCategory(node.id, graph);
      const matchesType = filterType === "ALL" ||
                         (filterType === "SCENE" && node.type === NodeType.SCENE) ||
                         filterType === category;
      return matchesSearch && matchesType;
    });
  }, [graph.nodes, search, filterType]);

  const stats = useMemo(() => ({
    total: graph.nodes.length,
    main: graph.nodes.filter(n => !n.isPoolMember).length,
    side: graph.nodes.filter(n => n.isPoolMember).length,
    // v0.2: Count by dynamic scene categories
    start: graph.nodes.filter(n => getSceneCategory(n.id, graph) === SceneCategory.START).length,
    end: graph.nodes.filter(n => getSceneCategory(n.id, graph) === SceneCategory.END).length
  }), [graph.nodes]);

  return (
    <div className="h-full bg-slate-950 flex flex-col animate-in fade-in duration-500 overflow-hidden">
      {/* DB Header / Toolbar */}
      <div className="p-6 border-b border-white/5 bg-slate-900/40 backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-600/10">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Master Asset Database</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Complete Plot Register & Event Logs</p>
            </div>
          </div>

          <div className="flex gap-4">
             <button 
               onClick={() => onAddNode(NodeType.SCENE)}
               className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 group"
             >
               <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" /> 
               NEW ASSET
             </button>
             <div className="h-10 w-px bg-white/5" />
             <div className="flex gap-2">
               {[
                 { label: 'Total', value: stats.total, color: 'text-slate-300' },
                 { label: 'Main Plot', value: stats.main, color: 'text-sky-400' },
                 { label: 'Side Events', value: stats.side, color: 'text-fuchsia-400' }
               ].map((stat, i) => (
                 <div key={i} className="px-5 py-2 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center min-w-[110px] shadow-sm">
                   <span className={`text-lg font-black ${stat.color}`}>{stat.value}</span>
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{stat.label}</span>
                 </div>
               ))}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets by label, location, or script content..."
              className="w-full bg-slate-900/60 border border-white/5 rounded-[1.5rem] py-3.5 pl-14 pr-6 text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600 shadow-inner"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-900/60 border border-white/5 rounded-[1.5rem] py-3.5 pl-14 pr-12 text-xs font-bold uppercase tracking-widest appearance-none focus:outline-none focus:border-indigo-500/50 cursor-pointer text-slate-300 shadow-sm"
            >
              <option value="ALL">所有节点</option>
              <option value={SceneCategory.START}>起点</option>
              <option value={SceneCategory.STANDARD}>标准剧情</option>
              <option value={SceneCategory.FREE}>自由剧情</option>
              <option value={SceneCategory.END}>终点</option>
              <option value={SceneCategory.BRANCH}>分支剧情</option>
            </select>
            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-auto custom-scrollbar p-8">
        <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-white/5">
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Beat Meta</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Label & Location</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Classification</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Logic Stack</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const status = node.isPoolMember ? 'SIDE' : 'MAIN';
                // v0.2: Use dynamic scene category
                const category = getSceneCategory(node.id, graph);
                const categoryColor = SCENE_CATEGORY_COLORS[category];

                return (
                  <tr
                    key={node.id}
                    onClick={() => onSelectNode(node.id)}
                    className={`transition-all group cursor-pointer ${isSelected ? 'bg-indigo-600/10 border-l-4 border-l-indigo-500' : 'hover:bg-white/5 border-l-4 border-l-transparent'}`}
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-sm transition-transform group-hover:scale-110 ${categoryColor.replace('bg-', 'bg-').replace('500', '500/10')} text-${categoryColor.split('-')[1]}-400 border-${categoryColor.split('-')[1]}-500/20`}>
                          <FileText size={18}/>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-400 font-mono tracking-tighter">#{node.id.slice(-4)}</span>
                          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{category}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-6">
                      <div className="flex flex-col gap-1.5 max-w-xs">
                        <input 
                          value={node.label}
                          onChange={(e) => onUpdateNode({...node, label: e.target.value})}
                          className="bg-transparent font-black text-sm text-slate-100 focus:outline-none focus:text-indigo-400 transition-colors w-full truncate"
                          placeholder="Untitled Beat"
                        />
                        <div className="flex items-center gap-2 text-slate-500">
                          <MapPin size={11} className="text-rose-500/50" />
                          <input 
                            value={node.location || ""}
                            onChange={(e) => onUpdateNode({...node, location: e.target.value})}
                            placeholder="Assign Location..."
                            className="bg-transparent text-[11px] font-bold focus:outline-none w-full truncate"
                          />
                        </div>
                      </div>
                    </td>

                    <td className="p-6">
                      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                        status === 'MAIN' 
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                          : 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20'
                      }`}>
                        {status === 'MAIN' ? <CheckCircle size={12}/> : <CircleDashed size={12}/>}
                        {status === 'MAIN' ? 'Main Plot' : 'Random Event'}
                      </div>
                    </td>

                    <td className="p-6">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Entry Gates</span>
                          <div className="flex gap-1.5">
                            {node.preconditions.length > 0 ? (
                              Array.from({length: node.preconditions.length}).map((_, i) => (
                                <div key={i} className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                              ))
                            ) : (
                              <span className="text-[10px] font-bold text-slate-700/50 italic">Unrestricted</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Outcome</span>
                          <div className="flex gap-1.5">
                            {node.effects.length > 0 ? (
                              Array.from({length: node.effects.length}).map((_, i) => (
                                <div key={i} className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                              ))
                            ) : (
                              <span className="text-[10px] font-bold text-slate-700/50 italic">Neutral</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-6 text-right">
                       <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                         <button 
                           onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
                           className="p-3 bg-rose-600/10 hover:bg-rose-600 text-slate-500 hover:text-white rounded-[1rem] transition-all shadow-sm"
                           title="Delete Beat"
                         >
                           <Trash2 size={16} />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }}
                           className={`p-3 rounded-[1rem] transition-all shadow-md ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white'}`}
                           title="Open in Inspector"
                         >
                           <ArrowUpRight size={18} />
                         </button>
                       </div>
                    </td>
                  </tr>
                );
              })}

              {filteredNodes.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-6 opacity-30 animate-pulse">
                      <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
                        <Layers size={48} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-black uppercase tracking-[0.3em]">No matching assets found</p>
                        <p className="text-[10px] font-bold text-slate-500">Try adjusting your search or filters</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DB Footer */}
      <div className="p-8 bg-slate-900/60 border-t border-white/5 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-70">
          <Clock size={14} className="text-indigo-400" /> System Sync: {new Date().toLocaleTimeString()}
        </div>
        <div className="flex items-center gap-10">
           <div className="flex items-center gap-3">
             <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Main Plot Nodes</span>
           </div>
           <div className="flex items-center gap-3">
             <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Random Side-Events</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseView;
