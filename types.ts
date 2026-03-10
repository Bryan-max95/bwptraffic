
export enum NodeType {
  ROUTER = 'ROUTER',
  SWITCH = 'SWITCH',
  FIREWALL = 'FIREWALL',
  SERVER = 'SERVER',
  CLOUD = 'CLOUD',
  PC = 'PC'
}

export enum NodeStatus {
  STOPPED = 'STOPPED',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR'
}

export interface NodePort {
  id: string;
  name: string;
  isUsed: boolean;
}

export interface NetworkNode {
  id: string;
  type: NodeType;
  modelName?: string;
  name: string;
  x: number;
  y: number;
  status: NodeStatus;
  ports: NodePort[];
  image?: string;
  ipAddress?: string;
}

export interface Connection {
  id: string;
  name?: string;
  sourceId: string;
  targetId: string;
  sourcePort: string;
  targetPort: string;
  color?: string;
  curvature?: number; // Offset for the curve midpoint
}

export interface TerminalMessage {
  role: 'user' | 'system' | 'ai' | 'packet';
  text: string;
}

export interface Packet {
  id: string;
  connectionId: string;
  type: 'DATA' | 'MAIL' | 'PING' | 'VOICE';
  reverse: boolean; // false: source -> target, true: target -> source
}
