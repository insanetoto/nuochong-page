export type HelpCategory = {
  id: string;
  name: string;
  description: string;
  icon: string;
  parentId: string | null;
};

export type HelpArticle = {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  content: string[];
  updatedAt: string;
};

export const mockHelpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    name: "快速上手",
    description: "了解平台基础功能与首次使用指引",
    icon: "rocket",
    parentId: null,
  },
  {
    id: "account",
    name: "账号与权限",
    description: "登录、安全设置与权限申请",
    icon: "user",
    parentId: null,
  },
  {
    id: "knowledge",
    name: "知识库",
    description: "创建、整理与检索企业知识",
    icon: "book",
    parentId: null,
  },
  {
    id: "training",
    name: "培训中心",
    description: "课程学习、进度与考核",
    icon: "graduation",
    parentId: null,
  },
  {
    id: "workorders",
    name: "工单管理",
    description: "提交与跟踪支持请求",
    icon: "clipboard",
    parentId: null,
  },
];

export const mockHelpArticles: HelpArticle[] = [
  {
    id: "a1",
    categoryId: "getting-started",
    title: "如何登录业务系统",
    summary: "介绍使用内部账号登录业务系统的步骤。",
    content: [
      "在浏览器中打开业务系统地址，点击右下角的「业务系统」入口。",
      "输入管理员分配的用户名与密码，点击「登录」。",
      "首次登录后，建议前往「安全设置」修改初始密码。",
      "如忘记密码，请联系系统管理员重置。",
    ],
    updatedAt: "2026-08-18",
  },
  {
    id: "a2",
    categoryId: "getting-started",
    title: "控制台与导航概览",
    summary: "快速认识左侧导航与顶部用户菜单。",
    content: [
      "登录后默认进入「控制台」，可查看员工总数、活跃账号等概览数据。",
      "左侧导航用于切换用户与员工、通知中心、帮助中心、培训知识库与工单管理。",
      "右上角可切换界面语言（中文 / English）并退出登录。",
    ],
    updatedAt: "2026-08-16",
  },
  {
    id: "a3",
    categoryId: "account",
    title: "修改登录密码",
    summary: "定期更新密码，保障账号安全。",
    content: [
      "进入「用户与员工 → 安全设置」。",
      "在「密码」区域输入当前密码与新密码。",
      "新密码建议包含字母、数字与特殊字符。",
      "点击「修改密码」后完成更新。",
    ],
    updatedAt: "2026-08-15",
  },
  {
    id: "a4",
    categoryId: "account",
    title: "如何申请账号权限",
    summary: "提交工单申请额外系统权限。",
    content: [
      "进入「工单管理」，点击「新建工单」。",
      "选择或填写所需权限，提交后等待处理人处理。",
      "可在工单详情中跟踪处理进度。",
    ],
    updatedAt: "2026-08-12",
  },
  {
    id: "a5",
    categoryId: "knowledge",
    title: "创建第一篇知识文档",
    summary: "在知识库中沉淀团队经验。",
    content: [
      "知识库支持按分类组织企业文档与案例。",
      "创建时填写标题、分类与正文，保存后即可被检索。",
      "使用清晰标题与关键词，有助于后续搜索。",
    ],
    updatedAt: "2026-08-10",
  },
  {
    id: "a6",
    categoryId: "training",
    title: "查看课程学习进度",
    summary: "跟踪个人课程完成情况。",
    content: [
      "进入「培训知识库」，可按分类或状态筛选课程。",
      "每门课程展示进度百分比与更新时间。",
      "点击课程可查看详情并继续学习。",
    ],
    updatedAt: "2026-08-08",
  },
  {
    id: "a7",
    categoryId: "workorders",
    title: "如何提交与跟踪工单",
    summary: "遇到问题时提交工单并跟踪处理。",
    content: [
      "进入「工单管理」，点击「新建工单」。",
      "填写标题、描述、优先级等信息后提交。",
      "在列表中按状态筛选，点击详情查看处理记录。",
    ],
    updatedAt: "2026-08-06",
  },
];

export function getHelpCategories(): HelpCategory[] {
  return mockHelpCategories;
}

export function getHelpCategoryById(id: string): HelpCategory | undefined {
  return mockHelpCategories.find((category) => category.id === id);
}

export function getHelpArticleById(id: string): HelpArticle | undefined {
  return mockHelpArticles.find((article) => article.id === id);
}

export function searchHelp(query: string): HelpArticle[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return mockHelpArticles;

  return mockHelpArticles.filter((article) =>
    [article.title, article.summary, article.content.join(" ")].some((field) =>
      field.toLowerCase().includes(keyword),
    ),
  );
}
