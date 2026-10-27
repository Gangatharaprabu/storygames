import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@storygames/ui/styles.css";
import "@fontsource-variable/inter";
import "./app.css";
import { App } from "./App.tsx";
import { routeVerticalWheelToPage } from "./scroll.ts";

routeVerticalWheelToPage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
