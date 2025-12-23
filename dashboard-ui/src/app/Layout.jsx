import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { Outlet } from "react-router-dom";

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <Topbar />
        <main className="app-content">
          {children ? children : <Outlet />}
        </main>
      </div>
    </div>
  );
}
