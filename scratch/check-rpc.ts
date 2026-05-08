import { WebSocket } from 'ws';

const url = 'ws://127.0.0.1:18210';
console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url);

ws.on('open', () => {
    console.log('Connected!');
    const payload = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getInfoRequest',
        params: {}
    });
    console.log('Sending:', payload);
    ws.send(payload);
});

ws.on('message', (data) => {
    console.log('Received:', data.toString());
    ws.close();
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('Error:', err);
    process.exit(1);
});

setTimeout(() => {
    console.error('Timeout');
    ws.close();
    process.exit(1);
}, 5000);
