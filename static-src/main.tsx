import { createRoot } from "react-dom/client";
import { HomePage } from "../app/HomePage";
import "../app/globals.css";
import "./static.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root not found");
}

createRoot(container).render(<HomePage />);
