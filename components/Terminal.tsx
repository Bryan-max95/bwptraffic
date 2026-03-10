
import React, { useState, useEffect, useRef } from 'react';
import { NetworkNode, Connection, TerminalMessage, NodeStatus } from '../types';
import { simulateTerminalResponse } from '../services/geminiService';
import { Terminal as TerminalIcon, X, Send, Activity } from 'lucide-react';

interface TerminalProps {
  node: NetworkNode | null;
  nodes: NetworkNode[];
  connections: Connection[];
  onClose: () => void;
}

const PROTOCOLS = ['TCP', 'UDP', 'ICMP', 'ARP', 'OSPF', 'BGP', 'DHCP', 'HTTP', 'SSH'];
const PACKET_TYPES: Record<string, string[]> = {
  'TCP': ['[SYN]', '[ACK]', '[FIN]', '[PSH, ACK]'],
  'UDP': ['Datagram', 'Discovery'],
  'ICMP': ['Echo Request', 'Echo Reply', 'Destination Unreachable'],
  'ARP': ['Request (Who has IP?)', 'Reply (Is at MAC)'],
  'OSPF': ['Hello Packet', 'Link State Update'],
  'BGP': ['Update', 'Keepalive'],
  'DHCP': ['Discover', 'Offer', 'Request', 'Acknowledge'],
  'HTTP': ['GET /index.html', '200 OK'],
  'SSH': ['Key Exchange', 'Encrypted Packet']
};

const Terminal: React.FC<TerminalProps> = ({ node, nodes, connections, onClose }) => {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (node) {
      setMessages([
        { role: 'system', text: `ESTABLISHING CONSOLE SESSION TO ${node.name} [PID:${Math.floor(Math.random() * 9999)}]` },
        { role: 'ai', text: `Welcome to ${node.name} (${node.modelName || node.type}).\nAll interfaces initialized.\nType 'help' for available commands.` }
      ]);
    }
  }, [node?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, isTyping]);

  // Enhanced periodic packet activity simulation
  useEffect(() => {
    if (!node || node.status !== NodeStatus.RUNNING) return;

    const interval = setInterval(() => {
      // Increase probability of traffic if terminal is open
      if (Math.random() > 0.7 && !isTyping) {
        const activeConns = connections.filter(c => c.sourceId === node.id || c.targetId === node.id);
        if (activeConns.length > 0) {
          const conn = activeConns[Math.floor(Math.random() * activeConns.length)];
          const isSource = conn.sourceId === node.id;
          const neighborId = isSource ? conn.targetId : conn.sourceId;
          const neighbor = nodes.find(n => n.id === neighborId);
          const port = isSource ? conn.sourcePort : conn.targetPort;

          if (neighbor && neighbor.status === NodeStatus.RUNNING) {
            const isEgress = Math.random() > 0.5;
            const protocol = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];
            const types = PACKET_TYPES[protocol];
            const type = types[Math.floor(Math.random() * types.length)];

            const prefix = isEgress ? '[TX]' : '[RX]';
            const action = isEgress ? `Sent to ${neighbor.name}` : `Received from ${neighbor.name}`;
            const msgText = `${prefix} ${protocol} ${type} - ${action} via ${port}`;

            setMessages(prev => {
              // Keep last 100 messages to prevent performance issues
              const newMsgs = [...prev, { role: 'packet' as const, text: msgText }];
              return newMsgs.slice(-100);
            });
          }
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [node, nodes, connections, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !node || isTyping) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    const history = messages.filter(m => m.role === 'user' || m.role === 'ai').map(m => ({ role: m.role, text: m.text }));
    const aiResponse = await simulateTerminalResponse(node.name, node.type, userMsg, history, nodes, connections);
    
    setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    setIsTyping(false);
  };

  if (!node) return null;

  return (
    <div className="fixed bottom-12 right-6 w-[550px] h-[450px] bg-slate-950/95 backdrop-blur-md border border-slate-700 shadow-[0_20px_60px_rgba(0,0,0,0.8)] rounded-xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3 text-slate-300">
          <div className="p-1.5 bg-blue-600/20 rounded-lg text-blue-500"><TerminalIcon size={16} /></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{node.name} Console Interface</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-bold uppercase"><Activity size={12} className="animate-pulse" /> Live</div>
          <button onClick={onClose} className="hover:text-red-400 text-slate-500 transition-colors"><X size={20} /></button>
        </div>
      </div>

      {/* Output Area */}
      <div ref={scrollRef} className="flex-1 p-5 overflow-y-auto terminal-font text-[13px] leading-relaxed space-y-3 scrollbar-hide bg-[#050505]">
        {messages.map((m, i) => (
          <div key={i} className={`
            ${m.role === 'user' ? 'text-blue-400 border-l-2 border-blue-500/30 pl-3' : 
              m.role === 'system' ? 'text-slate-500 font-black italic text-[11px]' : 
              m.role === 'packet' ? 'text-cyan-500/60 text-[11px] animate-in fade-in' :
              'text-emerald-400'}
          `}>
            {m.role === 'user' && <span className="mr-2 font-black opacity-50">root@${node.name.toLowerCase()}:#</span>}
            {m.role === 'ai' && <pre className="whitespace-pre-wrap font-inherit">{m.text}</pre>}
            {m.role !== 'ai' && m.text}
          </div>
        ))}
        {isTyping && (
          <div className="text-slate-600 flex items-center gap-2 italic animate-pulse">
            <Activity size={14} className="animate-spin" /> Fetching remote response...
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 bg-slate-900/80 border-t border-slate-800 flex gap-3">
        <span className="text-slate-600 font-black terminal-font self-center">$</span>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter shell command..."
          className="flex-1 bg-transparent border-none outline-none terminal-font text-sm text-slate-100 placeholder:text-slate-700"
          disabled={isTyping}
        />
        <button type="submit" disabled={isTyping || !input.trim()} className="text-blue-500 hover:text-blue-400 disabled:opacity-30 transition-all hover:scale-110">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default Terminal;
