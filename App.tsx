
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  NetworkNode, 
  NodeType, 
  NodeStatus, 
  Connection,
  TerminalMessage,
  Packet
} from './types';
import Node, { getPortRelativePos } from './components/Node';
import ConnectionLine from './components/ConnectionLine';
import Terminal from './components/Terminal';
import { 
  Plus, Play, Square, Trash2, Layers, Router, HardDrive, Shield, Cloud, Monitor, Server,
  Settings2, Cpu, Zap, LayoutGrid, Save, Download, CheckCircle2, Link as LinkIcon, X,
  ChevronRight, Database, Globe, ArrowRightLeft, CircleDot, Unplug, Info, Edit3, Wifi,
  ZoomIn, ZoomOut, Maximize, MousePointer2, Hand, Trash, Send, Activity, Mail, Database as DbIcon, Phone,
  Ban, ShieldAlert
} from 'lucide-react';

interface DrawingState {
  sourceNodeId: string;
  sourcePort: string;
  startX: number;
  startY: number;
}

interface DeviceModel {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface InlineEditState {
  connectionId: string;
  type: 'source' | 'target' | 'name';
  x: number;
  y: number;
  value: string;
}

interface ConnectionWizardState {
  sourceId: string;
  targetId: string;
  selectedSourcePort: string | null;
  selectedTargetPort: string | null;
}

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface TrafficSimulation {
  connectionId: string;
  type: Packet['type'];
  reverse: boolean;
}

const DEVICE_MODELS: Record<NodeType, DeviceModel[]> = {
  [NodeType.ROUTER]: [
    { id: 'c7200', name: 'Cisco 7200', description: 'Classic High-Performance Router', icon: <Router size={24} /> },
    { id: 'vSRX', name: 'Juniper vSRX', description: 'Next-Gen Virtual Router', icon: <Shield size={24} /> },
    { id: 'mikrotik', name: 'MikroTik CHR', description: 'Cloud Hosted Router OS', icon: <Zap size={24} /> },
  ],
  [NodeType.SWITCH]: [
    { id: 'l2-sw', name: 'Layer 2 Switch', description: 'Standard Ethernet Switch', icon: <HardDrive size={24} /> },
    { id: 'l3-sw', name: 'Layer 3 Switch', description: 'Multilayer Switching Device', icon: <Layers size={24} /> },
    { id: 'nexus', name: 'Cisco Nexus v', description: 'Data Center Virtual Switch', icon: <Database size={24} /> },
  ],
  [NodeType.FIREWALL]: [
    { id: 'asav', name: 'Cisco ASAv', description: 'Adaptive Security Virtual Appliance', icon: <Shield size={24} /> },
    { id: 'paloalto', name: 'Palo Alto VM', description: 'Next-Gen Firewall', icon: <Shield size={24} className="text-orange-500" /> },
    { id: 'fortigate', name: 'FortiGate-VM', description: 'High-Performance Security', icon: <Shield size={24} className="text-red-500" /> },
  ],
  [NodeType.SERVER]: [
    { id: 'ubuntu', name: 'Ubuntu Server', description: 'Linux Standard Server', icon: <Server size={24} /> },
    { id: 'windows', name: 'Windows Server', description: 'Enterprise Windows VM', icon: <Monitor size={24} /> },
    { id: 'docker', name: 'Docker Host', description: 'Container Runtime Environment', icon: <Plus size={24} /> },
  ],
  [NodeType.CLOUD]: [
    { id: 'internet', name: 'Public Internet', description: 'NAT/External Connectivity', icon: <Cloud size={24} /> },
    { id: 'mgmt', name: 'Mgmt Cloud', description: 'Management Network Access', icon: <Globe size={24} /> },
  ],
  [NodeType.PC]: [
    { id: 'vpcs', name: 'VPCS', description: 'Virtual PC Simulator (Lightweight)', icon: <Monitor size={24} /> },
    { id: 'win10', name: 'Windows 10', description: 'Full Desktop Environment', icon: <Monitor size={24} /> },
  ],
};

const CONN_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
];

