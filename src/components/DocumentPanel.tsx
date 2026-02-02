import { useState } from "react";

export default function DocumentPanel() {
  const [files, setFiles] = useState<File[]>([]);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  return (
    <div className="bg-ai-panel border border-white/10 rounded-xl p-4 flex flex-col h-full">
      <h2 className="font-semibold text-lg mb-3">Knowledge Base</h2>

      <label className="cursor-pointer inline-block">
        <input
          type="file"
          multiple
          className="hidden"
          onChange={onUpload}
        />
        <div className="bg-ai-gold text-black text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 inline-block">
          Upload documents
        </div>
      </label>

      <div className="mt-4 flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <p className="text-sm text-ai-muted">
            No documents uploaded yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li
                key={i}
                className="text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2"
              >
                {file.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
