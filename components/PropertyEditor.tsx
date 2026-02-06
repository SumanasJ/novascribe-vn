
import React from 'react';
import { VNNodeData, VNVariable, NodeType, VNCondition, VNEffect, VNGraph, VNChoiceOption, SceneCategory } from '../types';
import { Trash2, Plus, Settings2, MapPin, GitBranch, MessageSquare, Layers, Link2, CheckCircle, HelpCircle } from 'lucide-react';

interface PropertyEditorProps {
  node: VNNodeData | null;
  edge?: { id: string, source: string, target: string, type: any } | null;
  variables: VNVariable[];
  graph: VNGraph;
  onUpdate: (updated: VNNodeData) => void;
  onDelete: (id: string) => void;
  onDeleteEdge: (id: string) => void;
}

const PropertyEditor: React.FC<PropertyEditorProps> = ({ node, edge, variables, graph, onUpdate, onDelete, onDeleteEdge }) => {
  // Edge Selection Case
  if (edge && !node) {
    const sourceNode = graph.nodes.find(n => n.id === edge.source);
    const targetNode = graph.nodes.find(n => n.id === edge.target);
    return (
      <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 p-5 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Link2 size={18} className="text-indigo-400" /> 连线属性
          </h2>
          <button onClick={() => onDeleteEdge(edge.id)} className="p-2 text-rose-400 hover:bg-rose-900/30 rounded-lg transition-colors">
            <Trash2 size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <div className="bg-slate-800/20 p-4 rounded-2xl border border-white/5 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">起始节点</label>
              <div className="text-sm font-bold text-slate-100 truncate">{sourceNode?.label || '未知节点'}</div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">目标节点</label>
              <div className="text-sm font-bold text-slate-100 truncate">{targetNode?.label || '未知节点'}</div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">连线类型</label>
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded inline-block">{edge.type}</div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 italic text-center px-4">
            连线定义了剧情的流向，可在画布模式下通过拖拽圆点进行重连，或按 Delete 键删除。
          </p>
        </div>
      </div>
    );
  }

  // No selection Case
  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500 space-y-4">
        <Settings2 size={48} strokeWidth={1} />
        <p className="text-center text-sm">选择一个剧情节点或连线开始编辑</p>
      </div>
    );
  }

  // Node Selection Case
  // v0.2: All nodes are SCENE type now
  const isContentNode = node.type === NodeType.SCENE;

  const handleChange = (field: keyof VNNodeData, value: any) => {
    onUpdate({ ...node, [field]: value });
  };

  const addOption = () => {
    const newOpt: VNChoiceOption = {
      id: `opt-${Date.now()}`,
      text: '新选项',
      conditions: [],
      effects: []
    };
    handleChange('options', [...(node.options || []), newOpt]);
  };

  const removeOption = (index: number) => {
    handleChange('options', (node.options || []).filter((_, i) => i !== index));
  };

  const updateOption = (index: number, text: string) => {
    const newOpts = [...(node.options || [])];
    newOpts[index] = { ...newOpts[index], text };
    handleChange('options', newOpts);
  };

  const addPrecondition = () => {
    if (variables.length === 0) return;
    const newPre: VNCondition = {
      variableId: variables[0].id,
      operator: '==',
      value: variables[0].type === 'number' ? 0 : variables[0].type === 'boolean' ? true : ''
    };
    handleChange('preconditions', [...(node.preconditions || []), newPre]);
  };

  const updatePrecondition = (index: number, updates: Partial<VNCondition>) => {
    const newPreconditions = [...node.preconditions];
    newPreconditions[index] = { ...newPreconditions[index], ...updates };
    handleChange('preconditions', newPreconditions);
  };

  const addEffect = () => {
    if (variables.length === 0) return;
    const newEff: VNEffect = {
      variableId: variables[0].id,
      operation: variables[0].type === 'boolean' ? 'toggle' : 'set',
      value: variables[0].type === 'number' ? 1 : ''
    };
    handleChange('effects', [...(node.effects || []), newEff]);
  };

  const updateEffect = (index: number, updates: Partial<VNEffect>) => {
    const newEffects = [...node.effects];
    newEffects[index] = { ...newEffects[index], ...updates };
    handleChange('effects', newEffects);
  };

  const existingLocations = Array.from(new Set(graph.nodes.map(n => n.location).filter(Boolean)));

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 custom-scrollbar overflow-y-auto p-5 space-y-6 pb-20 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${
            node.type === NodeType.SCENE ? 'bg-sky-500' : 'bg-slate-500'
          }`}></span>
          剧情节点属性 <span className="text-[10px] text-slate-500 font-normal ml-1">(Scene)</span>
        </h2>
        <button onClick={() => onDelete(node.id)} className="p-2 text-rose-400 hover:bg-rose-900/30 rounded-lg transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="space-y-6">
        <section className="space-y-4 bg-slate-800/20 p-4 rounded-2xl border border-white/5">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">显示名称 (Label)</label>
            <input
              type="text"
              value={node.label}
              onChange={(e) => handleChange('label', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-all"
              placeholder="例如：酒馆遭遇"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <MapPin size={10} className="text-rose-500" /> 剧情发生地点 (Location)
            </label>
            <input
              type="text"
              list="locations-list"
              value={node.location || ''}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-rose-500 transition-all"
              placeholder="选择或输入地点"
            />
            <datalist id="locations-list">
              {existingLocations.map(loc => <option key={loc} value={loc} />)}
            </datalist>
          </div>

          <div className="space-y-2 pt-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Layers size={10} className="text-indigo-400" /> 剧情分类 (Classification)
            </label>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => handleChange('isPoolMember', false)}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${!node.isPoolMember ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                主线剧情
              </button>
              <button
                onClick={() => handleChange('isPoolMember', true)}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${node.isPoolMember ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                随机事件
              </button>
            </div>
          </div>

          {/* v0.2: New Properties */}
          <div className="space-y-2 pt-2 border-t border-slate-800/50">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <GitBranch size={10} className="text-emerald-400" /> 包含选项 (Has Choice)
            </label>
            <button
              onClick={() => handleChange('hasChoice', !node.hasChoice)}
              className={`w-full py-2.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${node.hasChoice ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {node.hasChoice ? <CheckCircle size={14} /> : <HelpCircle size={14} />}
              {node.hasChoice ? '此节点包含玩家选择' : '此节点无选项'}
            </button>
            <p className="text-[9px] text-slate-600 italic">
              开启后可在下方添加选项，玩家需要做出选择才能继续
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <MapPin size={10} className="text-amber-400" /> 分组框架 (Group Frame)
            </label>
            <input
              type="text"
              value={node.groupFrame || ''}
              onChange={(e) => handleChange('groupFrame', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-500 transition-all"
              placeholder="留空或输入分组名称..."
            />
            <p className="text-[9px] text-slate-600 italic">
              预留属性，用于后续剧情池/剧情块的分组规划
            </p>
          </div>

          {/* v0.3: Branch narrative property */}
          <div className="space-y-2 pt-2 border-t border-slate-800/50">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <GitBranch size={10} className="text-amber-400" /> 分支剧情 (Branch Narrative)
            </label>
            <button
              onClick={() => handleChange('isBranch', !node.isBranch)}
              className={`w-full py-2.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${node.isBranch ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {node.isBranch ? <CheckCircle size={14} /> : <HelpCircle size={14} />}
              {node.isBranch ? '这是选项后的分支剧情' : '这是普通剧情'}
            </button>
            {node.isBranch && (
              <div className="space-y-2 mt-2">
                <label className="text-[9px] text-slate-500">对应选项索引 (0-N):</label>
                <input
                  type="number"
                  min={0}
                  value={node.branchChoiceIndex ?? 0}
                  onChange={(e) => handleChange('branchChoiceIndex', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-500 transition-all"
                  placeholder="这是第几个选项的分支..."
                />
              </div>
            )}
            <p className="text-[9px] text-slate-600 italic">
              标记此节点为某个选项后的专属分支剧情
            </p>
          </div>
        </section>

        {isContentNode && (
          <section className="space-y-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <MessageSquare size={10} className="text-sky-400" /> 剧本正文 (Script Content)
            </label>
            <textarea
              value={node.content || ''}
              onChange={(e) => handleChange('content', e.target.value)}
              rows={8}
              className="w-full bg-slate-800/40 border border-slate-700 rounded-2xl p-4 text-sm focus:outline-none focus:border-sky-500 resize-none font-serif leading-relaxed custom-scrollbar"
              placeholder="在此输入角色对话或场景描写..."
            />
          </section>
        )}

        {/* v0.2: Show options based on hasChoice property instead of node type */}
        {node.hasChoice && (
          <section className="pt-4 border-t border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <GitBranch size={12} /> 抉择选项 (Decision Points)
              </label>
              <button onClick={addOption} className="text-[9px] font-black bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 px-3 py-1.5 rounded-full transition-all flex items-center gap-1">
                <Plus size={12} /> 新增选项
              </button>
            </div>
            <div className="space-y-3">
              {(node.options || []).map((opt, i) => (
                <div key={opt.id} className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 group relative">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={opt.text}
                      onChange={(e) => updateOption(i, e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 transition-all"
                      placeholder="选项文本..."
                    />
                    <button onClick={() => removeOption(i)} className="text-slate-600 hover:text-rose-400 p-1.5 transition-colors"><Trash2 size={14} /></button>
                  </div>
                  <div className="text-[9px] text-slate-600 italic">注：连线到目标节点以关联逻辑</div>
                </div>
              ))}
              {(node.options || []).length === 0 && (
                <div className="text-center py-6 bg-slate-800/20 rounded-xl border border-dashed border-slate-700">
                  <p className="text-[10px] text-slate-500 italic">暂无选项，点击上方按钮添加</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="space-y-6 pt-4 border-t border-slate-800">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">触发条件 (Pre-Conditions)</label>
              <button onClick={addPrecondition} className="text-[9px] font-black text-amber-500 border border-amber-500/20 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors">
                + 条件
              </button>
            </div>
            <div className="space-y-2">
              {node.preconditions.map((cond, i) => (
                <div key={i} className="bg-slate-950/40 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                  <select 
                    value={cond.variableId}
                    onChange={(e) => updatePrecondition(i, { variableId: e.target.value })}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[10px] font-bold"
                  >
                    {variables.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <select 
                    value={cond.operator}
                    onChange={(e) => updatePrecondition(i, { operator: e.target.value as any })}
                    className="w-10 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[10px]"
                  >
                    <option value="==">==</option>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                  </select>
                  <input 
                    type="text" value={cond.value}
                    onChange={(e) => updatePrecondition(i, { value: e.target.value })}
                    className="w-10 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[10px] text-center"
                  />
                  <button onClick={() => handleChange('preconditions', node.preconditions.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-300"><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">执行后果 (Outcome Effects)</label>
              <button onClick={addEffect} className="text-[9px] font-black text-emerald-500 border border-emerald-500/20 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors">
                + 影响
              </button>
            </div>
            <div className="space-y-2">
              {node.effects.map((eff, i) => (
                <div key={i} className="bg-slate-950/40 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                  <select 
                    value={eff.variableId}
                    onChange={(e) => updateEffect(i, { variableId: e.target.value })}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[10px] font-bold"
                  >
                    {variables.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <select 
                    value={eff.operation}
                    onChange={(e) => updateEffect(i, { operation: e.target.value as any })}
                    className="w-12 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[10px]"
                  >
                    <option value="set">SET</option>
                    <option value="add">ADD</option>
                    <option value="toggle">TOG</option>
                  </select>
                  {eff.operation !== 'toggle' && (
                    <input 
                      type="text" value={eff.value}
                      onChange={(e) => updateEffect(i, { value: e.target.value })}
                      className="w-10 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[10px] text-center"
                    />
                  )}
                  <button onClick={() => handleChange('effects', node.effects.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-300"><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PropertyEditor;
