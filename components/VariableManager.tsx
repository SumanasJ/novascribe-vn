
import React from 'react';
import { VNVariable } from '../types';
import { Settings2, Plus, Trash2, Hash, ToggleLeft, Activity } from 'lucide-react';

interface VariableManagerProps {
  variables: VNVariable[];
  onUpdate: (vars: VNVariable[]) => void;
}

const VariableManager: React.FC<VariableManagerProps> = ({ variables, onUpdate }) => {
  const addVar = () => {
    if (variables.length >= 5) return;
    const newVar: VNVariable = {
      id: `var-${Date.now()}`,
      name: `New Variable ${variables.length + 1}`,
      type: 'number',
      defaultValue: 0,
      currentValue: 0,
      min: 0,
      max: 100
    };
    onUpdate([...variables, newVar]);
  };

  const updateVar = (id: string, updates: Partial<VNVariable>) => {
    onUpdate(variables.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const deleteVar = (id: string) => {
    onUpdate(variables.filter(v => v.id !== id));
  };

  return (
    <div className="p-4 space-y-4 border-t border-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Activity size={14} className="text-indigo-400" /> Plot Variables ({variables.length}/5)
        </h3>
        {variables.length < 5 && (
          <button 
            onClick={addVar}
            className="p-1 hover:bg-slate-800 rounded text-indigo-400"
            title="Add Variable"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {variables.map((v) => (
          <div key={v.id} className="bg-slate-900/50 border border-slate-800 p-2.5 rounded-lg space-y-2 group">
            <div className="flex items-center gap-2">
              <input 
                value={v.name}
                onChange={(e) => updateVar(v.id, { name: e.target.value })}
                className="bg-transparent text-[11px] font-bold text-slate-200 focus:outline-none flex-1"
              />
              <button 
                onClick={() => deleteVar(v.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => updateVar(v.id, { 
                  type: v.type === 'number' ? 'boolean' : 'number',
                  defaultValue: v.type === 'number' ? false : 0,
                  currentValue: v.type === 'number' ? false : 0
                })}
                className="p-1 bg-slate-800 rounded flex items-center gap-1.5 px-2 text-[9px] font-bold text-slate-400 hover:text-indigo-400 transition-colors"
              >
                {v.type === 'number' ? <Hash size={10} /> : <ToggleLeft size={10} />}
                {v.type.toUpperCase()}
              </button>

              {v.type === 'number' && (
                <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
                  <span>Range:</span>
                  <input 
                    type="number" 
                    value={v.min} 
                    onChange={(e) => updateVar(v.id, { min: Number(e.target.value) })}
                    className="w-10 bg-slate-800 border border-slate-700 rounded text-center px-0.5"
                  />
                  <span>-</span>
                  <input 
                    type="number" 
                    value={v.max} 
                    onChange={(e) => updateVar(v.id, { max: Number(e.target.value) })}
                    className="w-10 bg-slate-800 border border-slate-700 rounded text-center px-0.5"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        {variables.length === 0 && (
          <p className="text-[10px] text-slate-600 text-center italic py-2">No variables defined</p>
        )}
      </div>
    </div>
  );
};

export default VariableManager;
