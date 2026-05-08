import { WebSocket } from 'ws';

const url = 'ws://127.0.0.1:18210';
const addr = 'kaspa:pzy7n65m6e408l5v4s7k0n9u5j4x6s0v4u9v6';

async function test(payload: any) {
    return new Promise((resolve) => {
        console.log(`Testing payload: ${JSON.stringify(payload)}...`);
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => { ws.close(); resolve('Timeout'); }, 2000);
        ws.on('open', () => {
            ws.send(JSON.stringify(payload));
        });
        ws.on('message', (data) => {
            clearTimeout(timeout);
            console.log(`Response:`, data.toString());
            ws.close();
            resolve('Success');
        });
        ws.on('error', (err) => {
            clearTimeout(timeout);
            console.log(`Error:`, err.message);
            ws.close();
            resolve('Error');
        });
    });
}

async function run() {
    // Try top-level parameters
    await test({ id: 1, method: "getBalancesByAddresses", addresses: [addr] });
    await test({ id: 2, method: "GetBalancesByAddresses", addresses: [addr] });
}

run();
