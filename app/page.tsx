import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "诺崇科技｜企业知识与智能培训平台",
  description:
    "面向企业的知识库、培训、考试与 AI 智能应用平台，让知识沉淀更高效、人员培养更系统、组织能力持续增长。",
};

const capabilities = [
  {
    icon: "知",
    title: "企业知识库",
    text: "统一沉淀制度、案例、经验与业务资料，让知识有序积累、随时可查。",
    tag: "知识沉淀",
  },
  {
    icon: "AI",
    title: "智能问答助手",
    text: "基于企业可信知识精准回答，帮助员工快速找到信息、理解流程并完成工作。",
    tag: "AI 赋能",
  },
  {
    icon: "学",
    title: "培训学习中心",
    text: "围绕岗位和能力搭建课程体系，支持必修、选修与分阶段培养计划。",
    tag: "人员培养",
  },
  {
    icon: "考",
    title: "考试与测评",
    text: "灵活组卷、在线考试与结果分析，持续验证学习效果和岗位胜任力。",
    tag: "能力检验",
  },
  {
    icon: "路",
    title: "成长学习路径",
    text: "为新员工、专业岗位和管理人才配置清晰、可追踪的成长路径。",
    tag: "持续成长",
  },
  {
    icon: "析",
    title: "组织学习分析",
    text: "从学习、考试和知识使用数据中识别差距，为人才发展提供依据。",
    tag: "数据洞察",
  },
];