const App: React.FC = () => {
  const [nodes, setNodes] = useState<NetworkNode[]>([
    { id: '1', name: 'Core-R1', type: NodeType.ROUTER, modelName: 'Cisco 7200', x: 200, y: 200, status: NodeStatus.RUNNING, ports: [
      { id: 'p1', name: 'eth0', isUsed: true },
      { id: 'p2', name: 'eth1', isUsed: true },
      { id: 'p3', name: 'eth2', isUsed: false },
      { id: 'p4', name: 'eth3', isUsed: false },
    ], ipAddress: '192.168.1.1' },
    { id: '2', name: 'Access-SW1', type: NodeType.SWITCH, modelName: 'Layer 2 Switch', x: 200, y: 400, status: NodeStatus.STOPPED, ports: [
      { id: 'p1', name: 'eth0', isUsed: true },
      { id: 'p2', name: 'eth1', isUsed: false },
      { id: 'p3', name: 'eth2', isUsed: false },
      { id: 'p4', name: 'eth3', isUsed: false },
    ] },
    { id: '3', name: 'Gateway-FW', type: NodeType.FIREWALL, modelName: 'Cisco ASAv', x: 500, y: 200, status: NodeStatus.RUNNING, ports: [
      { id: 'p1', name: 'eth0', isUsed: true },
      { id: 'p2', name: 'eth1', isUsed: false },
      { id: 'p3', name: 'eth2', isUsed: false },
      { id: 'p4', name: 'eth3', isUsed: false },
    ], ipAddress: '10.0.0.1' },
  ]);
  const [connections, setConnections] = useState<Connection[]>([
    { id: 'c1', name: 'Trunk-01', sourceId: '1', targetId: '2', sourcePort: 'eth0', targetPort: 'eth0', color: CONN_COLORS[0] },
    { id: 'c2', name: 'WAN-Link', sourceId: '1', targetId: '3', sourcePort: 'eth1', targetPort: 'eth0', color: CONN_COLORS[1] },
  ]);
  
  const [activePackets, setActivePackets] = useState<Packet[]>([]);
  const [activeSimulations, setActiveSimulations] = useState<TrafficSimulation[]>([]);
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [showNodeInspector, setShowNodeInspector] = useState(false);
  const [newPortName, setNewPortName] = useState('');
  
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  
  const [showTerminal, setShowTerminal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<NodeType | null>(null);
  const [selectedModel, setSelectedModel] = useState<DeviceModel | null>(null);
  const [creationConfig, setCreationConfig] = useState({ name: '', ip: '' });

  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [connectionWizard, setConnectionWizard] = useState<ConnectionWizardState | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Helper to get absolute port coordinates
  const getPortCoords = useCallback((node: NetworkNode, portName: string) => {
    const index = node.ports.findIndex(p => p.name === portName);
    const total = node.ports.length;
    if (index === -1) return { x: node.x, y: node.y };
    const relPos = getPortRelativePos(index, total);
    return {
      x: node.x + relPos.x,
      y: node.y + relPos.y
    };
  }, []);

  const sendPacket = useCallback((connectionId: string, type: Packet['type'], reverse: boolean) => {
    const newPacket: Packet = {
      id: Math.random().toString(36).substr(2, 9),
      connectionId,
      type,
      reverse
    };
    setActivePackets(prev => [...prev, newPacket]);
    setTimeout(() => {
      setActivePackets(prev => prev.filter(p => p.id !== newPacket.id));
    }, 1500);
  }, []);

  // Continuous traffic simulation loop with staggered emissions per protocol
  useEffect(() => {
    const interval = setInterval(() => {
      activeSimulations.forEach((sim, idx) => {
        // Stagger emission based on simulation index to avoid visual overlap
        setTimeout(() => {
          const conn = connections.find(c => c.id === sim.connectionId);
          if (conn) {
            const source = nodes.find(n => n.id === conn.sourceId);
            const target = nodes.find(n => n.id === conn.targetId);
            if (source?.status === NodeStatus.RUNNING && target?.status === NodeStatus.RUNNING) {
              sendPacket(sim.connectionId, sim.type, sim.reverse);
            }
          }
        }, idx * 250); // Increased stagger for better visual clarity
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [activeSimulations, connections, nodes, sendPacket]);

  const toggleSimulation = (connectionId: string, type: Packet['type'], reverse: boolean) => {
    setActiveSimulations(prev => {
      const exists = prev.find(s => s.connectionId === connectionId && s.type === type && s.reverse === reverse);
      if (exists) {
        return prev.filter(s => !(s.connectionId === connectionId && s.type === type && s.reverse === reverse));
      } else {
        return [...prev, { connectionId, type, reverse }];
      }
    });
  };

  const stopAllTrafficForNode = (nodeId: string) => {
    const nodeConnections = connections.filter(c => c.sourceId === nodeId || c.targetId === nodeId).map(c => c.id);
    setActiveSimulations(prev => prev.filter(s => !nodeConnections.includes(s.connectionId)));
  };

  const wizSource = useMemo(() => connectionWizard ? nodes.find(n => n.id === connectionWizard.sourceId) : null, [connectionWizard, nodes]);
  const wizTarget = useMemo(() => connectionWizard ? nodes.find(n => n.id === connectionWizard.targetId) : null, [connectionWizard, nodes]);

  const finishDrawing = useCallback((targetNodeId: string, targetPort: string) => {
    if (!drawing || drawing.sourceNodeId === targetNodeId) {
      setDrawing(null);
      return;
    }
    setConnectionWizard({
      sourceId: drawing.sourceNodeId,
      targetId: targetNodeId,
      selectedSourcePort: drawing.sourcePort,
      selectedTargetPort: targetPort
    });
    setDrawing(null);
  }, [drawing]);

  const connectionOffsets = useMemo(() => {
    const counts: Record<string, number> = {};
    return connections.reduce((acc, conn) => {
      const pair = [conn.sourceId, conn.targetId].sort().join('-');
      const count = counts[pair] || 0;
      counts[pair] = count + 1;
      let offset = 0;
      if (count > 0) offset = Math.ceil(count / 2) * (count % 2 === 0 ? -1 : 1);
      acc[conn.id] = offset;
      return acc;
    }, {} as Record<string, number>);
  }, [connections]);

  const highlightedComponent = useMemo(() => {
    const nodeIds = new Set<string>();
    const connectionIds = new Set<string>();
    let startNodes: string[] = [];

    if (selectedNodeId) {
      startNodes = [selectedNodeId];
    } else if (selectedConnectionId) {
      const conn = connections.find(c => c.id === selectedConnectionId);
      if (conn) {
        startNodes = [conn.sourceId, conn.targetId];
      }
    }

    if (startNodes.length === 0) return { nodeIds, connectionIds };

    const queue = [...startNodes];
    startNodes.forEach(id => nodeIds.add(id));

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      connections.forEach(conn => {
        if (conn.sourceId === currentId || conn.targetId === currentId) {
          connectionIds.add(conn.id);
          const neighborId = conn.sourceId === currentId ? conn.targetId : conn.sourceId;
          if (!nodeIds.has(neighborId)) {
            nodeIds.add(neighborId);
            queue.push(neighborId);
          }
        }
      });
    }
    return { nodeIds, connectionIds };
  }, [selectedNodeId, selectedConnectionId, connections]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomFactor = 0.1;
      const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
      const newScale = Math.min(Math.max(viewTransform.scale + delta, 0.2), 3);
      setViewTransform(prev => ({ ...prev, scale: newScale }));
    }
  }, [viewTransform.scale]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX - viewTransform.x) / viewTransform.scale;
      const worldY = (mouseY - viewTransform.y) / viewTransform.scale;

      if (panning) {
        setViewTransform(prev => ({
          ...prev,
          x: e.clientX - panStart.current.x,
          y: e.clientY - panStart.current.y
        }));
      }

      if (draggingNodeId) {
        setNodes(prev => prev.map(n => n.id === draggingNodeId ? { 
          ...n, 
          x: worldX - dragOffset.current.x, 
          y: worldY - dragOffset.current.y 
        } : n));
      }

      if (drawing) {
        setMousePos({ x: worldX, y: worldY });
      }
    };

    const handleGlobalMouseUp = () => {
      setDraggingNodeId(null);
      setPanning(false);
      setDrawing(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingNodeId, drawing, panning, viewTransform]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setPanning(true);
      panStart.current = {
        x: e.clientX - viewTransform.x,
        y: e.clientY - viewTransform.y
      };
    } else {
      setSelectedNodeId(null);
      setSelectedConnectionId(null);
      setInlineEdit(null);
      setShowNodeInspector(false);
      setEditingConnection(null);
    }
  };

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingType || !selectedModel) return;
    const newNode: NetworkNode = {
      id: Math.random().toString(36).substr(2, 9),
      name: creationConfig.name || `${selectedModel.name}-${nodes.length + 1}`,
      type: pendingType,
      modelName: selectedModel.name,
      x: (400 - viewTransform.x) / viewTransform.scale,
      y: (300 - viewTransform.y) / viewTransform.scale,
      status: NodeStatus.STOPPED,
      ports: [
        { id: 'p1', name: 'eth0', isUsed: false },
        { id: 'p2', name: 'eth1', isUsed: false },
        { id: 'p3', name: 'eth2', isUsed: false },
        { id: 'p4', name: 'eth3', isUsed: false },
      ],
      ipAddress: creationConfig.ip || undefined
    };
    setNodes(prev => [...prev, newNode]);
    setPendingType(null); setSelectedModel(null); setCreationConfig({ name: '', ip: '' });
  };

  const finalizeConnection = () => {
    if (!connectionWizard?.selectedSourcePort || !connectionWizard?.selectedTargetPort) return;
    const newConnection: Connection = {
      id: `c-${Date.now()}`,
      name: 'Link',
      sourceId: connectionWizard.sourceId,
      targetId: connectionWizard.targetId,
      sourcePort: connectionWizard.selectedSourcePort,
      targetPort: connectionWizard.selectedTargetPort,
      color: CONN_COLORS[connections.length % CONN_COLORS.length]
    };
    setConnections(prev => [...prev, newConnection]);
    setNodes(prev => prev.map(n => {
      if (n.id === connectionWizard.sourceId || n.id === connectionWizard.targetId) {
        const portName = n.id === connectionWizard.sourceId ? connectionWizard.selectedSourcePort : connectionWizard.selectedTargetPort;
        return {
          ...n,
          ports: n.ports.map(p => p.name === portName ? { ...p, isUsed: true } : p)
        };
      }
      return n;
    }));
    setConnectionWizard(null);
  };

  const updateConnection = (updatedConn: Connection) => {
    const original = connections.find(c => c.id === updatedConn.id);
    if (!original) return;

    setConnections(prev => prev.map(c => c.id === updatedConn.id ? updatedConn : c));

    setNodes(prev => prev.map(node => {
      let newPorts = [...node.ports];
      if (node.id === original.sourceId) newPorts = newPorts.map(p => p.name === original.sourcePort ? { ...p, isUsed: false } : p);
      if (node.id === original.targetId) newPorts = newPorts.map(p => p.name === original.targetPort ? { ...p, isUsed: false } : p);

      if (node.id === updatedConn.sourceId) newPorts = newPorts.map(p => p.name === updatedConn.sourcePort ? { ...p, isUsed: true } : p);
      if (node.id === updatedConn.targetId) newPorts = newPorts.map(p => p.name === updatedConn.targetPort ? { ...p, isUsed: true } : p);

      return { ...node, ports: newPorts };
    }));
    setEditingConnection(null);
  };

  const addPort = (nodeId: string) => {
    if (!newPortName.trim()) return;
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        if (n.ports.some(p => p.name === newPortName)) return n;
        return {
          ...n,
          ports: [...n.ports, { id: `p-${Date.now()}`, name: newPortName, isUsed: false }]
        };
      }
      return n;
    }));
    setNewPortName('');
  };

  const removePort = (nodeId: string, portName: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          ports: n.ports.filter(p => p.name !== portName)
        };
      }
      return n;
    }));

    setConnections(prev => prev.filter(c => {
      const isSrc = c.sourceId === nodeId && c.sourcePort === portName;
      const isTgt = c.targetId === nodeId && c.targetPort === portName;
      return !(isSrc || isTgt);
    }));
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  const neighbors = useMemo(() => {
    if (!selectedNodeId) return [];
    return connections
      .filter(c => c.sourceId === selectedNodeId || c.targetId === selectedNodeId)
      .map(c => {
        const neighborId = c.sourceId === selectedNodeId ? c.targetId : c.sourceId;
        const neighbor = nodes.find(n => n.id === neighborId);
        return {
          node: neighbor,
          connectionId: c.id,
          reverse: c.targetId === selectedNodeId
        };
      });
  }, [selectedNodeId, connections, nodes]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 font-sans">
      <aside className="w-16 md:w-20 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-6 gap-6 z-30 shadow-2xl">
        <div className="p-3 bg-blue-600 rounded-xl mb-4 shadow-lg shadow-blue-500/20"><Zap className="text-white" size={24} /></div>
        <ToolButton icon={<Router />} label="Router" onClick={() => setPendingType(NodeType.ROUTER)} />
        <ToolButton icon={<HardDrive />} label="Switch" onClick={() => setPendingType(NodeType.SWITCH)} />
        <ToolButton icon={<Shield />} label="Firewall" onClick={() => setPendingType(NodeType.FIREWALL)} />
        <ToolButton icon={<Server />} label="Server" onClick={() => setPendingType(NodeType.SERVER)} />
        <ToolButton icon={<Monitor />} label="PC" onClick={() => setPendingType(NodeType.PC)} />
        <ToolButton icon={<Cloud />} label="Cloud" onClick={() => setPendingType(NodeType.CLOUD)} />
        <div className="mt-auto pb-4"><ToolButton icon={<Settings2 />} label="Settings" /></div>
      </aside>

      <main className="flex-1 flex flex-col relative">
        <header className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold tracking-tight text-slate-200">bwp traffic</h1>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex gap-3">
              <HeaderBtn icon={selectedNode?.status === NodeStatus.RUNNING ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />} label={selectedNode?.status === NodeStatus.RUNNING ? 'STOP' : 'START'} onClick={() => {
                if (!selectedNodeId) return;
                const newStatus = selectedNode.status === NodeStatus.RUNNING ? NodeStatus.STOPPED : NodeStatus.RUNNING;
                setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, status: newStatus } : n));
                if (newStatus === NodeStatus.STOPPED) {
                  stopAllTrafficForNode(selectedNodeId);
                }
              }} disabled={!selectedNodeId} color={selectedNode?.status === NodeStatus.RUNNING ? 'orange' : 'green'} />
              <HeaderBtn icon={<Monitor size={14} />} label="CONSOLE" onClick={() => setShowTerminal(true)} disabled={!selectedNodeId || selectedNode?.status !== NodeStatus.RUNNING} color="blue" />
              <HeaderBtn icon={<Info size={14} />} label="INSPECT" onClick={() => setShowNodeInspector(true)} disabled={!selectedNodeId} color="slate" />
              <HeaderBtn icon={<Trash2 size={14} />} label="DELETE" onClick={() => {
                if (selectedNodeId) { setNodes(prev => prev.filter(n => n.id !== selectedNodeId)); setConnections(prev => prev.filter(c => c.sourceId !== selectedNodeId && c.targetId !== selectedNodeId)); setSelectedNodeId(null); }
                else if (selectedConnectionId) { setConnections(prev => prev.filter(c => c.id !== selectedConnectionId)); setSelectedConnectionId(null); }
              }} disabled={!selectedNodeId && !selectedConnectionId} color="red" />
              <div className="h-4 w-px bg-slate-700 mx-1" />
              <HeaderBtn icon={<Save size={14} />} label="SAVE" onClick={() => {
                localStorage.setItem('eve_webx_topology', JSON.stringify({ nodes, connections }));
                setSaveStatus('Topology Saved');
                setTimeout(() => setSaveStatus(null), 3000);
              }} color="slate" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            {saveStatus && <span className="text-green-400 animate-pulse">{saveStatus}</span>}
            <div className="flex items-center gap-2 font-mono bg-slate-800 px-3 py-1 rounded-full text-blue-400">
               Zoom: {(viewTransform.scale * 100).toFixed(0)}%
            </div>
          </div>
        </header>

        <div className="absolute bottom-12 left-6 z-40 flex flex-col gap-2">
           <div className="bg-slate-950/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 flex flex-col gap-1 shadow-2xl">
              <NavBtn icon={<ZoomIn size={18} />} onClick={() => setViewTransform(p => ({...p, scale: Math.min(p.scale + 0.1, 3)}))} />
              <NavBtn icon={<ZoomOut size={18} />} onClick={() => setViewTransform(p => ({...p, scale: Math.max(p.scale - 0.1, 0.2)}))} />
              <div className="h-px bg-slate-800 mx-2" />
              <NavBtn icon={<Maximize size={18} />} onClick={() => setViewTransform({ x: 0, y: 0, scale: 1 })} />
           </div>
           <div className="bg-slate-950/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 flex flex-col gap-1 shadow-2xl">
              <NavBtn active={!panning} icon={<MousePointer2 size={18} />} onClick={() => setPanning(false)} />
              <NavBtn active={panning} icon={<Hand size={18} />} onClick={() => setPanning(true)} />
           </div>
        </div>

        <div 
          ref={canvasRef} 
          className={`flex-1 relative overflow-hidden grid-bg select-none ${panning ? 'cursor-grab' : 'cursor-default'}`}
          onMouseDown={handleCanvasMouseDown}
          onWheel={handleWheel}
        >
          <div 
            className="absolute inset-0 origin-top-left will-change-transform"
            style={{ 
              transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})` 
            }}
          >
            {drawing && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-40 overflow-visible">
                <line 
                  x1={drawing.startX} 
                  y1={drawing.startY} 
                  x2={mousePos.x} 
                  y2={mousePos.y} 
                  stroke="#60a5fa" 
                  strokeWidth={2} 
                  strokeDasharray="5,5" 
                />
              </svg>
            )}

            {connections.map(conn => {
              const source = nodes.find(n => n.id === conn.sourceId);
              const target = nodes.find(n => n.id === conn.targetId);
              if (!source || !target) return null;

              const sourcePortPos = getPortCoords(source, conn.sourcePort);
              const targetPortPos = getPortCoords(target, conn.targetPort);

              return (
                <ConnectionLine 
                  key={conn.id} 
                  connection={conn} 
                  source={source} 
                  target={target} 
                  sourcePortPos={sourcePortPos}
                  targetPortPos={targetPortPos}
                  allNodes={nodes}
                  isActive={source.status === NodeStatus.RUNNING && target.status === NodeStatus.RUNNING} 
                  isSelected={selectedConnectionId === conn.id} 
                  isHighlighted={highlightedComponent.connectionIds.has(conn.id)} 
                  indexOffset={connectionOffsets[conn.id]} 
                  packets={activePackets.filter(p => p.connectionId === conn.id)}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setSelectedNodeId(null); 
                    setSelectedConnectionId(conn.id); 
                    setEditingConnection(conn);
                  }} 
                  onLabelClick={(type, x, y) => setInlineEdit({ connectionId: conn.id, type, x, y, value: type === 'name' ? (conn.name || '') : (type === 'source' ? conn.sourcePort : conn.targetPort) })} 
                />
              );
            })}

            {nodes.map(node => (
              <Node 
                key={node.id} 
                node={node} 
                isSelected={selectedNodeId === node.id} 
                isHighlighted={highlightedComponent.nodeIds.has(node.id)} 
                onMouseDown={(e) => { 
                  if (panning || e.button !== 0) return;
                  e.stopPropagation(); 
                  const rect = canvasRef.current!.getBoundingClientRect();
                  const worldX = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale;
                  const worldY = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale;
                  dragOffset.current = { 
                    x: worldX - node.x, 
                    y: worldY - node.y 
                  }; 
                  setDraggingNodeId(node.id); 
                  setSelectedNodeId(node.id); 
                  setSelectedConnectionId(null); 
                }} 
                onSelect={() => { 
                  setSelectedNodeId(node.id); 
                  setSelectedConnectionId(null); 
                }} 
                onPortMouseDown={(port, e) => { 
                  if (panning) return;
                  e.stopPropagation();
                  const portCoords = getPortCoords(node, port);
                  setDrawing({ 
                    sourceNodeId: node.id, 
                    sourcePort: port, 
                    startX: portCoords.x, 
                    startY: portCoords.y 
                  }); 
                  setMousePos({ x: portCoords.x, y: portCoords.y }); 
                }} 
                onPortMouseUp={(port) => finishDrawing(node.id, port)} 
              />
            ))}

            {inlineEdit && (
              <div 
                className="absolute z-[100] transform -translate-x-1/2 -translate-y-1/2" 
                style={{ left: inlineEdit.x, top: inlineEdit.y }} 
                onClick={e => e.stopPropagation()}
              >
                <form onSubmit={(e) => {
                  e.preventDefault();
                  setConnections(prev => prev.map(c => c.id === inlineEdit.connectionId ? { ...c, [inlineEdit.type === 'name' ? 'name' : inlineEdit.type === 'source' ? 'sourcePort' : 'targetPort']: inlineEdit.value } : c));
                  setInlineEdit(null);
                }}>
                  <input autoFocus className="bg-slate-900 border-2 border-blue-500 rounded px-2 py-0.5 text-[10px] text-white outline-none shadow-xl min-w-[60px]" value={inlineEdit.value} onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })} onBlur={() => setInlineEdit(null)} />
                </form>
              </div>
            )}
          </div>
        </div>

        {showNodeInspector && selectedNode && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 z-50 p-6 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex justify-between items-center mb-8 shrink-0">
              <h3 className="text-xl font-black text-white flex items-center gap-3"><Edit3 className="text-blue-500" /> Device Setup</h3>
              <button onClick={() => setShowNodeInspector(false)} className="p-2 hover:bg-slate-800 rounded-full"><X /></button>
            </div>
            <div className="space-y-6 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 tracking-widest">Display Name</label>
                <input className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors" value={selectedNode.name} onChange={e => setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, name: e.target.value } : n))} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 tracking-widest">Management IP</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono focus:border-blue-500 outline-none transition-colors text-blue-400" 
                  value={selectedNode.ipAddress || ''} 
                  placeholder="e.g. 192.168.1.1" 
                  onChange={e => setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, ipAddress: e.target.value } : n))} 
                />
              </div>
              
              <div className="border-t border-slate-800 pt-6">
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-4 flex items-center justify-between tracking-widest">
                  <div className="flex items-center gap-2"><Activity size={12} className="text-blue-500" /> Traffic Generator</div>
                  {activeSimulations.some(s => connections.find(c => c.id === s.connectionId && (c.sourceId === selectedNode.id || c.targetId === selectedNode.id))) && (
                    <span className="text-[8px] animate-pulse text-green-500 font-black">STREAMS ACTIVE</span>
                  )}
                </label>
                
                {selectedNode.status !== NodeStatus.RUNNING ? (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-[10px] text-orange-400 font-bold text-center">
                    Power on device to simulate traffic
                  </div>
                ) : neighbors.length === 0 ? (
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-500 font-bold text-center italic">
                    No connections available
                  </div>
                ) : (
                  <div className="space-y-3">
                    {neighbors.map(({ node: neighbor, connectionId, reverse }) => neighbor && (
                      <div key={neighbor.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-white">Target: {neighbor.name}</span>
                          <button 
                            onClick={() => stopAllTrafficForNode(selectedNode.id)}
                            className="text-[9px] font-bold text-red-500 hover:text-red-400 flex items-center gap-1 uppercase transition-colors"
                            title="Kill all streams for this device"
                          >
                            <Ban size={10} /> Kill All
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <TrafficBtn 
                            icon={<Wifi size={14} />} 
                            label="PING" 
                            color="red" 
                            active={!!activeSimulations.find(s => s.connectionId === connectionId && s.type === 'PING' && s.reverse === reverse)}
                            onClick={() => toggleSimulation(connectionId, 'PING', reverse)} 
                          />
                          <TrafficBtn 
                            icon={<Mail size={14} />} 
                            label="MAIL" 
                            color="amber" 
                            active={!!activeSimulations.find(s => s.connectionId === connectionId && s.type === 'MAIL' && s.reverse === reverse)}
                            onClick={() => toggleSimulation(connectionId, 'MAIL', reverse)} 
                          />
                          <TrafficBtn 
                            icon={<DbIcon size={14} />} 
                            label="DATA" 
                            color="blue" 
                            active={!!activeSimulations.find(s => s.connectionId === connectionId && s.type === 'DATA' && s.reverse === reverse)}
                            onClick={() => toggleSimulation(connectionId, 'DATA', reverse)} 
                          />
                          <TrafficBtn 
                            icon={<Phone size={14} />} 
                            label="VOICE" 
                            color="green" 
                            active={!!activeSimulations.find(s => s.connectionId === connectionId && s.type === 'VOICE' && s.reverse === reverse)}
                            onClick={() => toggleSimulation(connectionId, 'VOICE', reverse)} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase block tracking-widest">Port Management</label>
                  <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-blue-400 font-bold">{selectedNode.ports.length} TOTAL</span>
                </div>
                
                <div className="flex gap-2 mb-4">
                  <input 
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:border-blue-500 outline-none" 
                    placeholder="New Port (e.g. gig0/1)"
                    value={newPortName}
                    onChange={e => setNewPortName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addPort(selectedNode.id)}
                  />
                  <button 
                    onClick={() => addPort(selectedNode.id)}
                    className="p-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedNode.ports.map(p => {
                    const used = connections.some(c => (c.sourceId === selectedNode.id && c.sourcePort === p.name) || (c.targetId === selectedNode.id && c.targetPort === p.name));
                    return (
                      <div key={p.id} className="group flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${used ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-600'}`} />
                          <span className="text-xs font-mono font-bold tracking-tight">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {used && <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">CONNECTED</span>}
                          <button 
                            onClick={() => removePort(selectedNode.id, p.name)}
                            className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove interface"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {editingConnection && (
          <ConnectionEditor 
            connection={editingConnection}
            nodes={nodes}
            connections={connections}
            onSave={updateConnection}
            onClose={() => setEditingConnection(null)}
          />
        )}

        {connectionWizard && wizSource && wizTarget && <PortWizard wizard={connectionWizard} setWizard={setConnectionWizard} source={wizSource} target={wizTarget} connections={connections} finalize={finalizeConnection} />}
        {pendingType && <ModelSelector type={pendingType} setType={setPendingType} onAdd={handleAddModel} config={creationConfig} setConfig={setCreationConfig} selectedModel={selectedModel} setSelectedModel={setSelectedModel} nodeCount={nodes.length} />}
        {showTerminal && <Terminal node={selectedNode} nodes={nodes} connections={connections} onClose={() => setShowTerminal(false)} />}
        
        <footer className="h-8 bg-slate-950 border-t border-slate-800 flex items-center px-4 justify-between text-[10px] uppercase tracking-widest font-bold text-slate-500">
          <div className="flex gap-4"><span>Nodes: {nodes.length}</span><span>Links: {connections.length}</span><span>Scale: {(viewTransform.scale * 100).toFixed(0)}%</span></div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${activeSimulations.length > 0 ? 'bg-blue-500 animate-ping' : 'bg-green-500'}`} />
            <span>{activeSimulations.length > 0 ? 'Simulation Traffic Processing' : 'System Fabric Online'}</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

// Internal Components
const HeaderBtn: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void, disabled?: boolean, color: string }> = ({ icon, label, onClick, disabled, color }) => {
  const colors: any = { green: 'bg-green-500/20 text-green-400', orange: 'bg-orange-500/20 text-orange-400', blue: 'bg-blue-500/20 text-blue-400', red: 'bg-red-500/20 text-red-400', slate: 'bg-slate-800 text-slate-300' };
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-20 ${colors[color]} hover:scale-105 active:scale-95`}>
      {icon} {label}
    </button>
  );
};

