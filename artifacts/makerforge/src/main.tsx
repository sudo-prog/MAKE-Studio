import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
setBaseUrl(`${base}/api`);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
