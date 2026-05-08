import { WebSocket } from 'ws';

const url = 'ws://127.0.0.1:18210';
const aliceAddress = 'kaspa:sim_alice'; // This might not be the real address

async function testMethod(method: string, params: any = {}) {
    return new Promise((resolve, reject) => {
        console.log(`Testing method: ${method} with params ${JSON.stringify(params)}...`);
        const ws = new WebSocket(url);
        
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout'));
        }, 2000);

        ws.on('open', () => {
            ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method,
                params
            }));
        });

        ws.on('message', (data) => {
            clearTimeout(timeout);
            console.log(`Result for ${method}:`, data.toString());
            ws.close();
            resolve(true);
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            console.error(`Error for ${method}:`, err.message);
            ws.close();
            reject(err);
        });
    });
}

async function run() {
    const tests = [
        { m: 'getBalanceByAddress', p: { address: 'kaspa:pzy7n65m6e408l5v4s7k0n9u5j4x6s0v4u9v6' } }, // Some random address
        { m: 'getUtxosByAddresses', p: { addresses: ['kaspa:pzy7n65m6e408l5v4s7k0n9u5j4x6s0v4u9v6'] } },
        { m: 'getBlockDagInfo', p: {} }
    ];
    for (const t of tests) {
        try {
            await testMethod(t.m, t.p);
        } catch (e) {
            console.log(`Method ${t.m} failed:`, e instanceof Error ? e.message : String(e));
        }
    }
}

run();
