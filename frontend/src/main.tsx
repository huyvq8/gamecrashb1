import React from "react";
import { createRoot } from "react-dom/client";
import { CrashGame } from "./components/CrashGame";

const rootNode = document.getElementById("root");
if (rootNode) {
  const root = createRoot(rootNode);
  root.render(
    <React.StrictMode>
      <CrashGame />
    </React.StrictMode>
  );
}
