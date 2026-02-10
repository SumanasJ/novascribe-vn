import React, { useMemo } from 'react';
import { VNGraph, NarrativeConflict } from '../types';
import { StateAnalyzer } from '../utils/stateAnalyzer';
import { AlertTriangle, AlertCircle, Info, X, CheckCircle } from 'lucide-react';

interface ConflictPanelProps {
  graph: VNGraph;
  onDismiss?: (conflictId: string) => void;
  onSelectNode?: (nodeId: string) => void;
}

const ConflictPanel: React.FC<ConflictPanelProps> = ({
  graph,
  onDismiss,
  onSelectNode
}) => {
  const conflicts = useMemo(() =>
    StateAnalyzer.detectConflicts(graph),
    [graph]
  );

  const errorCount = conflicts.filter(c => c.severity === 'error').length;
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle size={16} className="text-rose-500" />;
      case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
      default: return <Info size={16} className="text-sky-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'border-rose-500/30 bg-rose-500/10';
      case 'warning': return 'border-amber-500/30 bg-amber-500/10';
      default: return 'border-sky-500/30 bg-sky-500/10';
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
          故事冲突检测
        </h3>
        <div className="flex gap-2">
          {errorCount > 0 && (
            <div className="px-2 py-1 bg-rose-500/20 text-rose-400 rounded text-[10px] font-bold">
              {errorCount} 错误
            </div>
          )}
          {warningCount > 0 && (
            <div className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">
              {warningCount} 警告
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {conflicts.map(conflict => (
          <div
            key={conflict.id}
            className={`p-3 rounded-xl border ${getSeverityColor(conflict.severity)}
                       transition-all hover:scale-[1.02] cursor-pointer`}
            onClick={() => conflict.nodeIds[0] && onSelectNode?.(conflict.nodeIds[0])}
          >
            <div className="flex items-start gap-2">
              {getSeverityIcon(conflict.severity)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase">
                    {conflict.type.replace('_', ' ')}
                  </span>
                  {onDismiss && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(conflict.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <X size={12} className="text-slate-500" />
                    </button>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-200 mt-1">
                  {conflict.message}
                </p>
                {conflict.suggestion && (
                  <p className="text-[10px] text-slate-500 mt-1 italic">
                    💡 {conflict.suggestion}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {conflicts.length === 0 && (
          <div className="py-8 text-center border border-dashed border-emerald-500/30 rounded-xl bg-emerald-500/5">
            <div className="text-emerald-400 font-black text-sm flex items-center justify-center gap-2">
              <CheckCircle size={18} />
              未发现冲突
            </div>
            <div className="text-slate-500 text-[10px] mt-1">故事结构完整</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConflictPanel;
