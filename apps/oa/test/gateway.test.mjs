import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,scryptSync} from 'node:crypto';
import {createGateway} from '../deploy/gateway.mjs';
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server.address().port;}
test('gateway verifies credentials server-side and never exposes the native launch token',async(t)=>{
 const token='synthetic_native_token_123456789012345';const home=mkdtempSync(join(tmpdir(),'oa-gateway-'));const salt=randomBytes(16);
 writeFileSync(join(home,'test-login.json'),JSON.stringify({username:'synthetic-user',salt:salt.toString('hex'),hash:scryptSync('synthetic-password',salt,64).toString('hex')}));
 const reservation=createServer();const port=await listen(reservation);await new Promise(resolve=>reservation.close(resolve));
 const origin=`http://127.0.0.1:${port}`;writeFileSync(join(home,'launch-url'),`${origin}/oa-test/?token=${token}`);
 const upstream=createServer((req,res)=>{if(req.url===`/?token=${token}`&&req.headers.host===`127.0.0.1:${port}`){res.writeHead(303,{'set-cookie':['synthetic-session=ok; Path=/; HttpOnly'],'location':'./'});res.end();}else{res.writeHead(401);res.end('protected');}});
 const upstreamPort=await listen(upstream);const gateway=createGateway({home,upstream:`http://127.0.0.1:${upstreamPort}`,port,publicOrigin:origin});await gateway.listen();const address=`http://127.0.0.1:${gateway.server.address().port}`;
 t.after(async()=>{await gateway.close();await new Promise(resolve=>upstream.close(resolve));rmSync(home,{recursive:true,force:true});});
 const login=(username,password)=>fetch(address+'/__login',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password})});
 const wrong=await login('synthetic-user','wrong');assert.equal(wrong.status,401);assert.ok(!(await wrong.text()).includes(token));
 const good=await login('synthetic-user','synthetic-password');assert.equal(good.status,303);assert.equal(good.headers.get('location'),'./');assert.match(good.headers.get('set-cookie'),/synthetic-session=ok/);assert.ok(!JSON.stringify([...good.headers]).includes(token));
 const anonymous=await fetch(address+'/',{headers:{}});assert.equal(anonymous.status,401);
 const badHost=await new Promise((resolve,reject)=>{const req=httpRequest(address+'/__login',{method:'POST',headers:{host:'untrusted.invalid','content-type':'application/x-www-form-urlencoded'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end('username=x&password=y');});assert.equal(badHost,400);
});

test('test account exchanges credentials for a real Harness browser session', {timeout:45000}, async(t)=>{
 const {spawn}=await import('node:child_process');const {existsSync}=await import('node:fs');const {setTimeout:delay}=await import('node:timers/promises');
 const home=mkdtempSync(join(tmpdir(),'oa-native-account-'));const reserveA=createServer();const gatewayPort=await listen(reserveA);await new Promise(resolve=>reserveA.close(resolve));
 const reserveB=createServer();const nativePort=await listen(reserveB);await new Promise(resolve=>reserveB.close(resolve));
 const salt=randomBytes(16);writeFileSync(join(home,'test-login.json'),JSON.stringify({username:'synthetic-user',salt:salt.toString('hex'),hash:scryptSync('synthetic-password',salt,64).toString('hex')}));
 const origin=`http://127.0.0.1:${gatewayPort}`;
 const child=spawn(process.execPath,['apps/oa/deploy/service.mjs'],{detached:true,stdio:'ignore',env:{PATH:process.env.PATH,NUOCHONG_OA_HOME:home,NUOCHONG_OA_PUBLIC_URL:origin+'/oa-test/',NUOCHONG_OA_LISTEN_PORT:String(gatewayPort),NUOCHONG_OA_INTERNAL_PORT:String(nativePort)}});
 t.after(async()=>{if(child.exitCode===null){try{process.kill(-child.pid,'SIGTERM');}catch{/* Already stopped. */}await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(5000)]);try{process.kill(-child.pid,'SIGKILL');}catch{/* Already stopped. */}}rmSync(home,{recursive:true,force:true});});
 for(let i=0;i<200&&!existsSync(join(home,'launch-url'));i++){if(child.exitCode!==null)throw new Error('Native service exited early');await delay(100);}
 assert.ok(existsSync(join(home,'launch-url')),'Native launch URL not ready');
 const login=await fetch(origin+'/__login',{method:'POST',redirect:'manual',body:new URLSearchParams({username:'synthetic-user',password:'synthetic-password'})});assert.equal(login.status,303);
 const cookie=login.headers.get('set-cookie');assert.ok(cookie);assert.ok(!login.headers.get('location').includes('token'));
 const response=await fetch(origin+'/',{headers:{cookie:cookie.split(';')[0]}});assert.equal(response.status,200);assert.match(await response.text(),/DeepSeek Harness/);
});

test('gateway forwards WebSocket upgrades without bypassing upstream authentication',async(t)=>{
 const {connect}=await import('node:net');const home=mkdtempSync(join(tmpdir(),'oa-ws-gateway-'));
 const upstream=createServer((_req,res)=>{res.writeHead(401);res.end();});
 upstream.on('upgrade',(req,socket)=>{if(req.headers.cookie!=='synthetic-session=ok'){socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');return;}socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');});
 const port=await listen(upstream);const gateway=createGateway({home,upstream:`http://127.0.0.1:${port}`,port:0});await gateway.listen();
 t.after(async()=>{await gateway.close();await new Promise(resolve=>upstream.close(resolve));rmSync(home,{recursive:true,force:true});});
 const handshake=cookie=>new Promise((resolve,reject)=>{let data='';const socket=connect(gateway.server.address().port,'127.0.0.1',()=>socket.write(`GET /socket HTTP/1.1\r\nHost: www.nuochong.net\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n${cookie?'Cookie: '+cookie+'\r\n':''}\r\n`));socket.on('data',chunk=>{data+=chunk;});socket.on('end',()=>resolve(data));socket.on('error',reject);});
 assert.match(await handshake('synthetic-session=ok'),/HTTP\/1\.1 101/);assert.match(await handshake(''),/HTTP\/1\.1 401/);
});
