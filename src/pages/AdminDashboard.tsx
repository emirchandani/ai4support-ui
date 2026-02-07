import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import ChatPanel from "../components/ChatPanel";

type UploadedDoc = {
  id: string;
  name: string;
  url: string; // blob URL for view/download
};

type Environment = {
  id: string;
  name: string;
  isOpen: boolean;
  docs: UploadedDoc[];
};

// --- Assign users (UI-only) ---
type AssignedUsersMap = { [envId: string]: string[] };
const DEMO_USERS = ["user@gmail.com", "user2@gmail.com", "user3@gmail.com"];

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Sidebar quick-upload input (existing behavior)
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal upload input (Notion upload popup flow)
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  // Which environment is currently receiving sidebar "+" uploads
  const [targetEnvId, setTargetEnvId] = useState<string>("__default__");

  // Default docs + environments
  const [defaultDocs, setDefaultDocs] = useState<UploadedDoc[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);

  // --- Notion upload modal state ---
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSelectedEnvIds, setUploadSelectedEnvIds] = useState<string[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // --- Assign users modal state (UI-only) ---
  const [assignUsersOpen, setAssignUsersOpen] = useState(false);
  const [assignEnvId, setAssignEnvId] = useState<string | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUsersMap>({});
  const [tempSelectedUsers, setTempSelectedUsers] = useState<string[]>([]);

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  // ===== Sidebar upload =====
  const openFilePickerFor = (envId: string) => {
    setTargetEnvId(envId);
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newDocs: UploadedDoc[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
        .toString(16)
        .slice(2)}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    if (targetEnvId === "__default__") {
      setDefaultDocs((prev) => [...prev, ...newDocs]);
    } else {
      setEnvironments((prev) =>
        prev.map((env) =>
          env.id === targetEnvId
            ? { ...env, docs: [...env.docs, ...newDocs] }
            : env
        )
      );
    }

    e.target.value = "";
  };

  // ===== View / Download =====
  const handleView = (doc: UploadedDoc) => {
    window.open(doc.url, "_blank", "noopener,noreferrer");
  };

  const handleDownload = (doc: UploadedDoc) => {
    const a = document.createElement("a");
    a.href = doc.url;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const renderDocRow = (doc: UploadedDoc) => (
    <div
      key={doc.id}
      className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-3 py-3"
    >
      <div className="truncate text-white/90">{doc.name}</div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => handleView(doc)}
          className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
          aria-label="View"
          title="View"
        >
          <span className="text-yellow-500 text-base">👁</span>
        </button>

        <button
          type="button"
          onClick={() => handleDownload(doc)}
          className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
          aria-label="Download"
          title="Download"
        >
          <span className="text-yellow-500 text-base">⬇</span>
        </button>
      </div>
    </div>
  );

  // ===== Environments =====
  const handleAddEnvironment = () => {
    const name = window.prompt("Enter environment name:");
    const trimmed = (name ?? "").trim();
    if (!trimmed) return;

    const newEnv: Environment = {
      id: `env-${trimmed}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmed,
      isOpen: true,
      docs: [],
    };

    setEnvironments((prev) => [newEnv, ...prev]);
  };

  const toggleEnvironment = (envId: string) => {
    setEnvironments((prev) =>
      prev.map((env) =>
        env.id === envId ? { ...env, isOpen: !env.isOpen } : env
      )
    );
  };

  // ============================================================
  // ✅ Upload Documents Popup Flow (modal)
  // ============================================================
  const openUploadModal = () => {
    setUploadOpen(true);
    setUploadSelectedEnvIds([]);
    setUploadFiles([]);
  };

  const closeUploadModal = () => {
    setUploadOpen(false);
    setUploadSelectedEnvIds([]);
    setUploadFiles([]);
  };

  const toggleEnvSelected = (envId: string) => {
    setUploadSelectedEnvIds((prev) =>
      prev.includes(envId) ? prev.filter((x) => x !== envId) : [...prev, envId]
    );
  };

  const pickModalFiles = () => {
    modalFileInputRef.current?.click();
  };

  const onModalFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadFiles(files);
    e.target.value = "";
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const confirmModalUpload = () => {
    if (uploadSelectedEnvIds.length === 0 || uploadFiles.length === 0) return;

    const newDocs: UploadedDoc[] = uploadFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
        .toString(16)
        .slice(2)}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    // Add docs to each selected environment
    setEnvironments((prev) =>
      prev.map((env) =>
        uploadSelectedEnvIds.includes(env.id)
          ? { ...env, docs: [...env.docs, ...newDocs] }
          : env
      )
    );

    // Bottom-right confirmation
    const envNames = environments
      .filter((e) => uploadSelectedEnvIds.includes(e.id))
      .map((e) => e.name);

    const destinationText =
      envNames.length === 1
        ? `"${envNames[0]}"`
        : envNames.length <= 5
        ? envNames.map((n) => `"${n}"`).join(", ")
        : "5+ environments";

    if (uploadFiles.length === 1) {
      showToast(`Uploaded "${uploadFiles[0].name}" to ${destinationText}`);
    } else {
      showToast(`Uploaded ${uploadFiles.length} files to ${destinationText}`);
    }

    closeUploadModal();
  };

  // ============================================================
  // ✅ Assign Users to Environment (UI-only)
  // ============================================================
  const openAssignUsers = (envId: string) => {
    setAssignEnvId(envId);
    setTempSelectedUsers(assignedUsers[envId] ?? []);
    setAssignUsersOpen(true);
  };

  const closeAssignUsers = () => {
    setAssignUsersOpen(false);
    setAssignEnvId(null);
    setTempSelectedUsers([]);
  };

  const toggleUser = (email: string) => {
    setTempSelectedUsers((prev) =>
      prev.includes(email) ? prev.filter((u) => u !== email) : [...prev, email]
    );
  };

  const saveAssignedUsers = () => {
    if (!assignEnvId) return;

    setAssignedUsers((prev) => ({
      ...prev,
      [assignEnvId]: tempSelectedUsers,
    }));

    closeAssignUsers();
  };

  const assignedCountForEnv = (envId: string) => (assignedUsers[envId] ?? []).length;

  return (
    <div className="h-screen bg-[#1c2237] p-6 text-white">
      <div className="h-full rounded-2xl bg-[#222845] p-6 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            Ai4Support <span className="text-yellow-500">Admin</span>
          </h1>

          {/* Match user styling */}
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-yellow-500 hover:underline"
          >
            Logout
          </button>
        </div>

        {/* Content */}
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Knowledge Base */}
          <div className="w-[420px] flex flex-col bg-white/5 rounded-xl p-4 min-h-0">
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="font-semibold leading-9">Knowledge Base</h2>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-95"
                  onClick={openUploadModal}
                >
                  Upload documents
                </button>

                <button
                  type="button"
                  className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold border border-white/10"
                  onClick={handleAddEnvironment}
                >
                  Add environment
                </button>
              </div>

              {/* Hidden sidebar file input (for "+" uploads) */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
            </div>

            {/* Scroll area */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4">
              {/* Default docs */}
              <div className="space-y-3">
                {defaultDocs.length === 0 ? (
                  <div className="text-white/70 text-sm">
                    No documents uploaded yet.
                  </div>
                ) : (
                  defaultDocs.map(renderDocRow)
                )}
              </div>

              {/* Environments */}
              {environments.map((env) => (
                <div key={env.id} className="bg-white/5 rounded-xl px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 min-w-0"
                      onClick={() => toggleEnvironment(env.id)}
                      title={env.isOpen ? "Collapse" : "Expand"}
                    >
                      <span className="text-yellow-500">
                        {env.isOpen ? "▾" : "▸"}
                      </span>
                      <span className="font-medium truncate">{env.name}</span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* 👥 assign users */}
                      <button
                        type="button"
                        onClick={() => openAssignUsers(env.id)}
                        className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                        aria-label="Assign users"
                        title={
                          assignedCountForEnv(env.id) > 0
                            ? `Assign users (${assignedCountForEnv(env.id)} selected)`
                            : "Assign users"
                        }
                      >
                        <span className="text-yellow-500 text-base">👥</span>
                      </button>

                      {/* "+" upload into this environment */}
                      <button
                        type="button"
                        onClick={() => openFilePickerFor(env.id)}
                        className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                        aria-label="Add files"
                        title="Add files"
                      >
                        <span className="text-yellow-500 text-lg font-bold">
                          +
                        </span>
                      </button>
                    </div>
                  </div>

                  {env.isOpen && (
                    <div className="mt-3 space-y-3">
                      {env.docs.length === 0 ? (
                        <div className="text-white/60 text-sm">
                          No documents in this environment.
                        </div>
                      ) : (
                        env.docs.map(renderDocRow)
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 bg-white/5 rounded-xl p-6 min-h-0 overflow-hidden">
            <ChatPanel />
          </div>
        </div>
      </div>

      {/* ✅ Upload Documents Modal */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeUploadModal();
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-[#222845] border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Upload documents</div>
                <div className="text-sm text-white/70 mt-1">
                  Select environments, then choose files.
                </div>
              </div>
              <button
                type="button"
                className="text-white/60 hover:text-white"
                onClick={closeUploadModal}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 max-h-[320px] overflow-y-auto pr-1 space-y-3">
              {environments.length === 0 ? (
                <div className="text-white/70 text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  No environments yet. Click “Add environment” first.
                </div>
              ) : (
                environments.map((env) => (
                  <label
                    key={env.id}
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={uploadSelectedEnvIds.includes(env.id)}
                      onChange={() => toggleEnvSelected(env.id)}
                      className="h-4 w-4 accent-yellow-500"
                    />
                    <span className="text-sm text-white/90 truncate">
                      {env.name}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="text-sm text-white/80">
                Files:{" "}
                <span className="text-white/90">
                  {uploadFiles.length === 0
                    ? "None selected"
                    : `${uploadFiles.length} selected`}
                </span>
              </div>

              <button
                type="button"
                onClick={pickModalFiles}
                className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-95"
              >
                Choose files
              </button>

              <input
                ref={modalFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={onModalFilesSelected}
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold border border-white/10"
                onClick={closeUploadModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={confirmModalUpload}
                disabled={
                  uploadSelectedEnvIds.length === 0 || uploadFiles.length === 0
                }
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Assign Users Modal */}
      {assignUsersOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAssignUsers();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-[#222845] border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Assign users</div>
                <div className="text-sm text-white/70 mt-1">
                  Environment:{" "}
                  <span className="text-white/90">
                    {environments.find((e) => e.id === assignEnvId)?.name ?? ""}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="text-white/60 hover:text-white"
                onClick={closeAssignUsers}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3 max-h-[280px] overflow-y-auto">
              {DEMO_USERS.map((email) => (
                <label
                  key={email}
                  className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={tempSelectedUsers.includes(email)}
                    onChange={() => toggleUser(email)}
                    className="h-4 w-4 accent-yellow-500"
                  />
                  <span className="text-sm text-white/90">{email}</span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold border border-white/10"
                onClick={closeAssignUsers}
              >
                Cancel
              </button>

              <button
                type="button"
                className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-95"
                onClick={saveAssignedUsers}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Bottom-right toast confirmation */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-[#222845] border border-white/10 text-white/90 rounded-xl px-4 py-3 shadow-lg max-w-[360px]">
          <div className="text-sm">{toast}</div>
        </div>
      )}
    </div>
  );
}
