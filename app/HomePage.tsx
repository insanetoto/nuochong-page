"use client";

import { useEffect, useState } from "react";
import {
  BookOpenText,
  Bot,
  ChartNoAxesCombined,
  ClipboardCheck,
  GraduationCap,
  Route,
} from "lucide-react";

type Language = "en" | "zh";

const capabilityIcons = [
  BookOpenText,
  Bot,
  GraduationCap,
  ClipboardCheck,
  Route,
  ChartNoAxesCombined,
] as const;

const copy = {
  en: {
    brand: "Nuochong Technology",
    languageLabel: "Switch language",
    nav: ["Platform", "Value", "Use Cases", "About"],
    apply: "Request Access",
    hero: {
      eyebrow: "Enterprise Knowledge & Intelligent Training Platform",
      line1: "Turn enterprise knowledge",
      accent: "into a force for growth",
      text: "Bring knowledge management, AI search, training, assessments, and learning analytics together—so your people grow systematically and every valuable insight can be reused across the organization.",
      secondary: "Explore the Platform",
      points: ["One integrated platform", "Enterprise-grade knowledge security", "AI deeply embedded"],
    },
    dashboard: {
      title: "Intelligent Learning Workspace",
      greeting: "Good morning, welcome back",
      start: "Start today’s learning and discovery",
      streak: "Learning streak",
      days: "days",
      assistant: "Enterprise AI Assistant",
      askCopy: "Ask anything about your organization",
      ask: "Ask",
      metrics: [["Knowledge items", "2,468", ""], ["Completion rate", "86", "%"], ["Capability growth", "+24", "%"]],
      tasks: "My learning tasks",
      all: "View all",
      course1: "New Hire Growth Program",
      course2: "Work Smarter with AI",
      growth: "Capability growth",
      month: "This month",
      trend: "Learning engagement is rising",
    },
    flow: {
      lead: "One platform for the complete enterprise talent journey",
      items: ["Capture knowledge", "Train people", "Assess capability", "Apply AI"],
    },
    value: {
      kicker: "CORE VALUE",
      title: "From knowledge management to organizational capability",
      intro: "Go beyond storing documents. Put knowledge to work across learning, daily operations, and decision-making.",
      items: [
        { icon: "◎", title: "Systematic talent development", text: "Build role-based learning paths that lower onboarding costs and give every employee a clear, measurable path to growth.", tags: ["Role-based curricula", "Tiered development", "Progress tracking"] },
        { icon: "↗", title: "Measurable capability growth", text: "Use assessments and learning data to validate outcomes, identify gaps, and continuously improve talent strategies.", tags: ["Exams & assessments", "Capability dashboard", "Outcome analytics"] },
        { icon: "✦", title: "AI embedded in real work", text: "Ground AI in your trusted enterprise knowledge so employees can find information, learn faster, and solve problems with confidence.", tags: ["Knowledge Q&A", "Content assistance", "Personalized learning"] },
      ],
    },
    product: {
      kicker: "PLATFORM CAPABILITIES",
      title: "One platform connecting knowledge and people",
      intro: "Cover the full loop—from knowledge creation and employee learning to assessment and analytics—with a system built for continuous improvement.",
      more: "Learn more",
      items: [
        { title: "Enterprise Knowledge Base", text: "Centralize policies, cases, expertise, and business content so critical knowledge stays organized and accessible.", tag: "Knowledge" },
        { title: "AI Knowledge Assistant", text: "Deliver accurate answers grounded in trusted sources, helping employees understand processes and complete work faster.", tag: "AI Enablement" },
        { title: "Learning & Training Hub", text: "Create role- and capability-based curricula with required, elective, and phased development programs.", tag: "Training" },
        { title: "Exams & Assessments", text: "Build flexible tests, run online assessments, and analyze results to validate learning and role readiness.", tag: "Assessment" },
        { title: "Growth Learning Paths", text: "Configure clear, trackable journeys for new hires, specialists, managers, and future leaders.", tag: "Growth" },
        { title: "Learning Analytics", text: "Reveal capability gaps through knowledge usage, training, and assessment data to guide talent decisions.", tag: "Insights" },
      ],
    },
    ai: {
      chips: ["Policies", "Training content", "Business cases", "Expert knowledge"],
      core: "Enterprise AI",
      grounded: "Grounded in trusted knowledge",
      eyebrow: "AI that understands your organization",
      title1: "Give every employee an AI",
      title2: "knowledge and growth partner",
      text: "Go beyond generic AI. Connect internal knowledge, training content, and business expertise to deliver accurate, traceable assistance within a secure and controlled environment.",
      items: [
        ["Trusted knowledge answers", "Answers are grounded in authorized sources with traceable references"],
        ["Intelligent learning support", "Explain difficult topics, summarize content, and recommend next steps"],
        ["Knowledge that keeps improving", "Identify content gaps from real usage and continuously strengthen the knowledge base"],
      ],
    },
    scenes: {
      kicker: "USE CASES",
      title: "Support every critical moment of talent development",
      intro: "From onboarding and role development to knowledge transfer, provide consistent support throughout the employee journey.",
      items: [
        ["Accelerate onboarding", "Connect onboarding materials, role-based courses, and qualification exams in one structured journey."],
        ["Preserve business expertise", "Capture best practices and expert experience so critical capabilities stay with the organization."],
        ["Operationalize policies", "Help employees find and understand policies, then validate adoption through assessments."],
        ["Build role capability", "Continuously learn, practice, assess, and improve against a clear role capability model."],
      ],
    },
    about: {
      kicker: "ABOUT NUOCHONG",
      title1: "Reliable AI technology for",
      title2: "continuous organizational growth",
      paragraphs: [
        "Yunnan Nuochong Technology Co., Ltd. is an AI technology company focused on intelligent enterprise applications. We start from real knowledge-management and talent-development needs to build products that are practical, trustworthy, and designed to evolve.",
        "We believe technology should do more than improve efficiency. It should activate enterprise knowledge, help people succeed, and turn individual expertise into a long-term organizational advantage.",
      ],
    },
    contact: {
      kicker: "Build your enterprise knowledge and talent growth system",
      title: "Request access to the platform",
      text: "Talk to us about how the platform can support your organization’s goals and business scenarios.",
      qrAlt: "WeCom QR code to contact Nuochong Technology",
      phone: "Contact phone",
      email: "Business email",
      subject: "Request access to the Enterprise Knowledge & Intelligent Training Platform",
    },
    footer: {
      tagline: "Turn enterprise knowledge into a force for growth",
      product: "Platform",
      productLinks: ["Enterprise Knowledge Base", "Training & Assessments", "Enterprise AI Assistant"],
      company: "Company",
      companyLinks: ["About", "Use Cases", "Contact"],
      request: "Request Access",
      wecom: "WeCom",
      email: "Business Email",
      copyright: "© 2026 Yunnan Nuochong Technology Co., Ltd.",
    },
  },
  zh: {
    brand: "诺崇科技",
    languageLabel: "切换语言",
    nav: ["产品能力", "核心价值", "应用场景", "关于我们"],
    apply: "申请使用",
    hero: {
      eyebrow: "企业知识与智能培训平台",
      line1: "让企业知识",
      accent: "成为成长的力量",
      text: "汇聚知识库、智能问答、培训、考试与学习分析，帮助企业系统培养人才、持续提升能力，让每一份经验都能被组织高效复用。",
      secondary: "了解产品能力",
      points: ["一体化平台", "企业级知识安全", "AI 深度融合"],
    },
    dashboard: {
      title: "智能学习工作台", greeting: "上午好，欢迎回来", start: "开启今天的学习与探索", streak: "连续学习", days: "天", assistant: "企业 AI 助手", askCopy: "关于公司的知识，随时问我", ask: "提问",
      metrics: [["知识内容", "2,468", "篇"], ["学习完成率", "86", "%"], ["能力成长", "+24", "%"]],
      tasks: "我的学习任务", all: "查看全部", course1: "新员工成长训练营", course2: "AI 助力高效工作", growth: "能力成长", month: "本月", trend: "学习投入持续提升",
    },
    flow: { lead: "一套平台，贯通企业人才成长全流程", items: ["知识沉淀", "培训学习", "考试测评", "AI 应用"] },
    value: {
      kicker: "核心价值", title: "从知识管理，到组织能力增长", intro: "不是简单堆放资料，而是让知识进入培养、工作和决策的每一个关键环节。",
      items: [
        { icon: "◎", title: "人员培养更系统", text: "围绕岗位建立标准化培养路径，降低新人培养成本，让人才成长有目标、有过程、有结果。", tags: ["岗位课程体系", "分层分类培养", "学习进度追踪"] },
        { icon: "↗", title: "能力提升可衡量", text: "用考试测评和学习数据检验培养成效，发现能力差距，持续优化组织人才发展策略。", tags: ["考试与测评", "能力数据看板", "培养效果分析"] },
        { icon: "✦", title: "AI 赋能更深入", text: "让 AI 基于企业自己的知识提供可信服务，帮助员工更快获取信息、学习知识和解决问题。", tags: ["企业知识问答", "智能内容辅助", "个性化学习推荐"] },
      ],
    },
    product: {
      kicker: "产品能力", title: "一个平台，连接知识与人才", intro: "覆盖知识生产、学习培训、考试检验和数据分析，形成可持续运转的企业能力成长闭环。", more: "了解更多",
      items: [
        { title: "企业知识库", text: "统一沉淀制度、案例、经验与业务资料，让知识有序积累、随时可查。", tag: "知识沉淀" },
        { title: "智能问答助手", text: "基于企业可信知识精准回答，帮助员工快速找到信息、理解流程并完成工作。", tag: "AI 赋能" },
        { title: "培训学习中心", text: "围绕岗位和能力搭建课程体系，支持必修、选修与分阶段培养计划。", tag: "人员培养" },
        { title: "考试与测评", text: "灵活组卷、在线考试与结果分析，持续验证学习效果和岗位胜任力。", tag: "能力检验" },
        { title: "成长学习路径", text: "为新员工、专业岗位和管理人才配置清晰、可追踪的成长路径。", tag: "持续成长" },
        { title: "组织学习分析", text: "从学习、考试和知识使用数据中识别差距，为人才发展提供依据。", tag: "数据洞察" },
      ],
    },
    ai: {
      chips: ["制度文档", "培训课程", "业务案例", "专家经验"], core: "企业 AI", grounded: "基于可信知识", eyebrow: "真正理解企业知识", title1: "让 AI 成为每位员工的", title2: "知识助手与成长伙伴",
      text: "AI 不再只依赖通用信息，而是连接企业内部知识、课程和业务经验，在安全可控的范围内提供准确、可追溯的智能服务。",
      items: [["可信知识问答", "答案基于企业授权知识，支持来源追溯"], ["智能学习辅助", "解释难点、总结内容并推荐下一步学习"], ["知识持续进化", "从使用反馈中发现缺口，推动内容不断完善"]],
    },
    scenes: {
      kicker: "应用场景", title: "覆盖企业人才发展的关键时刻", intro: "从员工加入，到专业成长，再到组织知识传承，为不同阶段提供统一支持。",
      items: [["新人快速上岗", "把入职资料、岗位课程和通关考试串成完整培养路径。"], ["业务知识传承", "沉淀优秀案例与专家经验，让关键能力不因人员流动而流失。"], ["制度流程落地", "让员工随时查询规范、理解流程，并通过测评确保执行一致。"], ["岗位能力提升", "围绕岗位能力模型持续学习、练习、考试并优化培养方案。"]],
    },
    about: {
      kicker: "关于诺崇科技", title1: "用可靠的 AI 技术，", title2: "推动组织持续成长",
      paragraphs: ["云南诺崇科技有限公司是一家专注于企业智能化应用的 AI 科技公司。我们从企业真实的人才培养和知识管理需求出发，打造易用、可信、可持续演进的数字化产品。", "我们相信，技术的价值不只是提高效率，更是帮助企业激活知识、成就员工，并将个体经验转化为组织长期发展的能力。"],
    },
    contact: {
      kicker: "开始构建企业知识与人才成长体系", title: "申请使用企业知识与智能培训平台", text: "联系我们，了解平台如何结合贵公司的业务场景落地。", qrAlt: "诺崇科技企业微信二维码", phone: "联系电话", email: "商务邮箱", subject: "申请使用企业知识与智能培训平台",
    },
    footer: {
      tagline: "让企业知识成为成长的力量", product: "产品", productLinks: ["企业知识库", "培训与考试", "企业 AI 助手"], company: "公司", companyLinks: ["关于我们", "应用场景", "联系我们"], request: "申请使用", wecom: "企业微信", email: "商务邮箱", copyright: "© 2026 云南诺崇科技有限公司",
    },
  },
} as const;

