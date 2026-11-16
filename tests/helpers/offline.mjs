// Tests are local only. Individual fixtures may replace fetch with an in-memory fake.
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
const offline=()=>{throw Error('Unexpected network request: tests must use a fixture');};
globalThis.fetch=offline;
globalThis.WebSocket=class {constructor(){offline();}};
http.request=http.get=https.request=https.get=offline;
syncBuiltinESMExports();
