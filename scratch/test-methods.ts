import { WebSocket } from 'ws';

const url = 'ws://127.0.0.1:18210';
const methods = ['getInfoRequest', 'getInfo', 'get_info', 'GetInfo'];

async function testMethod(method: string) {
    return new Promise((resolve, reject) => {
        console.log(`Testing method: ${method}...`);
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
                params: {}
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
    for (const m of methods) {
        try {
            await testMethod(m);
        } catch (e) {
            console.log(`Method ${m} failed:`, e instanceof Error ? e.message : String(e));
        }
    }
}

run();
