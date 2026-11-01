import type { Metadata } from "next";
import { HomePage } from "./HomePage";

export const metadata: Metadata = {
  title: "Nuochong Technology | AI-Native Enterprise Products",
  description:
    "Explore Enterprise Knowledge Base, Enterprise AI Assistant, and Training & Assessments on a shared DeepSeek Harness foundation. Try the Knowledge Base test release.",
};

export default function Home() {
  return <HomePage />;
}
