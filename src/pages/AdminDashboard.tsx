import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import ChatPanel from "../components/ChatPanel";

type UploadedDoc = {
  id: string;
  name: string;
  url: string; // blob URL for view/download
};

type FSNode =
  | {
      id: string; // unique per env root
      type: "folder";
      name: string;
      isOpen: boolean;
      children: FSNode[];
    }
  | {
      id: string; // unique per env root
      type: "file";
      name: string;
      url: string;
    };

type Environment = {
  id: string;
  name: string;
  isOpen: boolean;
  color: string;
  assignedUsers: string[];
  children: Environment[]; // nested environments (your existing feature)
  items: FSNode[]; // ✅ VSCode-like file tree INSIDE an environment
};

const ENV_COLORS = [
  "#F87171", // red
  "#FBBF24", // amber
  "#34D399", // emerald
  "#60A5FA", // blue
  "#A78BFA", // violet
  "#22D3EE", // cyan
  "#FB7185", // rose
  "#F97316", // orange
  "#84CC16", // lime
];

function makeDocId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function pickNextColor(used: Set<string>) {
  for (const c of ENV_COLORS) if (!used.has(c)) return c;
  return ENV_COLORS[used.size % ENV_COLORS.length];
}

function collectUsedColors(envs: Environment[], out: Set<string>) {
  for (const e of envs) {
    out.add(e.color);
    if (e.children.length) collectUsedColors(e.children, out);
  }
}

function findEnvById(envs: Environment[], envId: string): Environment | null {
  for (const env of envs) {
    if (env.id === envId) return env;
    const child = findEnvById(env.children, envId);
    if (child) return child;
  }
  return null;
}

function updateEnvTree(
  envs: Environment[],
  envId: string,
  updater: (env: Environment) => Environment
): Environment[] {
  return envs.map((env) => {
    if (env.id === envId) return updater(env);
    if (env.children.length === 0) return env;
    return { ...env, children: updateEnvTree(env.children, envId, updater) };
  });
}

function flattenEnvNodes(
  envs: Environment[],
  depth = 0
): Array<{ env: Environment; depth: number }> {
  const out: Array<{ env: Environment; depth: number }> = [];
  for (const env of envs) {
    out.push({ env, depth });
    if (env.children.length > 0) out.push(...flattenEnvNodes(env.children, depth + 1));
  }
  return out;
}

// ---------- File Tree Helpers (inside an environment) ----------

function cloneNodes(nodes: FSNode[]): FSNode[] {
  return nodes.map((n) =>
    n.type === "file"
      ? { ...n }
      : { ...n, children: cloneNodes(n.children) }
  );
}

function sortNodes(nodes: FSNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1; // folders first
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  for (const n of nodes) if (n.type === "folder") sortNodes(n.children);
}

function findOrCreateFolder(parent: FSNode[], folderName: string, folderId: string) {
  let existing = parent.find(
    (n) => n.type === "folder" && n.name === folderName
  ) as FSNode | undefined;

  if (!existing) {
    existing = {
      id: folderId,
      type: "folder",
      name: folderName,
      isOpen: true,
      children: [],
    };
    parent.push(existing);
  }
  return existing as Extract<FSNode, { type: "folder" }>;
}

/**
 * Merge folder upload files into an env's FSNode tree WITHOUT creating environments.
 * Uses webkitRelativePath (e.g., "Cisc 101/A2 q1.py").
 */
function mergeFolderFilesIntoTree(existing: FSNode[], files: File[]) {
  const root = cloneNodes(existing);

  for (const file of files) {
    const rel =
      (file as any).webkitRelativePath ||
      // fallback: treat as root file
      file.name;

    const parts = String(rel).split("/").filter(Boolean);
    if (parts.length === 0) continue;

    const fileName = parts[parts.length - 1];
    const folderParts = parts.slice(0, -1);

    let cursor = root;

    // build folders
    let pathAccum = "";
    for (const folder of folderParts) {
      pathAccum = pathAccum ? `${pathAccum}/${folder}` : folder;
      const folderId = `folder:${pathAccum}`;
      const folderNode = findOrCreateFolder(cursor, folder, folderId);
      cursor = folderNode.children;
    }

    // add/replace file node (avoid duplicates by id)
    const fileId = `file:${rel}`;
    const existingIdx = cursor.findIndex((n) => n.id === fileId);
    const newNode: FSNode = {
      id: fileId,
      type: "file",
      name: fileName,
      url: URL.createObjectURL(file),
    };

    if (existingIdx >= 0) cursor[existingIdx] = newNode;
    else cursor.push(newNode);
  }

  sortNodes(root);
  return root;
}

