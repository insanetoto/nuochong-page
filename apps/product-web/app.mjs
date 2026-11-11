import {api,idempotencyKey,friendly} from './api.mjs';
import {h,field,button,heading} from './ui.mjs';
import {knowledgeViews} from './plugins/knowledge.mjs';import {organizationView} from './plugins/organization.mjs';
const root=document.querySelector('#root');let generation=0,sessionVersion=0,timer;
const state={me:null,spaces:[],spaceId:'',plugins:[],allowed:{},query:'',pending:new Map()};
const labels={home:'知识首页',search:'搜索知识',ask:'知识问答',spaces:'空间管理',sources:'来源管理',review:'变更审校',read:'知识阅读',source:'原文核验',quality:'知识质量',jobs:'我的任务',job:'任务与结果',organization:'统一组织与权限'};
const ctx={api,key:idempotencyKey,state,can:permission=>!!state.allowed[permission],navigate,refresh:load,notify,operate,mutate,approve,get spaceId(){return state.spaceId;},get me(){return state.me;},get spaces(){return state.spaces;},get plugins(){return state.plugins;},get query(){return state.query;},set query(value){state.query=value;}};
function notify(text,error=false){const area=document.querySelector('#notification');if(area)area.replaceChildren(h('div',{class:error?'error':'info',role:error?'alert':'status'},text));}
function navigate(route){if(location.hash.slice(1)===route)load();else location.hash=route;}
async function operate(control,operation,success=()=>load()){
 const version=sessionVersion;if(control)control.disabled=true;
 try{const result=await operation();if(version===sessionVersion)await success(result);}
 catch(error){if(version!==sessionVersion)return;if(error.status===401){sessionVersion++;state.me=null;state.pending.clear();generation++;root.replaceChildren(login());}else notify(error.code==='LOCAL_CANCEL'?'操作已取消，未提交。':friendly(error),error.code!=='LOCAL_CANCEL');}
 finally{if(control?.isConnected)control.disabled=false;}
}
async function mutate(command,target){
 const key=command+JSON.stringify(target);let input=state.pending.get(key);
 if(!input){input={...target,idempotencyKey:idempotencyKey()};state.pending.set(key,input);}
 try{const result=await api(command,input);state.pending.delete(key);return result;}catch(error){if(error.status&&error.code!=='IDEMPOTENCY_CONFLICT')state.pending.delete(key);throw error;}
}
async function approve(command,target,description){
 if(!window.confirm(description+'\n将对当前版本申请明确审批并执行，是否继续？')){const e=new Error('LOCAL_CANCEL');e.code='LOCAL_CANCEL';throw e;}
 const key=command+JSON.stringify(target);let input=state.pending.get(key);
 if(!input){const approval=await mutate('access.approvals.create.v1',{commandId:command,target,reason:'操作人在公司工作台明确确认：'+description});input={...target,idempotencyKey:idempotencyKey(),approvalId:approval.approvalId};state.pending.set(key,input);}
 try{const result=await api(command,input);state.pending.delete(key);return result;}catch(error){if(error.status&&error.code!=='IDEMPOTENCY_CONFLICT')state.pending.delete(key);throw error;}
}
function login(){
 const username=field('账号',{name:'username',autocomplete:'username',required:true,maxlength:128}),password=field('密码',{name:'password',type:'password',autocomplete:'current-password',required:true,minlength:8,maxlength:512});
 const submit=h('button',{type:'submit',class:'primary'},'登录知识库'),form=h('form',{},username.node,password.node,submit);
 form.addEventListener('submit',event=>{event.preventDefault();operate(submit,()=>api('identity.login.v1',{username:username.input.value,password:password.input.value,delivery:'cookie'}),()=>{sessionVersion++;password.input.value='';return load();});});
 return h('div',{class:'login-layout'},h('div',{class:'login-card'},h('div',{class:'brand'},h('img',{src:'./logo-mark.svg',alt:''}),h('span',{},'诺崇科技')),h('div',{class:'eyebrow'},'COMPANY KNOWLEDGE'),h('h1',{},'企业知识库'),h('p',{class:'muted'},'使用公司分配的账号登录。模型由公司服务端统一提供。'),h('div',{id:'notification',class:'notification'}),form,h('p',{class:'small'},'初版支持制度来源、知识审校与引用问答；请先使用合成资料验证流程。')));
}
function shell(content,route){
 const navItems=[['home','◈　知识首页'],['search','⌕　搜索知识'],['ask','◌　知识问答'],['jobs','◷　我的任务']];
 const nav=h('nav',{'aria-label':'产品导航'},h('label',{},'企业知识库'),navItems.map(([id,label])=>button(label,()=>navigate(id),{class:route.name===id?'active':''})));
 if(['knowledge:edit','knowledge:review','knowledge:publish','access:manage'].some(ctx.can)){nav.append(h('label',{},'内容与运营'));for(const [id,label] of [['spaces','▦　空间管理'],['sources','▤　来源管理'],['review','☷　变更审校']])nav.append(button(label,()=>navigate(id),{class:route.name===id?'active':''}));if(ctx.can('knowledge:edit'))nav.append(button('◇　知识质量',()=>navigate('quality'),{class:route.name==='quality'?'active':''}));}
 if(ctx.can('organization:read')||ctx.can('access:manage'))nav.append(h('label',{},'统一管理'),button('◎　组织与权限',()=>navigate('organization'),{class:route.name==='organization'?'active':''}));
 const spaceSelect=h('select',{class:'toolbar-select','aria-label':'当前知识空间',onchange:event=>{state.spaceId=event.target.value;navigate('home');}},state.spaces.map(s=>h('option',{value:s.id,selected:s.id===state.spaceId},s.title)));
 const logout=button('退出登录',event=>operate(event.currentTarget,()=>mutate('identity.logout.v1',{}),()=>{sessionVersion++;generation++;state.me=null;state.query='';state.spaces=[];state.spaceId='';state.pending.clear();root.replaceChildren(login());}));
 return h('div',{class:'layout'},h('aside',{},h('div',{class:'brand'},h('img',{src:'./logo-mark.svg',alt:''}),h('span',{},'诺崇科技')),h('div',{class:'small'},'企业 AI 工作平台 · 知识库初版'),nav,h('div',{class:'aside-bottom'},h('div',{},'公司模型 · DeepSeek'),h('div',{},'企业 AI 工具 · 规划中'),h('div',{},'培训和考试 · 规划中'))),h('main',{},h('header',{},h('span',{},'工作台 / 企业知识库 / '+(labels[route.name]??'知识首页')),h('div',{class:'top-profile'},state.spaces.length?spaceSelect:null,h('span',{class:'pill'},state.me.name),logout)),h('div',{class:'content'},h('div',{id:'notification',class:'notification'}),content)));
}
async function load(){
 clearTimeout(timer);const version=++generation;
 try{
  const [me,spaces,plugins]=await Promise.all([api('identity.me.v1'),api('knowledge.spaces.list.v1'),api('platform.plugins.list.v1')]);if(version!==generation)return;
  state.me=me;state.spaces=spaces.items;state.plugins=plugins.items;if(!spaces.items.some(s=>s.id===state.spaceId))state.spaceId=spaces.items[0]?.id??'';
  const permissions=['knowledge:edit','knowledge:review','knowledge:publish','knowledge:ask','organization:read','organization:manage','access:manage'];
  const checks=await Promise.all(permissions.map(async permission=>[permission,(await api('access.permissions.check.v1',{permission,scopeId:permission.startsWith('knowledge:')?(state.spaceId||'*'):'*'})).allowed]));
  const globalPublish=(await api('access.permissions.check.v1',{permission:'knowledge:publish',scopeId:'*'})).allowed;if(version!==generation)return;state.allowed=Object.fromEntries([...checks,['knowledge:publish-global',globalPublish]]);
  const [path,query]=location.hash.slice(1).split('?'),[name='home',id]=path.split('/');const route={name:name||'home',id,params:new URLSearchParams(query??'')};
  let result;
  if(route.name==='organization')result={node:await organizationView(ctx,route)};
  else if(!state.plugins.some(p=>p.id==='knowledge'&&['enabled','draining'].includes(p.state)))result={node:heading('知识库插件不可用','所需插件未启用，请联系管理员。')};
  else result=await (knowledgeViews[route.name]??knowledgeViews.home)(ctx,route);
  if(version!==generation)return;root.replaceChildren(shell(result.node,route));document.title=(labels[route.name]??'企业知识库')+' · 诺崇科技';
  if(result.poll)timer=setTimeout(()=>{if(version===generation)load();},1200);
 }catch(error){if(version!==generation)return;if(error.status===401){sessionVersion++;state.me=null;state.pending.clear();root.replaceChildren(login());}else{const content=h('div',{},heading('暂时无法加载','服务未返回可用结果。'),h('div',{class:'error',role:'alert'},friendly(error)),button('重新加载',load));root.replaceChildren(state.me?shell(content,{name:'home'}):content);}}
}
window.addEventListener('hashchange',load);load();
