import { type AddressInfo, createServer } from 'node:net';

// Keep both sockets open until assigned so the frontend and backend receive different ports.
export async function testServerPorts() {
    const servers = [createServer(), createServer()];
    await Promise.all(
        servers.map(
            (server) =>
                new Promise<void>((resolve, reject) => {
                    server.once('error', reject);
                    server.listen(0, '127.0.0.1', resolve);
                }),
        ),
    );
    const ports = servers.map((server) => (server.address() as AddressInfo).port);
    await Promise.all(
        servers.map(
            (server) =>
                new Promise<void>((resolve, reject) => {
                    server.close((error) => (error ? reject(error) : resolve()));
                }),
        ),
    );
    return { web: ports[0]!, backend: ports[1]! };
}
