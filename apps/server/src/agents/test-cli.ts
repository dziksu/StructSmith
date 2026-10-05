import { chmodSync, writeFileSync } from "node:fs";

/** Exercises the same child-process stdio boundary as the installed Codex CLI. */
export function fakeCodex(
  path: string,
  turn: string,
  setup = "",
  catalog = "console.log(JSON.stringify({id:request.id,result:{data:[],nextCursor:null}}));",
): void {
  writeFileSync(
    path,
    `#!${process.execPath}
import { createInterface } from 'node:readline';
${setup}
const threadId = 'test-thread';
const emit = (method, params) => console.log(JSON.stringify({method,params:{threadId,...params}}));
let threadParams;
for await (const line of createInterface({input:process.stdin})) {
  const request = JSON.parse(line);
  const params = request.params;
  if (request.method === 'model/list') { ${catalog} }
  if (request.method === 'initialize') console.log(JSON.stringify({id:request.id,result:{}}));
  if (request.method === 'config/read') console.log(JSON.stringify({id:request.id,result:{config:{mcp_servers:{'unrelated.with.dot':{url:'http://invalid'}},plugins:{'unrelated.with.dot':{enabled:true}}}}}));
  if (request.method === 'thread/start') {
    threadParams = params;
    console.log(JSON.stringify({id:request.id,result:{thread:{id:threadId}}}));
  }
  if (request.method === 'turn/start') {
    console.log(JSON.stringify({id:request.id,result:{turn:{id:'turn',status:'inProgress'}}}));
    ${turn}
    emit('turn/completed',{turn:{id:'turn',status:'completed'}});
  }
}
`,
  );
  chmodSync(path, 0o700);
}
