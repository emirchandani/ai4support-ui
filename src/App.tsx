export default function App() {
  return (
    <div className="min-h-screen bg-ai-bg text-ai-text flex items-center justify-center">
      <div className="bg-ai-panel rounded-2xl p-10 border border-white/10 shadow-lg max-w-xl w-full">
        <h1 className="text-4xl font-bold">
          Ai4Support <span className="text-ai-gold">UI</span>
        </h1>

        <p className="text-ai-muted mt-3">
          Tailwind is installed and the Ai4Support theme is active.
        </p>

        <button className="mt-6 bg-ai-gold text-black font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition">
          Continue
        </button>
      </div>
    </div>
  );
}
