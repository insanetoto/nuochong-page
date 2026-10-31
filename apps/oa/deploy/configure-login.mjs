import {randomBytes,scryptSync} from 'node:crypto';
import {writeFileSync,renameSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
const home=process.env.NUOCHONG_OA_HOME;if(!home)throw new Error('Missing service home');
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>4096)throw new Error('Input too long');}
const {username,password}=JSON.parse(input);if(typeof username!=='string'||!username||username.length>256||typeof password!=='string'||password.length<8||password.length>512)throw new Error('Invalid credentials');
const salt=randomBytes(16);const hash=scryptSync(password,salt,64);const destination=resolve(home,'test-login.json');const temp=destination+'.new';writeFileSync(temp,JSON.stringify({username,salt:salt.toString('hex'),hash:hash.toString('hex')})+'\n',{mode:0o600});chmodSync(temp,0o600);renameSync(temp,destination);
