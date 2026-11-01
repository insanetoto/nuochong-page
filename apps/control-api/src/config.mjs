import { resolve } from 'node:path';
export function environment(){
  if(process.version!=='v24.21.0')throw new Error('Verified Node 24.21.0 is required.');
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; no in-memory fallback.');
  const stateRoot=resolve(process.env.OA_RUNTIME_HOME??new URL('../.state',import.meta.url).pathname);
  const publicURL=process.env.PRODUCT_PUBLIC_URL;
  if(publicURL){const parsed=new URL(publicURL);if(parsed.username||parsed.password||parsed.search||parsed.hash||!parsed.pathname.endsWith('/product/')||!(parsed.protocol==='https:'||(parsed.protocol==='http:'&&['127.0.0.1','localhost'].includes(parsed.hostname))))throw new Error('Invalid product public URL.');}
  const productCookiePath=process.env.PRODUCT_COOKIE_PATH;if(productCookiePath&&!/^\/(?:[A-Za-z0-9_-]+\/)*product\/$/.test(productCookiePath))throw new Error('Invalid product cookie path.');
  return {productCookiePath,objectRoot:resolve(process.env.PRODUCT_OBJECT_ROOT??resolve(stateRoot,'product-objects')),productPublicURL:publicURL,databaseURL:process.env.DATABASE_URL,schema:process.env.OA_DATABASE_SCHEMA??'oa_control',
    stateRoot,apiKey:process.env.DEEPSEEK_API_KEY,
    port:Number(process.env.OA_API_PORT??3081)};
}
