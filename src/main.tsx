import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { StoreProvider } from "@/lib/store";
import { RitualDetailsProvider } from "@/components/ritual-details";
import "./index.css";

// The service worker only receives the evening reminder (see public/sw.js); the app itself works without it.
if ("serviceWorker" in navigator) window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });

const mq = window.matchMedia("(prefers-color-scheme: dark)");
const applyTheme = () => document.documentElement.classList.toggle("dark", mq.matches);
applyTheme();
mq.addEventListener("change", applyTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider>
      <RitualDetailsProvider>
        <App />
      </RitualDetailsProvider>
    </StoreProvider>
  </React.StrictMode>
);
