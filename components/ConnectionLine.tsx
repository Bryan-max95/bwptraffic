
import React, { useMemo } from 'react';
import { NetworkNode, Connection, Packet } from '../types';

interface ConnectionLineProps {
  connection: Connection;
  source: NetworkNode;
  target: NetworkNode;
  sourcePortPos: { x: number, y: number };
  targetPortPos: { x: number, y: number };
  allNodes: NetworkNode[];
  isActive: boolean;
  isSelected: boolean;
  isHighlighted?: boolean;
  indexOffset?: number; 
  packets?: Packet[];
  onClick: (e: React.MouseEvent) => void;
  onLabelClick: (type: 'source' | 'target' | 'name', x: number, y: number, e: React.MouseEvent) => void;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ 
  connection, 
  source, 
  target, 
  sourcePortPos,
  targetPortPos,
  allNodes,
  isActive, 
  isSelected, 
  isHighlighted,
  indexOffset = 0,
  packets = [],
  onClick,
  onLabelClick
}) => {
  const pathData = useMemo(() => {
    const startX = sourcePortPos.x;
    const startY = sourcePortPos.y;
    const endX = targetPortPos.x;
    const endY = targetPortPos.y;

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    
    const nx = -dy / len;
    const ny = dx / len;
    
    let totalOffset = indexOffset * 40;

    const avoidanceThreshold = 60; 
    const avoidancePush = 45;

    allNodes.forEach(node => {
      if (node.id === source.id || node.id === target.id) return;

      const vax = node.x - startX;
      const vay = node.y - startY;

      const t = Math.max(0, Math.min(1, (vax * dx + vay * dy) / (len * len)));
      const projX = startX + t * dx;
      const projY = startY + t * dy;

      const distToLine = Math.sqrt((node.x - projX) ** 2 + (node.y - projY) ** 2);

      if (distToLine < avoidanceThreshold && t > 0.1 && t < 0.9) {
        const side = (node.x - startX) * (-dy) + (node.y - startY) * dx;
        const nodeSide = side >= 0 ? 1 : -1;
        const force = (1 - distToLine / avoidanceThreshold) * avoidancePush;
        totalOffset -= nodeSide * force;
      }
    });

    const ctrlX = midX + nx * totalOffset;
    const ctrlY = midY + ny * totalOffset;

    const pathD = `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
    const reversePathD = `M ${endX} ${endY} Q ${ctrlX} ${ctrlY} ${startX} ${startY}`;

    const labelX = 0.25 * startX + 0.5 * ctrlX + 0.25 * endX;
    const labelY = 0.25 * startY + 0.5 * ctrlY + 0.25 * endY;

    const srcLabelX = 0.64 * startX + 0.32 * ctrlX + 0.04 * endX;
    const srcLabelY = 0.64 * startY + 0.32 * ctrlY + 0.04 * endY;

    const tgtLabelX = 0.04 * startX + 0.32 * ctrlX + 0.64 * endX;
    const tgtLabelY = 0.04 * startY + 0.32 * ctrlY + 0.64 * endY;

    return { pathD, reversePathD, labelX, labelY, srcLabelX, srcLabelY, tgtLabelX, tgtLabelY };
  }, [sourcePortPos, targetPortPos, source.id, target.id, indexOffset, allNodes]);

  const handleLabelClick = (type: 'source' | 'target' | 'name', x: number, y: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onLabelClick(type, x, y, e);
  };

  const getPacketMeta = (type: string) => {
    switch(type) {
      case 'PING': return { color: '#ef4444', char: 'P' }; 
      case 'MAIL': return { color: '#f59e0b', char: 'M' }; 
      case 'DATA': return { color: '#3b82f6', char: 'D' }; 
      case 'VOICE': return { color: '#10b981', char: 'V' }; 
      default: return { color: '#fff', char: '?' };
    }
  };

  const baseColor = connection.color || '#94a3b8';
  const lineColor = isSelected ? '#60a5fa' : isHighlighted ? '#3b82f6' : isActive ? baseColor : '#475569';
  const lineWidth = isSelected ? 4 : isHighlighted ? 3.5 : isActive ? 3 : 2;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <path
        d={pathData.pathD}
        fill="transparent"
        stroke="transparent"
        strokeWidth={20}
        className="pointer-events-auto cursor-pointer"
        onClick={onClick}
      />
      
      <path
        d={pathData.pathD}
        fill="transparent"
        stroke={lineColor}
        strokeWidth={lineWidth}
        className={`${isActive ? 'animate-flow' : ''} pointer-events-none transition-all duration-300`}
        style={{
          filter: isHighlighted || isSelected ? `drop-shadow(0 0 6px ${lineColor}88)` : 'none',
          strokeDasharray: isActive ? '10, 5' : 'none'
        }}
      />

      {/* Enhanced Packets with Icons/Labels */}
      {packets.map((packet, idx) => {
        const { color, char } = getPacketMeta(packet.type);
        const jitterX = (idx % 3 - 1) * 8;
        const jitterY = (Math.floor(idx / 3) % 3 - 1) * 8;
        
        return (
          <g 
            key={packet.id} 
            className="packet-anim"
            style={{
              offsetPath: `path('${packet.reverse ? pathData.reversePathD : pathData.pathD}')`,
              transform: `translate(${jitterX}px, ${jitterY}px)`
            }}
          >
            <circle r="6" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <text 
              textAnchor="middle" 
              dy="3" 
              fontSize="7" 
              fontWeight="bold" 
              fill="white"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {char}
            </text>
          </g>
        );
      })}

      <g className="select-none">
        <text
          x={pathData.labelX}
          y={pathData.labelY - 15}
          textAnchor="middle"
          className={`${isSelected || isHighlighted ? 'fill-blue-300' : 'fill-slate-400'} text-[10px] font-bold uppercase tracking-tighter cursor-pointer hover:fill-blue-400 pointer-events-auto transition-colors`}
          onClick={(e) => handleLabelClick('name', pathData.labelX, pathData.labelY - 15, e)}
        >
          {connection.name || 'Link'}
        </text>
        
        <text
          x={pathData.srcLabelX}
          y={pathData.srcLabelY - 12}
          textAnchor="middle"
          className="fill-blue-400 text-[9px] font-mono font-bold cursor-pointer hover:fill-white pointer-events-auto transition-colors"
          onClick={(e) => handleLabelClick('source', pathData.srcLabelX, pathData.srcLabelY - 12, e)}
        >
          {connection.sourcePort}
        </text>

        <text
          x={pathData.tgtLabelX}
          y={pathData.tgtLabelY - 12}
          textAnchor="middle"
          className="fill-blue-400 text-[9px] font-mono font-bold cursor-pointer hover:fill-white pointer-events-auto transition-colors"
          onClick={(e) => handleLabelClick('target', pathData.tgtLabelX, pathData.tgtLabelY - 12, e)}
        >
          {connection.targetPort}
        </text>
      </g>
    </svg>
  );
};

export default ConnectionLine;
