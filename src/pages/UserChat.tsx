import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import ChatPanel from "../components/ChatPanel";

export default function UserChat() {
  const navigate = useNavigate();

  const logout = () => {
    clearAuth();
    navigate("/");
  };

  return (
    <div className="h-screen flex flex-col bg-ai-bg text-ai-text">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-lg font-semibold">
          Ai4Support <span className="text-ai-gold">User</span>
        </h1>
        <button
          onClick={logout}
          className="text-sm text-ai-gold hover:underline"
        >
          Logout
        </button>
      </header>

      {/* Chat only */}
      <main className="flex-1 p-4 overflow-hidden">
        <div className="h-full rounded-xl bg-ai-panel p-4 overflow-hidden">
          <ChatPanel />
        </div>
      </main>
    </div>
  );
}
