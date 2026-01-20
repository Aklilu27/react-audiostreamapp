import 'whatwg-fetch';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Ensure browser globals expected by some dependencies
if (typeof globalThis.global === 'undefined') {
  globalThis.global = globalThis;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
