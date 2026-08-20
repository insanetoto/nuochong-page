export type WorkOrderStatus = "pending" | "processing" | "resolved" | "closed";
export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";

export type WorkOrder = {
  id: string;
  title: string;
  description: string;
  applicant: string;
  assignee: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  createdAt: string;
};

export const mockWorkOrders: WorkOrder[] = [
  {
    id: "WO-1001",
    title: "无法登录业务系统",
    description: "登录时提示账号被锁定，需要管理员协助解锁。",
    applicant: "王强",
    assignee: "赵敏",
    priority: "high",
    status: "processing",
    createdAt: "2026-08-20 09:15",
  },
  {
    id: "WO-1002",
    title: "办公软件安装",
    description: "需要安装办公协作软件并配置账号权限。",
    applicant: "张伟",
    assignee: "赵敏",
    priority: "medium",
    status: "closed",
    createdAt: "2026-08-08 10:00",
  },
  {
    id: "WO-1003",
    title: "知识库权限申请",
    description: "申请知识库「产品中心」目录的编辑权限。",
    applicant: "李娜",
    assignee: "诺崇管理员",
    priority: "low",
    status: "pending",
    createdAt: "2026-08-19 16:42",
  },
  {
    id: "WO-1004",
    title: "培训课程无法播放",
    description: "点击课程视频无响应，刷新后仍然无法播放。",
    applicant: "孙悦",
    assignee: "刘洋",
    priority: "urgent",
    status: "processing",
    createdAt: "2026-08-18 14:30",
  },
  {
    id: "WO-1005",
    title: "员工账号信息有误",
    description: "我的部门与岗位信息显示不正确，请协助更新。",
    applicant: "陈杰",
    assignee: "赵敏",
    priority: "medium",
    status: "resolved",
    createdAt: "2026-08-12 11:20",
  },
  {
    id: "WO-1006",
    title: "导出报表失败",
    description: "在控制台导出员工报表时提示服务器错误。",
    applicant: "周涛",
    assignee: "张伟",
    priority: "high",
    status: "pending",
    createdAt: "2026-08-20 08:05",
  },
];

export function listWorkOrders(options?: {
  status?: WorkOrderStatus | "all";
  query?: string;
}): WorkOrder[] {
  const query = options?.query?.trim().toLowerCase() ?? "";

  return mockWorkOrders
    .filter((workOrder) => {
      if (!options?.status || options.status === "all") return true;
      return workOrder.status === options.status;
    })
    .filter((workOrder) => {
      if (!query) return true;
      return [workOrder.id, workOrder.title, workOrder.applicant].some((field) =>
        field.toLowerCase().includes(query),
      );
    });
}

export function getWorkOrderById(id: string): WorkOrder | undefined {
  return mockWorkOrders.find((workOrder) => workOrder.id === id);
}
