import { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "system" | "user";
  text: string;
};

type Props = {
  title?: string;
  showLogout?: boolean;
  onLogout?: () => void;
};

export default function ChatPanel({
  title = "Chat",
  showLogout = false,
  onLogout,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m0",
      role: "system",
      text: "Hi! How can I help you today?",
    },
  ]);
  const [draft, setDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => draft.trim().length > 0, [draft]);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: messages.length <= 1 ? "auto" : "smooth",
    });
  }, [messages.length]);

  const send = () => {
    if (!canSend) return;

    const text = draft.trim();
    setDraft("");

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text },
    ]);

    // UI-only fake assistant response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `s-${Date.now()}`,
          role: "system",
          text: "Thanks — noted. (UI-only prototype)",
        },
      ]);
    }, 250);
  };

  return (
    <div className="ai-card h-full w-full p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-lg font-semibold">{title}</div>

        {showLogout && (
          <button
            onClick={onLogout}
            className="text-ai-gold text-sm hover:opacity-90"
          >
            Logout
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-ai-panel/40 p-4">
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="w-full flex">
              <div
                className={[
                  "max-w-[90%] rounded-xl px-4 py-3 text-sm",
                  m.role === "user"
                    ? "bg-ai-gold text-black"
                    : "bg-ai-panel border border-white/10 text-ai-text",
                ].join(" ")}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="mt-4 flex items-center gap-3">
        <input
          className="ai-input flex-1"
          placeholder="Type your message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          className="ai-btn-primary"
          onClick={send}
          disabled={!canSend}
        >
          Send
        </button>
      </div>
    </div>
  );
}
