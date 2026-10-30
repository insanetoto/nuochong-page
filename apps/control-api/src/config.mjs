import { resolve } from 'node:path';
export function environment(){
  if(process.version!=='v24.21.0')throw new Error('Verified Node 24.21.0 is required.');
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; no in-memory fallback.');
  return {databaseURL:process.env.DATABASE_URL,schema:process.env.OA_DATABASE_SCHEMA??'oa_control',
    stateRoot:resolve(process.env.OA_RUNTIME_HOME??new URL('../.state',import.meta.url).pathname),apiKey:process.env.DEEPSEEK_API_KEY,
    port:Number(process.env.OA_API_PORT??3081)};
}
