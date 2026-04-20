import { Navigate, Route, Routes } from "react-router-dom";

import { ShellLayout } from "./components/ShellLayout";
import { ResumesPage } from "./pages/ResumesPage";
import { SearchPage } from "./pages/SearchPage";
import { UploadPage } from "./pages/UploadPage";

function App() {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/resumes" element={<ResumesPage />} />
        <Route path="*" element={<Navigate to="/upload" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
