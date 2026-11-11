export function h(tag,attrs={},...children){const node=document.createElement(tag);for(const [key,value] of Object.entries(attrs)){if(value===undefined||value===null||value===false)continue;if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);else if(['value','checked','selected','disabled','multiple'].includes(key))node[key]=value;else node.setAttribute(key==='className'?'class':key,String(value));}for(const child of children.flat(Infinity)){if(child===null||child===undefined||child===false)continue;node.append(child instanceof Node?child:document.createTextNode(String(child)));}return node;}
export const field=(label,attrs={})=>{const input=h('input',{...attrs,id:crypto.randomUUID()});return {input,node:h('label',{class:'field',for:input.id},h('span',{},label),input)};};
export const selectField=(label,options,attrs={})=>{const input=h('select',{...attrs,id:crypto.randomUUID()},options.map(o=>h('option',{value:o.value,selected:o.selected,disabled:o.disabled},o.label)));return {input,node:h('label',{class:'field',for:input.id},h('span',{},label),input)};};
export const textField=(label,attrs={})=>{const input=h('textarea',{...attrs,id:crypto.randomUUID()});return {input,node:h('label',{class:'field',for:input.id},h('span',{},label),input)};};
export const button=(text,onclick,attrs={})=>h('button',{type:'button',onclick,...attrs},text);
export const date=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'长期有效';
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
export const status=value=>({draft:'待审草稿',reviewed:'已审待发布',published:'现行知识',withdrawn:'已撤回',stale:'依据已失效',queued:'排队中',running:'处理中',succeeded:'已完成',failed:'失败',cancelled:'已取消',active:'有效来源'}[value]??value);
export const tag=value=>h('span',{class:'tag'+(['failed','withdrawn','stale'].includes(value)?' warn':'')},status(value));
export const empty=text=>h('div',{class:'empty'},text);
export const heading=(title,description)=>h('div',{class:'page-toolbar'},h('div',{},h('div',{class:'eyebrow'},'NUOCHONG KNOWLEDGE'),h('h1',{},title),h('p',{class:'muted'},description)));
export const table=(headers,rows)=>rows.length?h('div',{class:'table-wrap'},h('table',{},h('thead',{},h('tr',{},headers.map(x=>h('th',{scope:'col'},x)))),h('tbody',{},rows.map(cells=>h('tr',{},cells.map(c=>h('td',{},c))))))):empty('暂无记录');
export const pagination=(ctx,data,view)=>data.nextCursor?h('div',{class:'actions'},button('下一页',()=>ctx.navigate(view+'?after='+encodeURIComponent(data.nextCursor)))):null;
export const section=(title,...children)=>h('section',{class:'section-gap'},h('h2',{},title),children);
export function bindForm(ctx,form,operation,success){form.addEventListener('submit',event=>{event.preventDefault();const submit=form.querySelector('button[type=submit]');ctx.operate(submit,()=>operation(event),success);});return form;}
