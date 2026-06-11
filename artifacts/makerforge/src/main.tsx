import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Wire API base URL — on web, requests go to the same origin via /api
// The BASE_URL is e.g. "/" so we just call the relative /api path
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
setBaseUrl(`${base}/api`);

createRoot(document.getElementById("root")!).render(<App />);
