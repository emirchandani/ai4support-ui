import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import ChatPanel from "../components/ChatPanel";

export default function UserChat() {
  const navigate = useNavigate();

  const logout = () => {
    clearAuth();
    navigate("/", { replace: true });
  };

  return (
    <div className="ai-page-bg p-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Ai4Support <span className="text-ai-gold">User Chat</span>
        </h1>

        <button onClick={logout} className="text-ai-gold hover:opacity-80">
          Logout
        </button>
      </header>

      {/* Full-height workspace panel like Admin (minus upload column) */}
      <div className="ai-panel h-[calc(100vh-120px)] p-4">
        <ChatPanel />
      </div>
    </div>
  );
}
