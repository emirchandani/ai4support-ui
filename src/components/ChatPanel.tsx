import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: input },
      {
        role: "assistant",
        content: "This is a placeholder AI response.",
      },
    ]);

    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-ai-panel border border-white/10 rounded-xl">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] px-4 py-2 rounded-xl text-sm ${
              msg.role === "user"
                ? "ml-auto bg-ai-gold text-black"
                : "bg-white/10 text-ai-text"
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type your message..."
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none"
        />
        <button
          onClick={sendMessage}
          className="bg-ai-gold text-black px-4 rounded-lg font-medium hover:opacity-90"
        >
          Send
        </button>
      </div>
    </div>
  );
}