const TrafficBtn: React.FC<{ icon: React.ReactNode, label: string, color: string, active?: boolean, onClick: () => void }> = ({ icon, label, color, active, onClick }) => {
  const colors: any = { 
    red: active ? 'bg-red-500 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'hover:bg-red-500/20 text-red-400 border-red-500/30', 
    amber: active ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'hover:bg-amber-500/20 text-amber-400 border-amber-500/30', 
    blue: active ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'hover:bg-blue-500/20 text-blue-400 border-blue-500/30', 
    green: active ? 'bg-green-500 text-white border-green-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'hover:bg-green-500/20 text-green-400 border-green-500/30' 
  };
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 ${colors[color]}`}
    >
      {icon}
      <span className="text-[7px] font-black mt-1 uppercase tracking-widest">{label}</span>
    </button>
  );
};

const ToolButton: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="relative group flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white hover:bg-blue-600 transition-all duration-200">
    {React.cloneElement(icon as any, { size: 20 })}
    <span className="absolute left-14 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700 whitespace-nowrap z-50">{label}</span>
  </button>
);

const NavBtn: React.FC<{ icon: React.ReactNode, onClick: () => void, active?: boolean }> = ({ icon, onClick, active }) => (
  <button onClick={onClick} className={`p-2.5 rounded-xl transition-all ${active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
    {icon}
  </button>
);

const PortWizard: React.FC<any> = ({ wizard, setWizard, source, target, connections, finalize }) => (
  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg z-[80] flex items-center justify-center p-6 animate-in fade-in">
    <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
      <div className="p-8 border-b border-slate-800 flex justify-between items-center shrink-0">
        <div><h2 className="text-2xl font-black text-white mb-1">Interface Link Manager</h2><p className="text-xs text-slate-400">Establish connection between physical ports.</p></div>
        <button onClick={() => setWizard(null)} className="p-2 hover:bg-slate-800 rounded-full"><X /></button>
      </div>
      <div className="flex-1 p-8 flex gap-8 overflow-hidden">
        {[ { node: source, label: 'Source', sel: 'selectedSourcePort', color: 'blue' }, { node: target, label: 'Target', sel: 'selectedTargetPort', color: 'green' } ].map((group, idx) => (
          <div key={idx} className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className={`p-4 bg-slate-800/50 rounded-xl border-l-4 border-blue-500 shrink-0`}><div className="text-[9px] font-black text-slate-500 uppercase">{group.label}</div><div className="text-sm font-bold">{group.node.name}</div></div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1">
              {group.node.ports.map((p: any) => {
                const used = connections.some((c: any) => (c.sourceId === group.node.id && c.sourcePort === p.name) || (c.targetId === group.node.id && c.targetPort === p.name));
                const selected = wizard[group.sel] === p.name;
                return (
                  <button key={p.id} disabled={used} onClick={() => setWizard({ ...wizard, [group.sel]: p.name })} className={`p-3 rounded-lg border text-xs font-mono transition-all flex justify-between items-center ${used ? 'bg-slate-950 border-slate-800 opacity-30 grayscale cursor-not-allowed' : selected ? 'bg-blue-600/20 border-blue-500 shadow-lg' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                    <span>{p.name}</span> {used ? <Unplug size={12} /> : <CircleDot size={12} className={selected ? 'text-blue-400' : 'text-slate-600'} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="p-8 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-4 shrink-0">
        <button onClick={() => setWizard(null)} className="text-xs font-bold text-slate-500 hover:text-white">CANCEL</button>
        <button onClick={finalize} disabled={!wizard.selectedSourcePort || !wizard.selectedTargetPort} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-20 rounded-xl text-xs font-black text-white shadow-xl shadow-blue-600/20 transition-all uppercase tracking-widest">Connect Interfances</button>
      </div>
    </div>
  </div>
);

const ConnectionEditor: React.FC<{ 
  connection: Connection, 
  nodes: NetworkNode[], 
  connections: Connection[],
  onSave: (c: Connection) => void, 
  onClose: () => void 
}> = ({ connection, nodes, connections, onSave, onClose }) => {
  const [draft, setDraft] = useState<Connection>({ ...connection });
  const sourceNode = nodes.find(n => n.id === draft.sourceId);
  const targetNode = nodes.find(n => n.id === draft.targetId);

  const isPortAvailable = (nodeId: string, portName: string, currentPortName: string) => {
    if (portName === currentPortName) return true;
    return !connections.some(c => (c.sourceId === nodeId && c.sourcePort === portName) || (c.targetId === nodeId && c.targetPort === portName));
  };

  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[80] flex items-center justify-center p-6 animate-in zoom-in-95">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500"><LinkIcon size={20} /></div>
            <h2 className="text-2xl font-black text-white">Edit Connection</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X /></button>
        </div>
        
        <div className="p-8 space-y-8">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 ml-1 tracking-widest">Node Hostname</label>
            <input 
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors"
              value={draft.name || ''}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Backbone Trunk"
            />
          </div>

          <div className="grid grid-cols-2 gap-8 items-start">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-3 ml-1 tracking-widest">Source: {sourceNode?.name}</label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {sourceNode?.ports.map(p => {
                  const available = isPortAvailable(draft.sourceId, p.name, connection.sourcePort);
                  const selected = draft.sourcePort === p.name;
                  return (
                    <button 
                      key={p.id}
                      disabled={!available}
                      onClick={() => setDraft({ ...draft, sourcePort: p.name })}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-mono transition-all
                        ${!available ? 'bg-slate-950 border-slate-800 opacity-20 grayscale cursor-not-allowed' : 
                          selected ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 hover:border-slate-500 text-slate-400'}
                      `}
                    >
                      {p.name}
                      {selected && <CircleDot size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-3 ml-1 tracking-widest">Target: {targetNode?.name}</label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {targetNode?.ports.map(p => {
                  const available = isPortAvailable(draft.targetId, p.name, connection.targetPort);
                  const selected = draft.targetPort === p.name;
                  return (
                    <button 
                      key={p.id}
                      disabled={!available}
                      onClick={() => setDraft({ ...draft, targetPort: p.name })}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-mono transition-all
                        ${!available ? 'bg-slate-950 border-slate-800 opacity-20 grayscale cursor-not-allowed' : 
                          selected ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 hover:border-slate-500 text-slate-400'}
                      `}
                    >
                      {p.name}
                      {selected && <CircleDot size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-white transition-colors">DISCARD</button>
          <button 
            onClick={() => onSave(draft)}
            className="px-10 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black text-white shadow-xl shadow-blue-600/20 transition-all uppercase tracking-widest"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const ModelSelector: React.FC<any> = ({ type, setType, onAdd, config, setConfig, selectedModel, setSelectedModel, nodeCount }) => (
  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-6 animate-in zoom-in-95">
    <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div className="p-8 border-b border-slate-800 flex justify-between items-center">
        <div><h2 className="text-3xl font-black text-white mb-1">Deploy {type}</h2><p className="text-sm text-slate-400 tracking-tight">Select an OS image to instantiate on the virtual fabric.</p></div>
        <button onClick={() => setType(null)} className="p-2 hover:bg-slate-800 rounded-full"><X /></button>
      </div>
      <div className="flex-1 p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
        {DEVICE_MODELS[type].map(model => (
          <button key={model.id} onClick={() => setSelectedModel(model)} className={`flex flex-col p-5 rounded-2xl border-2 transition-all ${selectedModel?.id === model.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}>
            <div className="p-3 bg-slate-800 rounded-lg w-fit mb-3 text-blue-400">{model.icon}</div>
            <h3 className="text-base font-bold text-white mb-1">{model.name}</h3>
            <p className="text-[11px] text-slate-500 leading-tight">{model.description}</p>
          </button>
        ))}
      </div>
      {selectedModel && <div className="p-8 bg-slate-950 border-t border-slate-800 flex flex-col gap-6 animate-in slide-in-from-bottom-8">
        <div className="flex gap-4">
          <div className="flex-1"><label className="text-[10px] font-black text-slate-500 uppercase block mb-2 ml-1 tracking-widest">Node Hostname</label><input autoFocus className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors" value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })} placeholder={`${selectedModel.name}-${nodeCount + 1}`} /></div>
          <div className="flex-1"><label className="text-[10px] font-black text-slate-500 uppercase block mb-2 ml-1 tracking-widest">Management IP</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono focus:border-blue-500 outline-none transition-colors" value={config.ip} onChange={e => setConfig({ ...config, ip: e.target.value })} placeholder="192.168.1.x" /></div>
        </div>
        <div className="flex justify-end gap-3"><button onClick={() => setSelectedModel(null)} className="text-xs font-bold text-slate-500 hover:text-white transition-colors">BACK</button><button onClick={onAdd} className="bg-blue-600 px-8 py-3 rounded-xl text-xs font-black hover:bg-blue-500 shadow-xl shadow-blue-600/20 transition-all">ADD NODE</button></div>
      </div>}
    </div>
  </div>
);

export default App;
