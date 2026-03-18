import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;

export function startWebSocketServer(port: number) {
  wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', message: 'Contra OTC real-time feed' }));
  });

  wss.on('error', (err) => {
    console.error('WebSocket server error:', err.message);
  });

  console.log(`WebSocket server listening on port ${port}`);
}

// Broadcast an event to all connected clients
export function broadcast(event: {
  type: 'rfq_created' | 'rfq_cancelled' | 'quote_submitted' | 'quote_rejected' | 'trade_completed' | 'deposit_credited' | 'withdrawal_confirmed';
  data: any;
}) {
  if (!wss) return;
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
