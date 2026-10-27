// Optional Windows ADB reverse compatibility. Loopback only, fixed QA port.
import net from 'node:net';
const server = net.createServer(client => {
  const upstream = net.connect(8086, '127.0.0.1');
  client.pipe(upstream); upstream.pipe(client);
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
});
server.on('error', error => { console.error('QA loopback proxy failed:', error.code); process.exitCode = 1; });
server.listen(8086, '::1', () => console.log('QA loopback IPv6 → IPv4 forwarding ready on 8086.'));
