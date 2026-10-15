import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
export async function webFixture<T>(run:(base:string)=>Promise<T>,port=3178) {
  const base=`http://localhost:${port}`;
  const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{env:{...process.env,NEXTAUTH_URL:base,NEXTAUTH_SECRET:"synthetic-local-test-secret-not-live",GITHUB_CLIENT_ID:"synthetic",GITHUB_CLIENT_SECRET:"synthetic"},stdio:"ignore"});
  try {
    let ready=false;
    for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await setTimeout(100);}
    if(!ready)throw new Error("Production web fixture did not start; run npm run build first");
    return await run(base);
  }finally{if(server.exitCode===null){server.kill("SIGTERM");await new Promise<void>(resolve=>server.once("exit",()=>resolve()));}}
}
