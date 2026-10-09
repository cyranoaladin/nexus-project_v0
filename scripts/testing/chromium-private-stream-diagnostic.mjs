/** Synthetic loopback diagnostic, not a passing application transport gate.
 * No account, database, provider, framework or request interception.
 * Preserve private no-store responses; no-cache is only a diagnostic control.
 * Run with the repository's matching Playwright browser installation.
 */
import http from 'node:http';
import { chromium } from 'playwright';
(async()=>{
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<title>synthetic loopback</title>');}
 const policy=new URL(req.url,'http://localhost').searchParams.get('policy');
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':policy});
 res.write('{"ok":');setImmediate(()=>res.end('true}'));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try{
 const summary=[];
 for(const [policy,consumer] of [['no-store','stream'],['no-store','json'],['no-cache','stream']]){
 const context=await browser.newContext();const page=await context.newPage();await page.goto(origin);
 let aborted=0,failed=0,finished=0,complete=0;
 for(let i=0;i<20;i++){
 let resolve;const terminal=new Promise(r=>resolve=r);
 const matches=r=>new URL(r.url()).pathname==='/data';
 const ok=r=>{if(matches(r)){dispose();resolve('FINISHED');}};
 const bad=r=>{if(matches(r)){dispose();resolve(r.failure()?.errorText==='net::ERR_ABORTED'?'ABORTED':'FAILED');}};
 const dispose=()=>{page.off('requestfinished',ok);page.off('requestfailed',bad);};
 page.on('requestfinished',ok);page.on('requestfailed',bad);
 const application=await page.evaluate(async({policy,consumer})=>{
 const response=await fetch(`/data?policy=${policy}`);
 if(consumer==='json')return(await response.json()).ok===true;
 const reader=response.body.getReader();const chunks=[];
 for(;;){const next=await reader.read();if(next.done)break;chunks.push(...next.value);}
 reader.releaseLock();return JSON.parse(new TextDecoder().decode(new Uint8Array(chunks))).ok===true;
 },{policy,consumer});
 const event=await terminal;if(application)complete++;if(event==='FINISHED')finished++;else if(event==='ABORTED')aborted++;else failed++;
 }
 summary.push({policy,consumer,complete,finished,aborted,failed});await context.close();
 }
 console.log(JSON.stringify({browser:browser.version(),summary}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.log(JSON.stringify({errorType:e.name}));process.exitCode=1;});
