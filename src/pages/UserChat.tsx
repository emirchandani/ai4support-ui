import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import ChatPanel from "../components/ChatPanel";

export default function UserChat() {
  const navigate = useNavigate();
  const [multiHopEnabled, setMultiHopEnabled] = useState(false);

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

        <div className="flex items-center gap-4">
          {/* Multi-hop toggle */}
          <button
            type="button"
            onClick={() => setMultiHopEnabled((prev) => !prev)}
            aria-pressed={multiHopEnabled}
            title={multiHopEnabled ? "Disable multi-hop" : "Enable multi-hop"}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              multiHopEnabled
                ? "border-ai-gold bg-ai-gold text-black"
                : "border-white/10 bg-white/5 text-ai-text hover:bg-white/10"
            }`}
          >
            <span>Multi-hop</span>
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                multiHopEnabled ? "bg-black" : "bg-ai-gold"
              }`}
            />
          </button>

          <button
            onClick={logout}
            className="text-sm text-ai-gold hover:underline"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Chat only */}
      <main className="flex-1 p-4 overflow-hidden">
        <div className="h-full rounded-xl bg-ai-panel p-4 overflow-hidden">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="text-sm text-white/70">
              Demo mode
            </div>
            <div className="text-sm">
              <span className="text-white/60 mr-2">Multi-hop:</span>
              <span className={multiHopEnabled ? "text-ai-gold" : "text-white/70"}>
                {multiHopEnabled ? "On" : "Off"}
              </span>
            </div>
          </div>

          <ChatPanel />
        </div>
      </main>
    </div>
  );
}