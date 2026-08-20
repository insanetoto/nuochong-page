export type NotificationType =
  | "system"
  | "training"
  | "workorder"
  | "announcement";

export type Notification = {
  id: string;
  title: string;
  content: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
};

export const mockNotifications: Notification[] = [
  {
    id: "n1",
    title: "系统维护通知",
    content:
      "平台将于本周六 02:00–04:00 进行例行维护，维护期间服务可能短暂中断，请提前保存工作内容。",
    type: "system",
    read: false,
    createdAt: "2026-08-20 09:30",
  },
  {
    id: "n2",
    title: "新员工培训计划已发布",
    content:
      "《新员工成长计划》课程已更新，请相关同事在 8 月 31 日前完成第一阶段学习。",
    type: "training",
    read: false,
    createdAt: "2026-08-19 14:12",
  },
  {
    id: "n3",
    title: "工单 #WO-1008 已分配给您",
    content: "该工单涉及「账号权限申请」，请尽快处理并更新处理进度。",
    type: "workorder",
    read: false,
    createdAt: "2026-08-18 11:05",
  },
  {
    id: "n4",
    title: "Q3 全员大会通知",
    content: "本季度全员大会将于 9 月 5 日下午召开，请准时参加。",
    type: "announcement",
    read: true,
    createdAt: "2026-08-15 16:40",
  },
  {
    id: "n5",
    title: "知识库新增 12 篇文档",
    content: "产品中心上传了最新版产品手册与常见问题文档，欢迎查阅。",
    type: "system",
    read: true,
    createdAt: "2026-08-12 10:20",
  },
  {
    id: "n6",
    title: "安全培训完成提醒",
    content: "您尚未完成本季度的信息安全培训，请登录培训中心完成学习。",
    type: "training",
    read: false,
    createdAt: "2026-08-10 08:55",
  },
  {
    id: "n7",
    title: "工单 #WO-1002 已关闭",
    content: "您提交的「办公软件安装」工单已处理完成并关闭。",
    type: "workorder",
    read: true,
    createdAt: "2026-08-08 13:18",
  },
  {
    id: "n8",
    title: "新版培训知识库上线",
    content: "培训知识库已支持按分类浏览与课程进度跟踪，欢迎体验。",
    type: "announcement",
    read: true,
    createdAt: "2026-08-05 09:00",
  },
];

export function listNotifications(options?: {
  type?: "all" | "unread" | "read";
  query?: string;
}): Notification[] {
  const query = options?.query?.trim().toLowerCase() ?? "";

  return mockNotifications
    .filter((notification) => {
      if (options?.type === "unread") return !notification.read;
      if (options?.type === "read") return notification.read;
      return true;
    })
    .filter((notification) => {
      if (!query) return true;
      return [notification.title, notification.content].some((field) =>
        field.toLowerCase().includes(query),
      );
    });
}

export function getNotificationById(
  id: string,
): Notification | undefined {
  return mockNotifications.find((notification) => notification.id === id);
}

export function getNotificationCounts(): {
  all: number;
  unread: number;
  read: number;
} {
  return {
    all: mockNotifications.length,
    unread: mockNotifications.filter((notification) => !notification.read).length,
    read: mockNotifications.filter((notification) => notification.read).length,
  };
}
