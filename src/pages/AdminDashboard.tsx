import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import ChatPanel from "../components/ChatPanel";
import DocumentPanel from "../components/DocumentPanel";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const logout = () => {
    clearAuth();
    navigate("/", { replace: true });
  };

  return (
    <div className="ai-page-bg p-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Ai4Support <span className="text-ai-gold">Admin</span>
        </h1>

        <button onClick={logout} className="text-ai-gold hover:opacity-80">
          Logout
        </button>
      </header>

      {/* Full-height workspace panel (matches User page) */}
      <div className="ai-panel h-[calc(100vh-120px)] p-4">
        <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 h-full">
            <DocumentPanel />
          </div>

          <div className="lg:col-span-2 h-full">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
