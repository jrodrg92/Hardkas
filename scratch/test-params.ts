import { WebSocket } from 'ws';

const url = 'ws://127.0.0.1:18210';
const addr = 'kaspa:pzy7n65m6e408l5v4s7k0n9u5j4x6s0v4u9v6';

async function test(method: string, params: any) {
    return new Promise((resolve) => {
        console.log(`Testing ${method} with ${JSON.stringify(params)}...`);
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => { ws.close(); resolve('Timeout'); }, 1000);
        ws.on('open', () => {
            ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }));
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
    await test('getBalanceByAddress', { address: addr });
    await test('getBalanceByAddress', { address_string: addr });
    await test('getBalanceByAddress', [addr]);
    await test('getUtxosByAddresses', { addresses: [addr] });
}

run();
