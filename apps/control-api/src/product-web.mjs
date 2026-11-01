import {readFile} from 'node:fs/promises';
import {commands,valid} from '../../../tools/nuochong-cli/src/registry.mjs';
export function registerProductWeb(app){
 const root=new URL('../../product-web/',import.meta.url);
 const files=['index.html','theme.css','app.mjs','api.mjs','ui.mjs','plugins/knowledge.mjs','plugins/organization.mjs'];
 const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
 const headers=reply=>reply.header('content-security-policy',csp).header('x-content-type-options','nosniff').header('x-robots-tag','noindex, nofollow').header('referrer-policy','no-referrer');
 app.get('/product',async(req,reply)=>reply.redirect('/product/'));
 for(const file of [...files,'logo-mark.svg','contracts.mjs'])app.get('/product/'+file,async(req,reply)=>{
  headers(reply);const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':'text/javascript; charset=utf-8';
  const data=file==='contracts.mjs'?`export const commands=${JSON.stringify(commands.filter(c=>c.product))};export ${valid.toString()}`:await readFile(file==='logo-mark.svg'?new URL('../../../public/logo-mark.svg',import.meta.url):new URL(file,root),'utf8');return reply.type(type).send(data);
 });
 app.get('/product/',async(req,reply)=>{headers(reply);return reply.type('text/html; charset=utf-8').send(await readFile(new URL('index.html',root),'utf8'));});
}
