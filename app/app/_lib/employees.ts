export type Employee = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  status: "active" | "inactive";
  phone: string;
};

export type EmployeeFormValues = Omit<Employee, "id"> & { id?: string };

export const mockEmployees: Employee[] = [
  {
    id: "e1",
    name: "张伟",
    email: "zhangwei@nuochong.work",
    department: "技术部",
    role: "前端工程师",
    status: "active",
    phone: "13800000001",
  },
  {
    id: "e2",
    name: "李娜",
    email: "lina@nuochong.work",
    department: "产品部",
    role: "产品经理",
    status: "active",
    phone: "13800000002",
  },
  {
    id: "e3",
    name: "王强",
    email: "wangqiang@nuochong.work",
    department: "技术部",
    role: "后端工程师",
    status: "active",
    phone: "13800000003",
  },
  {
    id: "e4",
    name: "赵敏",
    email: "zhaomin@nuochong.work",
    department: "人力资源部",
    role: "HR 专员",
    status: "active",
    phone: "13800000004",
  },
  {
    id: "e5",
    name: "陈杰",
    email: "chenjie@nuochong.work",
    department: "市场部",
    role: "市场经理",
    status: "inactive",
    phone: "13800000005",
  },
  {
    id: "e6",
    name: "刘洋",
    email: "liuyang@nuochong.work",
    department: "培训部",
    role: "培训讲师",
    status: "active",
    phone: "13800000006",
  },
  {
    id: "e7",
    name: "孙悦",
    email: "sunyue@nuochong.work",
    department: "财务部",
    role: "会计",
    status: "active",
    phone: "13800000007",
  },
  {
    id: "e8",
    name: "周涛",
    email: "zhoutao@nuochong.work",
    department: "销售部",
    role: "销售总监",
    status: "inactive",
    phone: "13800000008",
  },
];
