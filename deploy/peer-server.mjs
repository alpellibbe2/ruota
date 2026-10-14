// PeerJS signalling server for the home install: listens only on localhost, nginx exposes it under /peerjs.
import { PeerServer } from 'peer';

PeerServer({ host: '127.0.0.1', port: 9000, path: '/', proxied: true });
console.log('PeerJS server su 127.0.0.1:9000');
