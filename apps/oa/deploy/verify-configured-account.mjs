import {request} from 'node:http';
import assert from 'node:assert/strict';
const data=new URLSearchParams({username:process.env.OA_SETUP_USER,password:process.env.OA_SETUP_PASSWORD}).toString();
const result=await new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:3080,path:'/__login',method:'POST',headers:{host:'www.nuochong.net','content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(data)},timeout:10000},res=>{res.resume();resolve({status:res.statusCode,cookie:res.headers['set-cookie']});});req.on('timeout',()=>req.destroy());req.on('error',reject);req.end(data);});
assert.equal(result.status,303,'登录网关未通过账号验证');assert.ok(result.cookie?.length,'原生认证会话未生成');
console.log('测试管理员账号已配置，服务端登录验证通过。');
