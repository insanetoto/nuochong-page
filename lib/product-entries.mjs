// Fixed navigation destinations, never caller-provided URLs or native owner credentials.
export const productEntries = [
 {slug:'kb',path:'/product/kb',name:'企业知识库',state:'available',target:'https://www.nuochong.net/oa-test/product/'},
 {slug:'te',path:'/product/te',name:'培训考试',state:'planned'},
 {slug:'ai-assistant',path:'/product/ai-assistant',name:'企业 AI 助手',state:'planned'},
];
export const productEntry=slug=>productEntries.find(entry=>entry.slug===slug);
export function productEntryHTML(entry){
 const redirect=entry.target?`<meta http-equiv="refresh" content="0;url=${entry.target}">`:'';
 const content=entry.target?`<h1>${entry.name}</h1><p>正在进入企业知识库，请使用公司账号登录。</p><a class="primary" href="${entry.target}">进入企业知识库</a>`:`<span class="badge">规划中 · 尚未上线</span><h1>${entry.name}</h1><p>该产品正在建设规划中，将复用统一的公司身份与 DeepSeek Harness 基座。</p><p>目前可先体验已上线的企业知识库。</p><a class="primary" href="/product/kb">体验企业知识库</a>`;
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${entry.name} · 诺崇科技</title>${redirect}<link rel="icon" href="/logo-mark.svg"><link rel="stylesheet" href="/product-entry.css"></head><body><main><a class="brand" href="/"><img src="/logo-mark.svg" alt="">诺崇科技</a>${content}<a class="back" href="/">返回官网</a></main></body></html>`;
}
