import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./app/Layout.jsx";

import Overview from "./pages/Overview.jsx";
import Analytics from "./pages/Analytics.jsx";
import LiveChat from "./pages/LiveChat.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/live-chat" element={<LiveChat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