export function HomePage() {
  const [language, setLanguageState] = useState<Language>("en");
  const t = copy[language];

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("lang");
    const saved = window.localStorage.getItem("nuochong-language");

    // Explicit user preference takes priority
    if (query === "zh" || (query !== "en" && saved === "zh")) {
      setLanguageState("zh");
      document.documentElement.lang = "zh-CN";
      return;
    }
    if (query === "en" || saved === "en") {
      // en is the default state, no change needed
      return;
    }

    // No preference set — detect from browser language
    if (navigator.language?.toLowerCase().startsWith("zh")) {
      setLanguageState("zh");
      document.documentElement.lang = "zh-CN";
    }
  }, []);

  function setLanguage(next: Language) {
    setLanguageState(next);
    window.localStorage.setItem("nuochong-language", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    const url = new URL(window.location.href);
    if (next === "zh") url.searchParams.set("lang", "zh");
    else url.searchParams.delete("lang");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <main data-language={language}>
      <header className="site-header">
        <div className="container nav-wrap">
          <a className="brand" href="#top" aria-label={t.brand}>
            <img src="/logo-mark.svg" alt="" />
            <span>{t.brand}</span>
          </a>
          <nav aria-label={language === "en" ? "Primary navigation" : "主要导航"}>
            <a href="#product">{t.nav[0]}</a><a href="#value">{t.nav[1]}</a><a href="#scenes">{t.nav[2]}</a><a href="#about">{t.nav[3]}</a>
          </nav>
          <div className="nav-actions">
            <div className="language-switcher" role="group" aria-label={t.languageLabel}>
              <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>EN</button>
              <button type="button" className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")} aria-pressed={language === "zh"}>中文</button>
            </div>
            <a className="button button-small" href="#apply">{t.apply}</a>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span>AI</span> {t.hero.eyebrow}</div>
            <h1>{t.hero.line1}<br /><span>{t.hero.accent}</span></h1>
            <p>{t.hero.text}</p>
            <div className="hero-actions"><a className="button" href="#apply">{t.apply} <span aria-hidden="true">→</span></a><a className="button button-ghost" href="#product">{t.hero.secondary}</a></div>
            <div className="hero-points" aria-label={language === "en" ? "Platform benefits" : "平台特点"}>{t.hero.points.map((point) => <span key={point}>✓ {point}</span>)}</div>
          </div>

          <div className="product-window" aria-label={language === "en" ? "Platform interface concept" : "产品界面概念展示"}>
            <div className="window-bar"><div className="window-brand"><img src="/logo-mark.svg" alt="" /><span>{t.dashboard.title}</span></div><div className="avatar">NC</div></div>
            <div className="window-body">
              <aside className="mini-nav" aria-hidden="true"><span className="active">⌂</span><span>▤</span><span>✦</span><span>✓</span><span>◫</span></aside>
              <div className="dashboard">
                <div className="welcome-row"><div><small>{t.dashboard.greeting}</small><strong>{t.dashboard.start}</strong></div><span className="streak">{t.dashboard.streak} <b>12</b> {t.dashboard.days}</span></div>
                <div className="ai-search"><div className="spark">✦</div><div><small>{t.dashboard.assistant}</small><b>{t.dashboard.askCopy}</b></div><span>{t.dashboard.ask} →</span></div>
                <div className="metrics">{t.dashboard.metrics.map(([label, number, unit]) => <div key={label}><span>{label}</span><b>{number}</b><small>{unit}</small></div>)}</div>
                <div className="dashboard-bottom">
                  <div className="course-card"><div className="card-heading"><b>{t.dashboard.tasks}</b><span>{t.dashboard.all}</span></div><div className="course-line"><i className="course-icon blue">L</i><div><b>{t.dashboard.course1}</b><span><em style={{width:"78%"}} /></span></div></div><div className="course-line"><i className="course-icon cyan">AI</i><div><b>{t.dashboard.course2}</b><span><em style={{width:"52%"}} /></span></div></div></div>
                  <div className="growth-card"><div className="card-heading"><b>{t.dashboard.growth}</b><span>{t.dashboard.month}</span></div><div className="chart" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div><small>{t.dashboard.trend}</small></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="container platform-strip"><span>{t.flow.lead}</span><div>{t.flow.items.map((item, index) => <span className="flow-item" key={item}><b>{item}</b>{index < t.flow.items.length - 1 && <i>→</i>}</span>)}</div></div>
      </section>

      <section className="section value-section" id="value"><div className="container"><div className="section-heading centered"><span>{t.value.kicker}</span><h2>{t.value.title}</h2><p>{t.value.intro}</p></div><div className="value-grid">{t.value.items.map((item, index) => <article className={index === 1 ? "featured" : ""} key={item.title}><div className="value-number">0{index + 1}</div><div className="value-icon">{item.icon}</div><h3>{item.title}</h3><p>{item.text}</p><ul>{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul></article>)}</div></div></section>

      <section className="section product-section" id="product"><div className="container"><div className="section-heading split-heading"><div><span>{t.product.kicker}</span><h2>{t.product.title}</h2></div><p>{t.product.intro}</p></div><div className="capability-grid">{t.product.items.map((item, index) => { const Icon = capabilityIcons[index]; return <article key={item.title}><div className={`cap-icon cap-icon-${index + 1}`} aria-hidden="true"><Icon size={24} strokeWidth={1.9} /></div><span className="cap-tag">{item.tag}</span><h3>{item.title}</h3><p>{item.text}</p><a href="#apply" aria-label={`${t.product.more}: ${item.title}`}>{t.product.more} <span>→</span></a></article>; })}</div></div></section>

      <section className="section ai-section"><div className="container ai-grid"><div className="ai-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/>{t.ai.chips.map((chip, index) => <div className={`knowledge-chip chip-${["one","two","three","four"][index]}`} key={chip}>{chip}</div>)}<div className="ai-core"><img src="/logo-mark.svg" alt="" /><b>{t.ai.core}</b><span>{t.ai.grounded}</span></div></div><div className="ai-copy"><div className="eyebrow light"><span>AI</span> {t.ai.eyebrow}</div><h2>{t.ai.title1}<br />{t.ai.title2}</h2><p>{t.ai.text}</p><div className="ai-list">{t.ai.items.map(([title, text], index) => <div key={title}><i>0{index + 1}</i><span><b>{title}</b><small>{text}</small></span></div>)}</div></div></div></section>

      <section className="section scenes-section" id="scenes"><div className="container"><div className="section-heading centered"><span>{t.scenes.kicker}</span><h2>{t.scenes.title}</h2><p>{t.scenes.intro}</p></div><div className="scenes-grid">{t.scenes.items.map(([title, text], index) => <article key={title}><div className={`scene-visual scene-${index + 1}`}><span>{String(index + 1).padStart(2,"0")}</span><i /></div><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="section about-section" id="about"><div className="container about-grid"><div><span className="section-kicker">{t.about.kicker}</span><h2>{t.about.title1}<br />{t.about.title2}</h2></div><div>{t.about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></div></section>

      <section className="apply-section" id="apply"><div className="container apply-card"><div className="apply-copy"><span>{t.contact.kicker}</span><h2>{t.contact.title}</h2><p>{t.contact.text}</p></div><div className="contact-options"><div className="wechat-placeholder"><img className="qr-image" src="/contact_me_qr.png" alt={t.contact.qrAlt} width="76" height="76" /></div><div className="contact-detail"><span>{t.contact.phone}</span><b>0871-67200971</b><span>{t.contact.email}</span><a href={`mailto:business@nuochong.net?subject=${encodeURIComponent(t.contact.subject)}`}>business@nuochong.net</a></div></div></div></section>

      <footer><div className="container footer-main"><div className="footer-brand"><a className="brand" href="#top"><img src="/logo-mark.svg" alt=""/><span>{t.brand}</span></a><p>{t.footer.tagline}</p></div><div><b>{t.footer.product}</b>{t.footer.productLinks.map(link => <a href="#product" key={link}>{link}</a>)}</div><div><b>{t.footer.company}</b><a href="#about">{t.footer.companyLinks[0]}</a><a href="#scenes">{t.footer.companyLinks[1]}</a><a href="#apply">{t.footer.companyLinks[2]}</a></div><div><b>{t.footer.request}</b><a href="#apply">{t.footer.wecom}</a><a href="mailto:business@nuochong.net">{t.footer.email}</a></div></div><div className="container copyright"><span>{t.footer.copyright}</span></div></footer>
    </main>
  );
}
