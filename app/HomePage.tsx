"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Product route handlers require full-document navigation on both Worker and static hosting. */
import {useEffect,useSyncExternalStore} from "react";
import {ArrowRight,BookOpenText,Bot,GraduationCap,Layers3,ShieldCheck,Workflow,Plug,Check,ExternalLink} from "lucide-react";
import {productEntries} from "../lib/product-entries.mjs";
import "./marketing.css";
type Language="en"|"zh";
const subscribe=(notify:()=>void)=>{for(const event of ['storage','popstate','nuochong-language-change'])window.addEventListener(event,notify);return()=>{for(const event of ['storage','popstate','nuochong-language-change'])window.removeEventListener(event,notify);};};
function currentLanguage():Language{const q=new URLSearchParams(location.search).get('lang');if(q==='en'||q==='zh')return q;try{const saved=localStorage.getItem('nuochong-language');if(saved==='en'||saved==='zh')return saved;}catch{ /* Blocked storage falls back to the browser language. */ }return navigator.language.toLowerCase().startsWith('zh')?'zh':'en';}
const copy={

 zh:{
    brand:'诺崇科技',
    home:'主页',
    nav:[
      '产品能力',
      '核心价值',
      '应用场景',
      '关于我们'
    ],
    languageLabel:'切换语言',
    try:'试用知识库',
    request:'申请使用',
    eyebrow:'AI 原生 · 可插拔架构',
    hero1:'让 AI 成为',
    hero2:'企业的工作方式',
    intro:'以知识为依据，以智能工具连接工作，以培训考试推动成长。三个产品，共用一个 AI 原生基座，按需组合、持续扩展。',
    explore:'探索三个产品',
    availability:'企业知识库测试版已开放，AI 助手与培训考试逐步建设。',
    heroFoot:[
      '公司统一模型',
      '共享组织与权限',
      'API / CLI / MCP'
    ],
    system:'诺崇 AI 产品体系',
    live:'测试版可体验',
    planned:'规划建设中',
    flowLabel:'知识库的可信知识闭环',
    flow:[
      '来源留存',
      '编译草稿',
      '审校发布',
      '引用问答'
    ],
    base:'统一 AI 原生基座',
    baseSub:'DeepSeek Harness',
    pluginLabel:'按需装配，共享能力',
    plugins:[
      '组织与人员',
      '角色与权限',
      '任务与审计'
    ],
    productKicker:'THREE PRODUCTS',
    productTitle:'从知识出发，连接工作与成长',
    productIntro:'选择一个产品开始，也为未来的能力组合留下空间。',
    products:[

 {
        name:'企业知识库',
        slug:'kb',
        eyebrow:'KNOWLEDGE',
        title:'让制度与经验，成为可用的依据',
        text:'从公司规章制度起步，保留来源，持续整理为可审校、可追溯的知识。让每一次查询，都能找到回答背后的依据。',
        features:[
          '原始来源与制度版本留存',
          'AI 编译草稿，人工审校发布',
          '知识搜索、引用问答与原文核验'
        ],
        action:'立即试用知识库'
      },

 {
        name:'企业 AI 助手',
        slug:'ai-assistant',
        eyebrow:'WORK',
        title:'让 AI 从对话，走进工作流程',
        text:'围绕企业实际办公需求，将工具、任务和产物组合起来。让 AI 在明确权限下协助工作，而不是停留在一个聊天窗口。',
        features:[
          '可组合的办公工具插件',
          '受控执行、审批与任务追踪',
          '对接企业系统与外部 AI 工具'
        ],
        action:'查看产品进展'
      },

 {
        name:'培训考试',
        slug:'te',
        eyebrow:'GROWTH',
        title:'让知识沉淀，转化为团队成长',
        text:'规划以已发布的知识为基础，连接培训、学习与考试。让制度不仅被保存，也能被理解、学习和落实。',
        features:[
          '制度知识驱动课程与题库',
          '学习、培训与考试衔接',
          '审核、评估与持续改进'
        ],
        action:'查看产品进展'
      }
    ],
    direction:'规划方向',
    valueKicker:'PRODUCT VALUE',
    valueTitle:'把分散的能力，变成持续的价值',
    values:[
      [
        '知识有依据',
        '把“文件放在哪里”变成“问题的依据是什么”。保留来源与版本，让知识可核验、可维护。'
      ],
      [
        '工作有协同',
        '把知识、工具和任务连接起来。以统一身份和受控流程，让 AI 的协助有边界、有记录。'
      ],
      [
        '能力可生长',
        '从一个产品起步，逐步组合业务插件。减少重复建设，让同一套组织、权限和集成能力服务更多场景。'
      ]
    ],
    architectureKicker:'AI-NATIVE × PLUGGABLE',
    architectureTitle:'同一个基座，长出不同的能力',
    architectureText:'AI 原生不只是多一个对话框。我们将模型调用、受控任务与业务接口放入产品基座，再用插件承载具体能力。',
    architectureItems:[
      [
        '统一基座',
        '三个产品基于 DeepSeek Harness 演进，保持清晰的产品与业务边界。'
      ],
      [
        '共享插件',
        '组织、人员与角色权限共同使用，业务扩展无需重新建设一套管理体系。'
      ],
      [
        '开放集成',
        '通过版本化业务 API、CLI 与受限 MCP，让企业系统和外部 AI 工具接入。'
      ]
    ],
    diagramProducts:'产品层',
    diagramShared:'共享能力',
    diagramBusiness:'业务插件 · 逐步扩展',
    diagramCore:'模型与受控执行',
    businessPlugins:[
      '知识处理',
      '办公工具',
      '课程考试',
      '系统连接器'
    ],
    architectureNote:'先从受控的第一方插件开始，按业务需求逐步扩展。',
    scenesKicker:'USE CASES',
    scenesTitle:'从真实的工作问题开始',
    scenes:[
      [
        '规章制度，随问随查',
        '以已发布制度为依据，查询适用要求，核验原文与版本。',
        '企业知识库 · 测试版'
      ],
      [
        '重复工作，让 AI 协助',
        '围绕具体办公任务，组合知识、工具与审批流程。',
        '企业 AI 助手 · 规划中'
      ],
      [
        '制度落地，连接学习',
        '把制度知识与员工培训、考试评估串起来。',
        '培训考试 · 规划中'
      ]
    ],
    aboutKicker:'ABOUT NUOCHONG',
    aboutTitle:'让可靠的 AI，服务企业的日常',
    aboutText:'云南诺崇科技有限公司专注于企业智能化应用。从知识管理、办公协同到培训考试，我们希望把 AI 变成可用、可信、可持续演进的产品，让企业从实际需求出发，一步步构建自己的智能化能力。',
    contactKicker:'START WITH KNOWLEDGE',
    contactTitle:'先从企业知识库，开始体验',
    contactText:'体验合成制度的知识闭环，或与我们交流公司的知识管理与 AI 应用需求。',
    qrAlt:'诺崇科技企业微信二维码',
    phone:'联系电话',
    email:'商务邮箱',
    subject:'咨询诺崇 AI 原生产品',
    product:'产品',
    footerLinks:[
      '企业知识库',
      '培训与考试',
      '企业 AI 助手'
    ],
    company:'公司',
    companyLinks:[
      '关于我们',
      '应用场景',
      '联系我们'
    ],
    wecom:'企业微信',
    tagline:'以知识为依据，让 AI 连接工作与成长。',
    copyright:'© 2026 云南诺崇科技有限公司',
    icp:'滇ICP备2026017420号'
  },

 en:{
    brand:'Nuochong Technology',
    home:'Home',
    nav:[
      'Products',
      'Value',
      'Use Cases',
      'About'
    ],
    languageLabel:'Switch language',
    try:'Try Knowledge Base',
    request:'Request Access',
    eyebrow:'AI-NATIVE · PLUGGABLE BY DESIGN',
    hero1:'Make AI part of',
    hero2:'how your company works',
    intro:'Ground work in knowledge. Connect people with AI tools. Turn learning into growth. Three products on one AI-native foundation, designed to evolve together.',
    explore:'Explore the products',
    availability:'Knowledge Base is available as a test release. AI Assistant and Training & Assessments are planned.',
    heroFoot:[
      'Company-managed model',
      'Shared organization & access',
      'API / CLI / MCP'
    ],
    system:'The Nuochong product system',
    live:'Test release available',
    planned:'Planned',
    flowLabel:'A grounded knowledge lifecycle',
    flow:[
      'Keep sources',
      'Compile drafts',
      'Review & publish',
      'Answer with evidence'
    ],
    base:'One AI-native foundation',
    baseSub:'DeepSeek Harness',
    pluginLabel:'Compose capabilities as needed',
    plugins:[
      'Organization & people',
      'Roles & access',
      'Tasks & audit'
    ],
    productKicker:'THREE PRODUCTS',
    productTitle:'Knowledge for work. Learning for growth.',
    productIntro:'Start with one product. Keep room to combine new capabilities as your needs evolve.',
    products:[

 {
        name:'Enterprise Knowledge Base',
        slug:'kb',
        eyebrow:'KNOWLEDGE',
        title:'Turn policies and experience into usable evidence',
        text:'Start with company policies. Keep original sources and maintain knowledge that can be reviewed and traced, so people can verify the basis of an answer.',
        features:[
          'Original sources and policy versions',
          'AI drafts with explicit review and publication',
          'Search, cited answers and source verification'
        ],
        action:'Try Knowledge Base'
      },

 {
        name:'Enterprise AI Assistant',
        slug:'ai-assistant',
        eyebrow:'WORK',
        title:'Move AI from conversations into workflows',
        text:'A product direction for real office needs: combine tools, tasks and outputs so AI can help within explicit permissions and reviewable processes.',
        features:[
          'Composable office tool plugins',
          'Controlled execution, approvals and task history',
          'Integrations with systems and external AI tools'
        ],
        action:'View product status'
      },

 {
        name:'Training & Assessments',
        slug:'te',
        eyebrow:'GROWTH',
        title:'Turn shared knowledge into team growth',
        text:'Planned around published knowledge, connecting training, learning and assessments so policies can be understood and put into practice.',
        features:[
          'Courses and questions grounded in policy',
          'Connected learning, training and assessments',
          'Review, evaluation and continuous improvement'
        ],
        action:'View product status'
      }
    ],
    direction:'Planned direction',
    valueKicker:'PRODUCT VALUE',
    valueTitle:'From separate capabilities to lasting value',
    values:[
      [
        'Knowledge with evidence',
        'Move beyond locating a file to understanding the basis of an answer. Keep sources and versions verifiable and maintainable.'
      ],
      [
        'Work that connects',
        'Connect knowledge, tools and tasks through shared identity and controlled workflows, with clear boundaries and traceable actions.'
      ],
      [
        'Room to grow',
        'Start with one product and add business plugins over time. Reuse organization, access and integration capabilities across products.'
      ]
    ],
    architectureKicker:'AI-NATIVE × PLUGGABLE',
    architectureTitle:'One foundation. Different capabilities.',
    architectureText:'AI-native means more than another chat window. Model calls, controlled tasks and business interfaces belong in the foundation; plugins carry specific capabilities.',
    architectureItems:[
      [
        'One foundation',
        'Three products evolving on DeepSeek Harness, with clear product and business boundaries.'
      ],
      [
        'Shared plugins',
        'Reuse organization, people, roles and access, instead of rebuilding administration for every product.'
      ],
      [
        'Open integration',
        'Versioned APIs, CLI commands and restricted MCP make room for company systems and external AI tools.'
      ]
    ],
    diagramProducts:'Product layer',
    diagramShared:'Shared capabilities',
    diagramBusiness:'Business plugins · expanding over time',
    diagramCore:'Model & controlled execution',
    businessPlugins:[
      'Knowledge processing',
      'Office tools',
      'Courses & exams',
      'System connectors'
    ],
    architectureNote:'Begin with controlled first-party plugins, then extend around real business needs.',
    scenesKicker:'USE CASES',
    scenesTitle:'Start with a real question at work',
    scenes:[
      [
        'Find the policy and its evidence',
        'Query published policies and verify the original text and version.',
        'Knowledge Base · test release'
      ],
      [
        'Bring AI into repetitive work',
        'Combine knowledge, tools and approvals around a specific office task.',
        'AI Assistant · planned'
      ],
      [
        'Connect policies with learning',
        'Link company knowledge to employee training and assessments.',
        'Training & Assessments · planned'
      ]
    ],
    aboutKicker:'ABOUT NUOCHONG',
    aboutTitle:'Reliable AI for everyday enterprise work',
    aboutText:'Yunnan Nuochong Technology Co., Ltd. focuses on enterprise AI applications. From knowledge management and office assistance to training and assessments, we build toward useful, trustworthy products that can evolve around actual business needs.',
    contactKicker:'START WITH KNOWLEDGE',
    contactTitle:'Start with Enterprise Knowledge Base',
    contactText:'Explore the synthetic policy workflow or talk to us about your knowledge management and AI application needs.',
    qrAlt:'Nuochong Technology WeCom QR code',
    phone:'Phone',
    email:'Business email',
    subject:'Enquiry about Nuochong AI-native products',
    product:'Products',
    footerLinks:[
      'Enterprise Knowledge Base',
      'Training & Assessments',
      'Enterprise AI Assistant'
    ],
    company:'Company',
    companyLinks:[
      'About',
      'Use Cases',
      'Contact'
    ],
    wecom:'WeCom',
    tagline:'Grounded in knowledge. Connected through AI.',
    copyright:'© 2026 Yunnan Nuochong Technology Co., Ltd.',
    icp:'滇ICP备2026017420号'
  }

} as const;
const icons=[BookOpenText,Bot,GraduationCap];
const routeFor=(slug:string)=>productEntries.find(p=>p.slug===slug)!.path;
export function HomePage(){
 const language=useSyncExternalStore(subscribe,currentLanguage,()=> 'en' as Language),isTestEnv=useSyncExternalStore(subscribe,()=>location.hostname.endsWith('.workers.dev'),()=>false),t=copy[language];
 useEffect(()=>{document.documentElement.lang=language==='zh'?'zh-CN':'en';},[language]);
 function setLanguage(next:Language){try{localStorage.setItem('nuochong-language',next);}catch{ /* Query preference still works when storage is unavailable. */ }const url=new URL(location.href);url.searchParams.set('lang',next);history.replaceState({},'',url.pathname+url.search+url.hash);window.dispatchEvent(new Event('nuochong-language-change'));}
 return <main className="marketing-page" data-language={language}>
 {isTestEnv&&<div className="test-env-badge" role="status" aria-label="测试环境"><span className="test-env-dot"/>测试环境</div>}
 <header className="site-header"><div className="container nav-wrap"><a className="brand" href="#top" aria-label={t.brand}><img src="/logo-mark.svg" alt=""/><span>{t.brand}</span></a><nav aria-label={language==='en'?'Primary navigation':'主要导航'}><a href="#top">{t.home}</a>{t.nav.map((label,i)=><a key={label} href={'#'+['product','value','scenes','about'][i]}>{label}</a>)}</nav><div className="nav-actions"><div className="language-switcher" role="group" aria-label={t.languageLabel}>{(['en','zh'] as const).map(lang=><button key={lang} type="button" className={lang===language?'active':''} onClick={()=>setLanguage(lang)} aria-pressed={lang===language}>{lang==='en'?'EN':'中文'}</button>)}</div><a className="button button-small" href="/product/kb">{t.try}</a></div></div></header>
 <section className="m-hero" id="top"><div className="container m-hero-grid"><div className="m-hero-copy"><div className="m-eyebrow"><span/>{t.eyebrow}</div><h1>{t.hero1}<br/><span>{t.hero2}</span></h1><p className="m-lead">{t.intro}</p><div className="hero-actions"><a className="button" href="/product/kb">{t.try}<ArrowRight size={18}/></a><a className="button button-ghost" href="#product">{t.explore}</a></div><p className="m-availability"><span/>{t.availability}</p></div>
 <div className="m-system" aria-label={t.system}><div className="m-system-title"><span className="m-system-dot"/>{t.system}<Layers3 size={17}/></div><div className="m-system-products">{t.products.map((p,i)=>{const Icon=icons[i];return <a key={p.slug} href={routeFor(p.slug)} className={i===0?'m-system-product current':'m-system-product'}><Icon size={23}/><span><b>{p.name}</b><small>{i===0?t.live:t.planned}</small></span><ArrowRight size={16}/></a>;})}</div><div className="m-system-flow"><span>{t.flowLabel}</span><div>{t.flow.map((step,i)=><span key={step}><i>0{i+1}</i>{step}{i<3&&<ArrowRight size={12}/>}</span>)}</div></div><div className="m-system-base"><div><Layers3 size={22}/><span><b>{t.baseSub}</b><small>{t.base}</small></span><span className="m-base-label">AI NATIVE</span></div></div></div></div><div className="container m-hero-foundation">{t.heroFoot.map((item,i)=>{const Icon=[Bot,ShieldCheck,Plug][i];return <span key={item}><Icon size={16}/>{item}</span>;})}</div></section>
 <section className="m-section m-products" id="product"><div className="container"><div className="m-section-heading"><div><span className="m-kicker">{t.productKicker}</span><h2>{t.productTitle}</h2></div><p>{t.productIntro}</p></div><div className="m-product-grid">{t.products.map((p,i)=>{const Icon=icons[i];return <article key={p.slug} className={'m-product-card '+(i===0?'m-product-live':'')}><div className="m-product-card-top"><span className="m-product-icon"><Icon size={27} strokeWidth={1.7}/></span><span className={'m-state '+(i===0?'available':'')}>{i===0?t.live:t.planned}</span></div><span className="m-product-eyebrow">0{i+1} / {p.eyebrow}</span><h3>{p.name}</h3><h4>{p.title}</h4><p>{p.text}</p>{i>0&&<span className="m-direction">{t.direction}</span>}<ul>{p.features.map(item=><li key={item}><Check size={15}/>{item}</li>)}</ul><a href={routeFor(p.slug)} className={i===0?'button m-card-cta':'m-card-link'}>{p.action}<ArrowRight size={17}/></a></article>;})}</div></div></section>
 <section className="m-section m-value" id="value"><div className="container m-value-layout"><div><span className="m-kicker">{t.valueKicker}</span><h2>{t.valueTitle}</h2><div className="m-value-mark" aria-hidden="true"><span>KNOWLEDGE</span><span>WORK</span><span>GROWTH</span></div></div><div>{t.values.map(([title,text],i)=><article className="m-value-row" key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>
 <section className="m-architecture"><div className="container m-architecture-grid"><div><span className="m-kicker">{t.architectureKicker}</span><h2>{t.architectureTitle}</h2><p>{t.architectureText}</p><div className="m-principles">{t.architectureItems.map(([title,text],i)=>{const Icon=[Layers3,Plug,Workflow][i];return <div key={title}><Icon size={20}/><div><h3>{title}</h3><p>{text}</p></div></div>;})}</div></div><div className="m-plugin-board" aria-label={t.pluginLabel}><span className="m-board-label">{t.diagramProducts}</span><div className="m-board-products">{t.products.map((p,i)=>{const Icon=icons[i];return <div key={p.slug}><Icon size={20}/><b>{p.name}</b></div>;})}</div><span className="m-board-connector"/><span className="m-board-label">{t.diagramShared}</span><div className="m-board-shared">{t.plugins.map(item=><span key={item}><Plug size={13}/>{item}</span>)}</div><div className="m-board-core"><span>{t.diagramCore}</span><strong>DeepSeek Harness</strong><small>API · CLI · MCP</small></div><span className="m-board-label">{t.diagramBusiness}</span><div className="m-board-business">{t.businessPlugins.map(item=><span key={item}>＋ {item}</span>)}</div><p className="m-board-note">{t.architectureNote}</p></div></div></section>
 <section className="m-section m-scenarios" id="scenes"><div className="container"><span className="m-kicker">{t.scenesKicker}</span><h2>{t.scenesTitle}</h2><div className="m-scenario-grid">{t.scenes.map(([title,text,state],i)=>{const Icon=icons[i];return <article key={title}><div className="m-scenario-icon"><Icon size={30} strokeWidth={1.5}/></div><h3>{title}</h3><p>{text}</p><span>{state}</span></article>;})}</div></div></section>
 <section className="m-section m-about" id="about"><div className="container m-about-grid"><div><span className="m-kicker">{t.aboutKicker}</span><h2>{t.aboutTitle}</h2></div><p>{t.aboutText}</p></div></section>
 <section className="m-contact" id="apply"><div className="container m-contact-card"><div><span className="m-kicker">{t.contactKicker}</span><h2>{t.contactTitle}</h2><p>{t.contactText}</p><div className="hero-actions"><a className="button" href="/product/kb">{t.try}<ArrowRight size={18}/></a><a className="button button-ghost" href={'mailto:marketing@nuochong.work?subject='+encodeURIComponent(t.subject)}>{t.request}<ExternalLink size={15}/></a></div></div><div className="m-contact-info"><img src="/contact_me_qr.png" alt={t.qrAlt} width="92" height="92"/><div><span>{t.phone}</span><b>0871-67200971</b><span>{t.email}</span><a href="mailto:marketing@nuochong.work">marketing@nuochong.work</a></div></div></div></section>
 <footer><div className="container footer-main"><div className="footer-brand"><a className="brand" href="#top"><img src="/logo-mark.svg" alt=""/><span>{t.brand}</span></a><p>{t.tagline}</p></div><div><b>{t.product}</b>{t.footerLinks.map((label,i)=><a key={label} href={productEntries[i].path}>{label}</a>)}</div><div><b>{t.company}</b><a href="#about">{t.companyLinks[0]}</a><a href="#scenes">{t.companyLinks[1]}</a><a href="#apply">{t.companyLinks[2]}</a></div><div><b>{t.request}</b><a href="#apply">{t.wecom}</a><a href="mailto:marketing@nuochong.work">{t.email}</a></div></div><div className="container copyright"><span>{t.copyright}</span><a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{t.icp}</a></div></footer>
 </main>;
}
