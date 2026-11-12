import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {requireThat} from '../../apps/control-api/src/errors.mjs';
export class PrivateObjects {
 constructor(root){this.root=resolve(root);}
 hash(text){return createHash('sha256').update(Buffer.from(text,'utf8')).digest('hex');}
 async put(db,text){
  const hash=this.hash(text),bytes=Buffer.from(text,'utf8');mkdirSync(this.root,{recursive:true,mode:0o700});chmodSync(this.root,0o700);const path=resolve(this.root,hash);
  if(existsSync(path))requireThat(this.hash(readFileSync(path,'utf8'))===hash,503,'OBJECT_CORRUPT');
  else{const temporary=resolve(this.root,hash+'.'+randomUUID()+'.tmp');writeFileSync(temporary,bytes,{flag:'wx',mode:0o600});renameSync(temporary,path);}
  await db.query('INSERT INTO knowledge_objects(hash,size_bytes) VALUES($1,$2) ON CONFLICT(hash) DO NOTHING',[hash,bytes.length]);return hash;
 }
 async read(db,hash){
  requireThat(/^[a-f0-9]{64}$/.test(hash),500,'INVALID_OBJECT');requireThat((await db.query('SELECT 1 FROM knowledge_objects WHERE hash=$1',[hash])).rowCount,503,'OBJECT_MISSING');
  let text;try{text=readFileSync(resolve(this.root,hash),'utf8');}catch{requireThat(false,503,'OBJECT_MISSING');}
  requireThat(this.hash(text)===hash,503,'OBJECT_CORRUPT');return text;
 }

 async hashBytes(bytes){return createHash('sha256').update(bytes).digest('hex');}
 async putBytes(db,bytes){
  const hash=await this.hashBytes(bytes);mkdirSync(this.root,{recursive:true,mode:0o700});chmodSync(this.root,0o700);const path=resolve(this.root,hash);
  if(existsSync(path))requireThat((await this.hashBytes(readFileSync(path)))===hash,503,'OBJECT_CORRUPT');
  else{const temporary=resolve(this.root,hash+'.'+randomUUID()+'.tmp');writeFileSync(temporary,bytes,{flag:'wx',mode:0o600});renameSync(temporary,path);}
  await db.query('INSERT INTO knowledge_objects(hash,size_bytes) VALUES($1,$2) ON CONFLICT(hash) DO NOTHING',[hash,bytes.length]);return hash;
 }
 async readBytes(db,hash){
  requireThat(/^[a-f0-9]{64}$/.test(hash),500,'INVALID_OBJECT');requireThat((await db.query('SELECT 1 FROM knowledge_objects WHERE hash=$1',[hash])).rowCount,503,'OBJECT_MISSING');
  let bytes;try{bytes=readFileSync(resolve(this.root,hash));}catch{requireThat(false,503,'OBJECT_MISSING');}
  requireThat((await this.hashBytes(bytes))===hash,503,'OBJECT_CORRUPT');return bytes;
 }
}