/** Add plain files to env root (not folder upload) */
function addFilesToRoot(existing: FSNode[], files: File[]) {
  const root = cloneNodes(existing);

  for (const file of files) {
    const fileId = `file:${file.name}:${file.size}:${file.lastModified}`;
    root.push({
      id: fileId,
      type: "file",
      name: file.name,
      url: URL.createObjectURL(file),
    });
  }

  sortNodes(root);
  return root;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  // "+" and per-env upload-file buttons (plain files)
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // per-env upload-folder buttons (folder structure)
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Modal upload input (Notion flow: multi-env file upload)
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  // Assign users modal input
  const assignInputRef = useRef<HTMLInputElement | null>(null);

  // Which environment is currently receiving uploads from sidebar buttons
  const [targetEnvId, setTargetEnvId] = useState<string>("__default__");

  // Default docs (top bucket stays as-is)
  const [defaultDocs, setDefaultDocs] = useState<UploadedDoc[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);

  // Upload modal state (Notion)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSelectedEnvIds, setUploadSelectedEnvIds] = useState<string[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // Assign users modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEnvId, setAssignEnvId] = useState<string | null>(null);
  const [assignUsersDraft, setAssignUsersDraft] = useState<string>("");

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  // ===== Sidebar: open pickers =====
  const openFilePickerFor = (envId: string) => {
    setTargetEnvId(envId);
    fileInputRef.current?.click();
  };

  const openFolderPickerFor = (envId: string) => {
    setTargetEnvId(envId);
    folderInputRef.current?.click();
  };

  // ===== Plain file uploads (adds files at env root; DOES NOT create envs) =====
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (targetEnvId === "__default__") {
      const newDocs: UploadedDoc[] = files.map((file) => ({
        id: makeDocId(file),
        name: file.name,
        url: URL.createObjectURL(file),
      }));
      setDefaultDocs((prev) => [...prev, ...newDocs]);
    } else {
      setEnvironments((prev) =>
        updateEnvTree(prev, targetEnvId, (env) => ({
          ...env,
          items: addFilesToRoot(env.items, files),
        }))
      );
    }

    e.target.value = "";
  };

  // ===== Folder uploads (renders correct file structure inside env; DOES NOT create envs) =====
  const handleFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (targetEnvId !== "__default__") {
      setEnvironments((prev) =>
        updateEnvTree(prev, targetEnvId, (env) => ({
          ...env,
          isOpen: true,
          items: mergeFolderFilesIntoTree(env.items, files),
        }))
      );
    }

    e.target.value = "";
  };

  // ===== View / Download =====
  const handleView = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownload = (name: string, url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const renderDefaultDocRow = (doc: UploadedDoc) => (
    <div
      key={doc.id}
      className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-3 py-3"
    >
      <div className="truncate text-white/90">{doc.name}</div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => handleView(doc.url)}
          className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
          aria-label="View"
          title="View"
        >
          <span className="text-yellow-500 text-base">👁</span>
        </button>

        <button
          type="button"
          onClick={() => handleDownload(doc.name, doc.url)}
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
  const usedColors = useMemo(() => {
    const used = new Set<string>();
    collectUsedColors(environments, used);
    return used;
  }, [environments]);

  const handleAddEnvironment = () => {
    const name = window.prompt("Enter environment name:");
    const trimmed = (name ?? "").trim();
    if (!trimmed) return;

    const color = pickNextColor(usedColors);

    const newEnv: Environment = {
      id: `env-${trimmed}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmed,
      isOpen: true,
      color,
      assignedUsers: [],
      children: [],
      items: [],
    };

    setEnvironments((prev) => [newEnv, ...prev]);
  };

  const handleAddChildEnvironment = (parentEnvId: string) => {
    const name = window.prompt("Enter sub-environment name:");
    const trimmed = (name ?? "").trim();
    if (!trimmed) return;

    const allUsed = new Set<string>();
    collectUsedColors(environments, allUsed);
    const color = pickNextColor(allUsed);

    const newChild: Environment = {
      id: `env-${trimmed}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmed,
      isOpen: true,
      color,
      assignedUsers: [],
      children: [],
      items: [],
    };

    setEnvironments((prev) =>
      updateEnvTree(prev, parentEnvId, (env) => ({
        ...env,
        isOpen: true,
        children: [newChild, ...env.children],
      }))
    );
  };

  const toggleEnvironment = (envId: string) => {
    setEnvironments((prev) =>
      updateEnvTree(prev, envId, (env) => ({ ...env, isOpen: !env.isOpen }))
    );
  };

  // ===== Upload Documents Modal (Notion) =====
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

    setEnvironments((prev) => {
      let updated = prev;
      for (const envId of uploadSelectedEnvIds) {
        updated = updateEnvTree(updated, envId, (env) => ({
          ...env,
          items: addFilesToRoot(env.items, uploadFiles),
        }));
      }
      return updated;
    });

    const envNames = uploadSelectedEnvIds
      .map((id) => findEnvById(environments, id)?.name)
      .filter(Boolean) as string[];

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

  // ===== Assign Users =====
  const handleAssignUsers = (envId: string) => {
    const env = findEnvById(environments, envId);
    setAssignEnvId(envId);
    setAssignUsersDraft((env?.assignedUsers ?? []).join(", "));
    setAssignOpen(true);
    setTimeout(() => assignInputRef.current?.focus(), 0);
  };

  const closeAssignModal = () => {
    setAssignOpen(false);
    setAssignEnvId(null);
    setAssignUsersDraft("");
  };

  const confirmAssignUsers = () => {
    if (!assignEnvId) return;

    const parsed = assignUsersDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const unique = Array.from(new Set(parsed));

    setEnvironments((prev) =>
      updateEnvTree(prev, assignEnvId, (env) => ({
        ...env,
        assignedUsers: unique,
      }))
    );

    const envName = findEnvById(environments, assignEnvId)?.name ?? "environment";
    showToast(`Assigned users updated for "${envName}"`);
    closeAssignModal();
  };

  // ===== FS Tree Rendering (VSCode-like) =====

  const toggleFolderInEnv = (envId: string, folderId: string) => {
    const toggleInNodes = (nodes: FSNode[]): FSNode[] =>
      nodes.map((n) => {
        if (n.type === "folder") {
          if (n.id === folderId) return { ...n, isOpen: !n.isOpen };
          return { ...n, children: toggleInNodes(n.children) };
        }
        return n;
      });

    setEnvironments((prev) =>
      updateEnvTree(prev, envId, (env) => ({
        ...env,
        items: toggleInNodes(env.items),
      }))
    );
  };

  const renderFSNode = (envId: string, node: FSNode, depth: number) => {
    const indent = Math.min(depth * 18, 180);

    if (node.type === "folder") {
      return (
        <div key={node.id} className="space-y-2">
          <button
            type="button"
            className="w-full flex items-center gap-2 text-left text-white/90 hover:bg-white/5 rounded-lg px-2 py-2"
            style={{ paddingLeft: 10 + indent }}
            onClick={() => toggleFolderInEnv(envId, node.id)}
            title={node.isOpen ? "Collapse" : "Expand"}
          >
            <span className="text-yellow-500">{node.isOpen ? "▾" : "▸"}</span>
            <span className="text-yellow-400">📁</span>
            <span className="truncate">{node.name}</span>
          </button>

          {node.isOpen && (
            <div className="space-y-2">
              {node.children.length === 0 ? (
                <div
                  className="text-white/50 text-sm px-2 py-1"
                  style={{ paddingLeft: 34 + indent }}
                >
                  Empty
                </div>
              ) : (
                node.children.map((c) => renderFSNode(envId, c, depth + 1))
              )}
            </div>
          )}
        </div>
      );
    }

    // file
    return (
      <div
        key={node.id}
        className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-3 py-3"
        style={{ marginLeft: 10 + indent }}
      >
        <div className="truncate text-white/90 flex items-center gap-2">
          <span className="text-white/70">📄</span>
          <span className="truncate">{node.name}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleView(node.url)}
            className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            aria-label="View"
            title="View"
          >
            <span className="text-yellow-500 text-base">👁</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownload(node.name, node.url)}
            className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            aria-label="Download"
            title="Download"
          >
            <span className="text-yellow-500 text-base">⬇</span>
          </button>
        </div>
      </div>
    );
  };

  // Environment tree rendering (env rows stay same size; indentation is internal)
  const renderEnvironmentTree = (env: Environment, depth: number) => {
    const indent = Math.min(depth * 18, 180);

    return (
      <div key={env.id} className="space-y-3">
        <div
          className="w-full bg-white/5 rounded-xl px-3 py-3 relative"
          style={{ borderLeft: `4px solid ${env.color}` }}
        >
          {depth > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-white/10"
              style={{ left: 10 + indent }}
            />
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="flex items-center gap-2 min-w-0"
              onClick={() => toggleEnvironment(env.id)}
              title={env.isOpen ? "Collapse" : "Expand"}
              style={{ paddingLeft: indent }}
            >
              <span className="text-yellow-500">{env.isOpen ? "▾" : "▸"}</span>
              <span className="font-medium truncate">{env.name}</span>

              {env.assignedUsers.length > 0 && (
                <span className="ml-2 text-xs text-white/60 truncate">
                  ({env.assignedUsers.length} assigned)
                </span>
              )}
            </button>

            {/* ✅ PM-requested: include SAME "upload folder" button on each environment bar */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleAssignUsers(env.id)}
                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                aria-label="Assign users"
                title="Assign users"
              >
                <span className="text-[#A78BFA] text-base">👥</span>
              </button>

              {/* Upload folder (folder structure) */}
              <button
                type="button"
                onClick={() => openFolderPickerFor(env.id)}
                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                aria-label="Upload folder"
                title="Upload folder"
              >
                <span className="text-yellow-400 text-lg">📁</span>
              </button>

              {/* Add nested environment */}
              <button
                type="button"
                onClick={() => handleAddChildEnvironment(env.id)}
                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                aria-label="Add nested environment"
                title="Add nested environment"
              >
                <span className="text-yellow-500 text-lg font-bold">⤴</span>
              </button>

              {/* Add files (plain files) */}
              <button
                type="button"
                onClick={() => openFilePickerFor(env.id)}
                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                aria-label="Add files"
                title="Add files"
              >
                <span className="text-yellow-500 text-lg font-bold">+</span>
              </button>
            </div>
          </div>

          {env.isOpen && (
            <div className="mt-3 space-y-3">
              {/* Environments FIRST */}
              {env.children.length > 0 && (
                <div className="space-y-3">
                  {env.children.map((child) => renderEnvironmentTree(child, depth + 1))}
                </div>
              )}

              {/* Files/Folders SECOND (VSCode-like tree) */}
              {env.items.length === 0 ? (
                <div className="text-white/60 text-sm" style={{ paddingLeft: indent }}>
                  Empty
                </div>
              ) : (
                <div className="space-y-2" style={{ paddingLeft: indent }}>
                  {env.items.map((n) => renderFSNode(env.id, n, 0))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const modalFlattened = useMemo(() => flattenEnvNodes(environments), [environments]);

  return (
    <div className="h-screen bg-[#1c2237] p-6 text-white">
      <div className="h-full rounded-2xl bg-[#222845] p-6 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            Ai4Support <span className="text-yellow-500">Admin</span>
          </h1>

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

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />

              {/* @ts-expect-error - webkitdirectory is a non-standard input attribute (works in Chromium) */}
              <input
                ref={folderInputRef}
                type="file"
                multiple
                webkitdirectory="true"
                className="hidden"
                onChange={handleFolderSelected}
              />
            </div>

            {/* Scroll area */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4">
              {/* Default docs */}
              <div className="space-y-3">
                {defaultDocs.length === 0 ? (
                  <div className="text-white/70 text-sm">No documents uploaded yet.</div>
                ) : (
                  defaultDocs.map(renderDefaultDocRow)
                )}
              </div>

              {/* Environments */}
              {environments.map((env) => renderEnvironmentTree(env, 0))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 bg-white/5 rounded-xl p-6 min-h-0 overflow-hidden">
            <ChatPanel />
          </div>
        </div>
      </div>

      {/* Upload Documents Modal */}
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
                modalFlattened.map(({ env, depth }) => (
                  <label
                    key={env.id}
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 cursor-pointer"
                    style={{ paddingLeft: 16 + Math.min(depth * 14, 140) }}
                  >
                    <input
                      type="checkbox"
                      checked={uploadSelectedEnvIds.includes(env.id)}
                      onChange={() => toggleEnvSelected(env.id)}
                      className="h-4 w-4 accent-yellow-500"
                    />
                    <span className="text-sm text-white/90 truncate">{env.name}</span>
                  </label>
                ))
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="text-sm text-white/80">
                Files:{" "}
                <span className="text-white/90">
                  {uploadFiles.length === 0 ? "None selected" : `${uploadFiles.length} selected`}
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
                disabled={uploadSelectedEnvIds.length === 0 || uploadFiles.length === 0}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Users Modal */}
      {assignOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAssignModal();
          }}
        >
          <div className="w-full max-w-xl rounded-2xl bg-[#222845] border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Assign users</div>
                <div className="text-sm text-white/70 mt-1">
                  Enter users separated by commas.
                </div>
              </div>
              <button
                type="button"
                className="text-white/60 hover:text-white"
                onClick={closeAssignModal}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5">
              <input
                ref={assignInputRef}
                value={assignUsersDraft}
                onChange={(e) => setAssignUsersDraft(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-yellow-500/60"
                placeholder="e.g., alice, bob, carol"
              />
              <div className="mt-2 text-xs text-white/60">
                This is UI-only; no backend persistence yet.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold border border-white/10"
                onClick={closeAssignModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-95"
                onClick={confirmAssignUsers}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-[#222845] border border-white/10 text-white/90 rounded-xl px-4 py-3 shadow-lg max-w-[360px]">
          <div className="text-sm">{toast}</div>
        </div>
      )}
    </div>
  );
}