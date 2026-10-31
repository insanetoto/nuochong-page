import {createServer,request as httpRequest} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash,scrypt as callbackScrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import httpProxy from 'http-proxy';
const scrypt=promisify(callbackScrypt);
const digest=value=>createHash('sha256').update(value).digest();
export function createGateway({home,upstream,port,publicOrigin='https://www.nuochong.net'}){
 const publicHost=new URL(publicOrigin).host;
 const proxy=httpProxy.createProxyServer({target:upstream,ws:true,xfwd:false});let failures=0,reset=Date.now()+900000;
 const server=createServer(async(req,res)=>{
  const path=(req.url??'').split('?')[0];
  if(path!=='/__login'){proxy.web(req,res);return;}
  const deny=(status,message)=>{res.writeHead(status,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'});res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OA 登录</title><p>${message}</p><a href="/oa-login.html">返回登录页</a></html>`);};
  if(req.method!=='POST'||req.headers.host!==publicHost||!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']??'')){deny(400,'登录请求无效。');return;}
  if(Date.now()>reset){failures=0;reset=Date.now()+900000;}if(failures>=20){deny(429,'尝试次数过多，请稍后再试。');return;}
  try{
   let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4096){deny(413,'登录请求过大。');return;}chunks.push(chunk);}
   const data=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));if([...data.keys()].some(x=>!['username','password'].includes(x))||data.getAll('username').length!==1||data.getAll('password').length!==1){deny(400,'登录请求无效。');return;}
   const username=data.get('username'),password=data.get('password');if(username.length>256||password.length>512){deny(400,'登录请求无效。');return;}
   const config=JSON.parse(await readFile(resolve(home,'test-login.json'),'utf8'));
   if(!/^[0-9a-f]{32}$/.test(config.salt)||!/^[0-9a-f]{128}$/.test(config.hash)||typeof config.username!=='string')throw new Error('Invalid configuration');
   const derived=await scrypt(password,Buffer.from(config.salt,'hex'),64);
   if(!timingSafeEqual(digest(username),digest(config.username))||!timingSafeEqual(derived,Buffer.from(config.hash,'hex'))){failures++;deny(401,'账号或密码错误。');return;}
   const launch=new URL((await readFile(resolve(home,'launch-url'),'utf8')).trim());const token=launch.searchParams.get('token');
   if(launch.origin!==publicOrigin||launch.pathname!=='/oa-test/'||!token)throw new Error('Invalid native launch URL');
   const target=new URL(upstream);target.pathname='/';target.searchParams.set('token',token);
   const cookie=await new Promise((done,reject)=>{const call=httpRequest(target,{method:'GET',headers:{host:publicHost},timeout:5000},response=>{response.resume();if(response.statusCode!==303||!response.headers['set-cookie']){reject(new Error('Native authentication failed'));return;}done(response.headers['set-cookie']);});call.on('timeout',()=>call.destroy());call.on('error',reject);call.end();});
   failures=0;res.writeHead(303,{'set-cookie':cookie,'location':'./','cache-control':'no-store','referrer-policy':'no-referrer'});res.end();
  }catch{deny(503,'登录服务暂不可用，请联系管理员。');}
 });
 proxy.on('error',(_error,_req,res)=>{if(res?.writeHead&&!res.headersSent){res.writeHead(502,{'content-type':'text/plain'});res.end('OA service unavailable');}else res?.destroy?.();});
 server.on('upgrade',(req,socket,head)=>proxy.ws(req,socket,head));
 return {server,listen:()=>new Promise((ok,fail)=>server.once('error',fail).listen(port,'127.0.0.1',ok)),close:()=>new Promise(ok=>{proxy.close();server.close(ok);})};
}
