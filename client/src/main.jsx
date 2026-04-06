import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// React.StrictMode is intentionally omitted:
// PixiJS creates a WebGL context on mount and destroys it on unmount.
// StrictMode's double-mount in dev would destroy the context on the first
// unmount, leaving a blank canvas. This is a known PixiJS + StrictMode issue.
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
