
import { GoogleGenAI } from "@google/genai";
import { Connection, NetworkNode } from "../types";

export async function simulateTerminalResponse(
  nodeName: string,
  nodeType: string,
  command: string,
  history: { role: string; text: string }[],
  nodes: NetworkNode[],
  connections: Connection[]
): Promise<string> {
  // Initialize the Google GenAI client inside the function to use the latest API key context.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const topologyInfo = nodes.map(n => 
      `${n.name} (${n.type}) - IP: ${n.ipAddress || 'None'} - Status: ${n.status}`
    ).join(', ');

    const connectionInfo = connections.map(c => {
      const src = nodes.find(n => n.id === c.sourceId)?.name;
      const tgt = nodes.find(n => n.id === c.targetId)?.name;
      return `${src}:${c.sourcePort} <-> ${tgt}:${c.targetPort}`;
    }).join(', ');

    // Use systemInstruction for defining the persona, topology, and operational rules.
    const systemInstruction = `You are a technical terminal for a network device named "${nodeName}" of type "${nodeType}".
    NETWORK TOPOLOGY: [${topologyInfo}]
    CONNECTIONS: [${connectionInfo}]
    
    RULES:
    1. If the user pings an IP that exists and is 'RUNNING', simulate a successful ping response.
    2. If the user pings an IP that is not in topology or 'STOPPED', simulate a timeout.
    3. Support common commands like 'show ip interface brief', 'ping', 'traceroute', 'conf t', 'show run'.
    4. Provide packet-level details if the command is 'monitor traffic' or similar.
    5. Responses must be concise terminal output. No conversational filler.`;

    // Call generateContent with gemini-3-pro-preview as terminal simulation is a complex reasoning task.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: command }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0,
        // Removed maxOutputTokens to allow full reasoning/response length as recommended by guidelines.
      }
    });

    // Directly access the text property of the response.
    return response.text || "Command not recognized.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error: Internal console failure.";
  }
}
