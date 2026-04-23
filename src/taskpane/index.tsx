import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

declare const Office: any;

Office.onReady(() => {
  const container = document.getElementById("root");
  if (container) {
    createRoot(container).render(<App />);
  }
});
