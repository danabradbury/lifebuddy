import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import { App } from "./App";

const container = document.getElementById("app") as HTMLElement;

ReactDOM.createRoot(container).render(
  React.createElement(React.StrictMode, null, React.createElement(App, null)),
);
