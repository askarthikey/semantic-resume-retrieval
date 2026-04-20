import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/upload", label: "Upload" },
  { to: "/search", label: "Search" },
  { to: "/resumes", label: "Resumes" },
];

export function ShellLayout() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,#dbeafe_0%,transparent_30%),radial-gradient(circle_at_80%_10%,#fef3c7_0%,transparent_35%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-600">Recruiter Studio</p>
            <h1 className="text-xl font-semibold text-slate-900">Semantic Resume Retrieval</h1>
          </div>
          <nav className="flex gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
