import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
