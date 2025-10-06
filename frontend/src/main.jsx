// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";// optional — keeps Tailwind/global styles if you’re using them

// Create the root React mount and render the App
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
