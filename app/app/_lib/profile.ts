export type UserProfile = {
  name: string;
  nickname: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  bio: string;
  signature: string;
  avatar: string;
};

export type SecurityQuestion = {
  question: string;
  answer: string;
};

export type SecuritySettings = {
  passwordLastChanged: string;
  phone: string;
  phoneBound: boolean;
  securityQuestions: SecurityQuestion[];
};

export const mockProfile: UserProfile = {
  name: "诺崇管理员",
  nickname: "admin",
  email: "admin@nuochong.work",
  phone: "0871-67200971",
  department: "管理部",
  role: "系统管理员",
  bio: "负责企业知识与智能培训平台的日常运营与内容管理。",
  signature: "让知识成为增长的力量",
  avatar: "preset-1",
};

export const mockSecuritySettings: SecuritySettings = {
  passwordLastChanged: "2026-07-18",
  phone: "138****8000",
  phoneBound: true,
  securityQuestions: [
    { question: "您的出生地是？", answer: "昆明" },
    { question: "您第一份工作的公司是？", answer: "诺崇科技" },
  ],
};
