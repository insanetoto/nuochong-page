export type TrainingStatus = "not-started" | "in-progress" | "completed";

export type TrainingCourse = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: TrainingStatus;
  progress: number;
  lessons: number;
  instructor: string;
  updatedAt: string;
};

export const mockTrainingCourses: TrainingCourse[] = [
  {
    id: "t1",
    title: "新员工成长计划",
    description: "帮助新员工快速了解企业文化、业务流程与岗位职责。",
    category: "入职培训",
    status: "in-progress",
    progress: 62,
    lessons: 12,
    instructor: "刘洋",
    updatedAt: "2026-08-19",
  },
  {
    id: "t2",
    title: "用 AI 更高效地工作",
    description: "掌握 AI 助手在日常办公中的实用技巧。",
    category: "技能提升",
    status: "not-started",
    progress: 0,
    lessons: 8,
    instructor: "张伟",
    updatedAt: "2026-08-17",
  },
  {
    id: "t3",
    title: "信息安全意识培训",
    description: "学习企业信息安全规范与常见风险防范。",
    category: "合规培训",
    status: "in-progress",
    progress: 35,
    lessons: 6,
    instructor: "陈杰",
    updatedAt: "2026-08-15",
  },
  {
    id: "t4",
    title: "产品知识精讲",
    description: "深入理解企业知识与智能培训平台的产品能力。",
    category: "产品培训",
    status: "completed",
    progress: 100,
    lessons: 10,
    instructor: "李娜",
    updatedAt: "2026-08-10",
  },
  {
    id: "t5",
    title: "管理力提升工作坊",
    description: "面向管理者的人才发展与团队协作方法。",
    category: "领导力",
    status: "not-started",
    progress: 0,
    lessons: 9,
    instructor: "周涛",
    updatedAt: "2026-08-05",
  },
  {
    id: "t6",
    title: "数据分析入门",
    description: "使用数据驱动决策的基础方法与工具。",
    category: "技能提升",
    status: "completed",
    progress: 100,
    lessons: 7,
    instructor: "孙悦",
    updatedAt: "2026-07-28",
  },
];

export function listTrainingCourses(options?: {
  category?: string;
  status?: TrainingStatus;
  query?: string;
}): TrainingCourse[] {
  const query = options?.query?.trim().toLowerCase() ?? "";

  return mockTrainingCourses
    .filter((course) => {
      if (!options?.category || options.category === "all") return true;
      return course.category === options.category;
    })
    .filter((course) => {
      if (!options?.status) return true;
      return course.status === options.status;
    })
    .filter((course) => {
      if (!query) return true;
      return [course.title, course.category, course.instructor].some((field) =>
        field.toLowerCase().includes(query),
      );
    });
}

export function getTrainingCourseById(
  id: string,
): TrainingCourse | undefined {
  return mockTrainingCourses.find((course) => course.id === id);
}

export function getTrainingCategories(): string[] {
  return Array.from(
    new Set(mockTrainingCourses.map((course) => course.category)),
  );
}
