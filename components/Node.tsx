
import React from 'react';
import { NetworkNode, NodeType, NodeStatus } from '../types';
import { Router, Server, Shield, HardDrive, Cloud, Monitor } from 'lucide-react';

interface NodeProps {
  node: NetworkNode;
  isSelected: boolean;
  isHighlighted?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onSelect: () => void;
  onPortMouseDown: (portName: string, e: React.MouseEvent) => void;
  onPortMouseUp: (portName: string, e: React.MouseEvent) => void;
}

// Global helper for consistent port positioning
export const getPortRelativePos = (index: number, total: number) => {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const radius = 35; // px from center
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
};

const Node: React.FC<NodeProps> = ({ node, isSelected, isHighlighted, onMouseDown, onSelect, onPortMouseDown, onPortMouseUp }) => {
  const getIcon = () => {
    switch (node.type) {
      case NodeType.ROUTER: return <Router size={32} />;
      case NodeType.SWITCH: return <HardDrive size={32} />;
      case NodeType.FIREWALL: return <Shield size={32} />;
      case NodeType.SERVER: return <Server size={32} />;
      case NodeType.CLOUD: return <Cloud size={32} />;
      case NodeType.PC: return <Monitor size={32} />;
      default: return <Router size={32} />;
    }
  };

  const statusColor = node.status === NodeStatus.RUNNING ? 'bg-green-500' : 'bg-slate-500';

  return (
    <div
      className={`absolute cursor-move select-none p-2 flex flex-col items-center group transition-all
        ${isSelected || isHighlighted ? 'scale-110 z-20' : 'z-10'}
      `}
      style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
      onMouseDown={onMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className={`
        relative p-4 rounded-xl border-2 transition-all duration-200
        ${isSelected 
          ? 'border-blue-400 bg-blue-500/30 shadow-2xl shadow-blue-500/40 scale-105' 
          : isHighlighted 
            ? 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/10' 
            : 'border-slate-700 bg-slate-800/80 hover:border-slate-500 shadow-md'}
      `}>
        <div className={`${isSelected || isHighlighted ? 'text-blue-400' : 'text-slate-200'}`}>
          {getIcon()}
        </div>
        
        {/* Status Indicator */}
        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${statusColor} animate-pulse`} />

        {/* Port Interactive Dots */}
        {node.ports.map((port, idx) => {
          const pos = getPortRelativePos(idx, node.ports.length);
          return (
            <div
              key={port.id}
              title={port.name}
              style={{
                left: `calc(50% + ${pos.x}px)`,
                top: `calc(50% + ${pos.y}px)`,
                transform: 'translate(-50%, -50%)'
              }}
              className={`absolute w-3 h-3 border rounded-full cursor-crosshair hover:scale-125 transition-all z-30
                ${port.isUsed ? 'bg-green-500 border-green-300 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-slate-600 border-slate-400 hover:bg-blue-500'}
              `}
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortMouseDown(port.name, e);
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                onPortMouseUp(port.name, e);
              }}
            />
          );
        })}
      </div>
      
      <div className="mt-2 flex flex-col items-center">
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors
          ${isSelected ? 'bg-blue-500 text-white shadow-lg' : isHighlighted ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-700 text-slate-300'}
        `}>
          {node.name}
        </span>
        {node.modelName && (
          <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black mt-0.5">
            {node.modelName}
          </span>
        )}
        {node.ipAddress && (
          <span className={`mt-0.5 text-[9px] font-mono tracking-tight font-medium
            ${node.status === NodeStatus.RUNNING ? 'text-green-400' : 'text-slate-500'}
          `}>
            {node.ipAddress}
          </span>
        )}
      </div>
    </div>
  );
};

export default Node;
