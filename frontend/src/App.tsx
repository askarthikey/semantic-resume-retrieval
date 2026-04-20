import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { ShellLayout } from "./components/ShellLayout";
import { LoginPage } from "./pages/LoginPage";
import { ResumesPage } from "./pages/ResumesPage";
import { SearchPage } from "./pages/SearchPage";
import { UploadPage } from "./pages/UploadPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<ShellLayout />}>
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/resumes" element={<ResumesPage />} />
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
