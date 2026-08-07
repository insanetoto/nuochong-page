import type { Metadata } from "next";
import { HomePage } from "./HomePage";

export const metadata: Metadata = {
  title: "Nuochong Technology | Enterprise Knowledge & Intelligent Training Platform",
  description:
    "An AI-powered enterprise platform for knowledge management, employee training, assessments, and continuous capability growth.",
};

export default function Home() {
  return <HomePage />;
}
