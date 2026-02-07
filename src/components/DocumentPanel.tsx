import { Download, Eye } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type DocItem = {
  id: string;
  name: string;
  url: string;
};

export default function DocumentPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);

  const sortedDocs = useMemo(() => {
    return [...docs].sort((a, b) => a.name.localeCompare(b.name));
  }, [docs]);

  const handlePickFiles = () => inputRef.current?.click();

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const newDocs: DocItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      url: URL.createObjectURL(f),
    }));

    setDocs((prev) => [...prev, ...newDocs]);
    e.target.value = "";
  };

  const handleView = (doc: DocItem) => {
    window.open(doc.url, "_blank", "noopener,noreferrer");
  };

  const handleDownload = (doc: DocItem) => {
    const a = document.createElement("a");
    a.href = doc.url;
    a.download = doc.name;
    a.click();
  };

  return (
    // ✅ Outer panel locked
    <div className="ai-panel h-full min-h-0 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">Knowledge Base</div>

        <button className="ai-btn-primary" onClick={handlePickFiles}>
          Upload documents
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilesChosen}
        />
      </div>

      {/* ✅ Only list scrolls */}
      <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
        {sortedDocs.length === 0 ? (
          <div className="text-ai-muted text-sm">No documents uploaded yet.</div>
        ) : (
          sortedDocs.map((doc) => (
            <div
              key={doc.id}
              className="ai-doc-row flex items-center justify-between gap-3"
            >
              <div className="truncate">{doc.name}</div>

              <div className="flex items-center gap-2 shrink-0">
                <button className="ai-icon-btn" onClick={() => handleView(doc)} title="Quick view">
                  <Eye className="h-5 w-5 text-ai-gold" />
                </button>

                <button className="ai-icon-btn" onClick={() => handleDownload(doc)} title="Download">
                  <Download className="h-5 w-5 text-ai-gold" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
