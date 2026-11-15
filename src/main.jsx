import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { keepData } from "./storage.js";
import "@fontsource/outfit/300.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "./index.css";

createRoot(document.getElementById("root")).render(<App />);

keepData();

/* offline support and install-to-home-screen (production builds only) */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* app still works online without it */ });
  });
}
