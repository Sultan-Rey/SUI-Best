import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { MobileViewport } from "./components/MobileViewport";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MobileViewport>
      <App />
    </MobileViewport>
  </React.StrictMode>
);