const scenes = [
  ["新人快速上岗", "把入职资料、岗位课程和通关考试串成完整培养路径。"],
  ["业务知识传承", "沉淀优秀案例与专家经验，让关键能力不因人员流动而流失。"],
  ["制度流程落地", "让员工随时查询规范、理解流程，并通过测评确保执行一致。"],
  ["岗位能力提升", "围绕岗位能力模型持续学习、练习、考试并优化培养方案。"],
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="container nav-wrap">
          <a className="brand" href="#top" aria-label="诺崇科技首页">
            <img src="/logo-mark.svg" alt="" />
            <span>诺崇科技</span>
          </a>
          <nav aria-label="主要导航">
            <a href="#product">产品能力</a>
            <a href="#value">核心价值</a>
            <a href="#scenes">应用场景</a>
            <a href="#about">关于我们</a>
          </nav>
          <a className="button button-small" href="#apply">申请使用</a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span>AI</span> 企业知识与智能培训平台</div>
            <h1>让企业知识<br />成为<span>成长的力量</span></h1>
            <p>
              汇聚知识库、智能问答、培训、考试与学习分析，帮助企业系统培养人才、持续提升能力，让每一份经验都能被组织高效复用。
            </p>
            <div className="hero-actions">
              <a className="button" href="#apply">申请使用 <span aria-hidden="true">→</span></a>
              <a className="button button-ghost" href="#product">了解产品能力</a>
            </div>
            <div className="hero-points" aria-label="平台特点">
              <span>✓ 一体化平台</span>
              <span>✓ 企业级知识安全</span>
              <span>✓ AI 深度融合</span>
            </div>
          </div>

          <div className="product-window" aria-label="产品界面概念展示">
            <div className="window-bar">
              <div className="window-brand"><img src="/logo-mark.svg" alt="" /><span>智能学习工作台</span></div>
              <div className="avatar">NC</div>
            </div>
            <div className="window-body">
              <aside className="mini-nav" aria-hidden="true">
                <span className="active">⌂</span><span>▤</span><span>✦</span><span>✓</span><span>◫</span>
              </aside>
              <div className="dashboard">
                <div className="welcome-row">
                  <div><small>上午好，欢迎回来</small><strong>开启今天的学习与探索</strong></div>
                  <span className="streak">连续学习 <b>12</b> 天</span>
                </div>
                <div className="ai-search">
                  <div className="spark">✦</div>
                  <div><small>企业 AI 助手</small><b>关于公司的知识，随时问我</b></div>
                  <span>提问 →</span>
                </div>
                <div className="metrics">
                  <div><span>知识内容</span><b>2,468</b><small>篇</small></div>
                  <div><span>学习完成率</span><b>86</b><small>%</small></div>
                  <div><span>能力成长</span><b>+24</b><small>%</small></div>
                </div>
                <div className="dashboard-bottom">
                  <div className="course-card">
                    <div className="card-heading"><b>我的学习任务</b><span>查看全部</span></div>
                    <div className="course-line"><i className="course-icon blue">培</i><div><b>新员工成长训练营</b><span><em style={{width:"78%"}} /> 78%</span></div></div>
                    <div className="course-line"><i className="course-icon cyan">AI</i><div><b>AI 助力高效工作</b><span><em style={{width:"52%"}} /> 52%</span></div></div>
                  </div>
                  <div className="growth-card">
                    <div className="card-heading"><b>能力成长</b><span>本月</span></div>
                    <div className="chart" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
                    <small>学习投入持续提升</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="container platform-strip">
          <span>一套平台，贯通企业人才成长全流程</span>
          <div><b>知识沉淀</b><i>→</i><b>培训学习</b><i>→</i><b>考试测评</b><i>→</i><b>AI 应用</b></div>
        </div>
      </section>

      <section className="section value-section" id="value">
        <div className="container">
          <div className="section-heading centered">
            <span>核心价值</span>
            <h2>从知识管理，到组织能力增长</h2>
            <p>不是简单堆放资料，而是让知识进入培养、工作和决策的每一个关键环节。</p>
          </div>
          <div className="value-grid">
            <article><div className="value-number">01</div><div className="value-icon">◎</div><h3>人员培养更系统</h3><p>围绕岗位建立标准化培养路径，降低新人培养成本，让人才成长有目标、有过程、有结果。</p><ul><li>岗位课程体系</li><li>分层分类培养</li><li>学习进度追踪</li></ul></article>
            <article className="featured"><div className="value-number">02</div><div className="value-icon">↗</div><h3>能力提升可衡量</h3><p>用考试测评和学习数据检验培养成效，发现能力差距，持续优化组织人才发展策略。</p><ul><li>考试与测评</li><li>能力数据看板</li><li>培养效果分析</li></ul></article>
            <article><div className="value-number">03</div><div className="value-icon">✦</div><h3>AI 赋能更深入</h3><p>让 AI 基于企业自己的知识提供可信服务，帮助员工更快获取信息、学习知识和解决问题。</p><ul><li>企业知识问答</li><li>智能内容辅助</li><li>个性化学习推荐</li></ul></article>
          </div>
        </div>
      </section>

      <section className="section product-section" id="product">
        <div className="container">
          <div className="section-heading split-heading">
            <div><span>产品能力</span><h2>一个平台，连接知识与人才</h2></div>
            <p>覆盖知识生产、学习培训、考试检验和数据分析，形成可持续运转的企业能力成长闭环。</p>
          </div>
          <div className="capability-grid">
            {capabilities.map((item) => (
              <article key={item.title}>
                <div className="cap-icon">{item.icon}</div>
                <span className="cap-tag">{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <a href="#apply" aria-label={`申请使用${item.title}`}>了解更多 <span>→</span></a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section ai-section">
        <div className="container ai-grid">
          <div className="ai-visual">
            <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
            <div className="knowledge-chip chip-one">制度文档</div>
            <div className="knowledge-chip chip-two">培训课程</div>
            <div className="knowledge-chip chip-three">业务案例</div>
            <div className="knowledge-chip chip-four">专家经验</div>
            <div className="ai-core"><img src="/logo-mark.svg" alt="" /><b>企业 AI</b><span>基于可信知识</span></div>
          </div>
          <div className="ai-copy">
            <div className="eyebrow light"><span>AI</span> 真正理解企业知识</div>
            <h2>让 AI 成为每位员工的<br />知识助手与成长伙伴</h2>
            <p>AI 不再只依赖通用信息，而是连接企业内部知识、课程和业务经验，在安全可控的范围内提供准确、可追溯的智能服务。</p>
            <div className="ai-list">
              <div><i>01</i><span><b>可信知识问答</b><small>答案基于企业授权知识，支持来源追溯</small></span></div>
              <div><i>02</i><span><b>智能学习辅助</b><small>解释难点、总结内容并推荐下一步学习</small></span></div>
              <div><i>03</i><span><b>知识持续进化</b><small>从使用反馈中发现缺口，推动内容不断完善</small></span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section scenes-section" id="scenes">
        <div className="container">
          <div className="section-heading centered"><span>应用场景</span><h2>覆盖企业人才发展的关键时刻</h2><p>从员工加入，到专业成长，再到组织知识传承，为不同阶段提供统一支持。</p></div>
          <div className="scenes-grid">
            {scenes.map(([title, text], index) => <article key={title}><div className={`scene-visual scene-${index + 1}`}><span>{String(index + 1).padStart(2, "0")}</span><i /></div><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="section about-section" id="about">
        <div className="container about-grid">
          <div><span className="section-kicker">关于诺崇科技</span><h2>用可靠的 AI 技术，<br />推动组织持续成长</h2></div>
          <div><p>云南诺崇科技有限公司是一家专注于企业智能化应用的 AI 科技公司。我们从企业真实的人才培养和知识管理需求出发，打造易用、可信、可持续演进的数字化产品。</p><p>我们相信，技术的价值不只是提高效率，更是帮助企业激活知识、成就员工，并将个体经验转化为组织长期发展的能力。</p></div>
        </div>
      </section>

      <section className="apply-section" id="apply">
        <div className="container apply-card">
          <div className="apply-copy"><span>开始构建企业知识与人才成长体系</span><h2>申请使用企业知识与智能培训平台</h2><p>联系我们，了解平台如何结合贵公司的业务场景落地。</p></div>
          <div className="contact-options">
            <div className="wechat-placeholder"><div className="qr-grid" aria-hidden="true">{Array.from({length: 25}).map((_, i) => <i key={i} />)}</div><span>企业微信二维码<br /><small>待替换</small></span></div>
            <div className="contact-detail"><span>企业微信</span><b>Nuochong-AI</b><small>（占位信息）</small><span>商务邮箱</span><a href="mailto:business@nuochong.ai?subject=申请使用企业知识与智能培训平台">business@nuochong.ai</a><small>（占位信息）</small></div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container footer-main">
          <div className="footer-brand"><a className="brand" href="#top"><img src="/logo-mark.svg" alt=""/><span>诺崇科技</span></a><p>让企业知识成为成长的力量</p></div>
          <div><b>产品</b><a href="#product">企业知识库</a><a href="#product">培训与考试</a><a href="#product">企业 AI 助手</a></div>
          <div><b>公司</b><a href="#about">关于我们</a><a href="#scenes">应用场景</a><a href="#apply">联系我们</a></div>
          <div><b>申请使用</b><a href="#apply">企业微信</a><a href="mailto:business@nuochong.ai">商务邮箱</a></div>
        </div>
        <div className="container copyright"><span>© 2026 云南诺崇科技有限公司</span><span>滇ICP备XXXXXXXX号（占位）</span></div>
      </footer>
    </main>
  );
}
