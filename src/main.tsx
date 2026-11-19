import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { StoreProvider } from "@/lib/store";
import { RitualDetailsProvider } from "@/components/ritual-details";
import "./index.css";

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
