
import React from 'react';
import { NodeType } from '../types';
import { Film } from 'lucide-react';

interface NodePaletteProps {
  onAddNode: (type: NodeType) => void;
}

const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  // v0.2: Simplified to only one node type - SCENE
  // All nodes are scenes now, with dynamic classification based on connections
  const addSceneNode = () => {
    onAddNode(NodeType.SCENE);
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">剧情节点 (v0.2)</h3>

      <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 mb-4">
        <p className="text-[10px] text-indigo-300 leading-relaxed">
          所有节点统一为 <span className="font-bold">Scene</span> 类型，系统会根据连线自动分类：
        </p>
        <ul className="text-[9px] text-indigo-400 mt-2 space-y-1">
          <li>🔵 <span className="font-semibold">标准剧情</span> - 有入边和出边</li>
          <li>🟣 <span className="font-semibold">自由剧情</span> - 无连线</li>
          <li>🟢 <span className="font-semibold">起点</span> - 只有出边</li>
          <li>🔴 <span className="font-semibold">终点</span> - 只有入边</li>
          <li>🟠 <span className="font-semibold">分支剧情</span> - 选项后的专属剧情（属性面板设置）</li>
        </ul>
      </div>

      <button
        onClick={addSceneNode}
        className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 transition-all border border-sky-400/30 text-left active:scale-[0.98] shadow-lg shadow-sky-900/20"
      >
        <div className="p-3 rounded-lg bg-white/20 text-white">
          <Film size={24} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-white">添加剧情节点</span>
          <span className="text-[10px] text-sky-100 font-medium">Add Scene Node</span>
        </div>
      </button>
    </div>
  );
};

export default NodePalette;
