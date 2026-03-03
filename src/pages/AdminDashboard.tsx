import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import ChatPanel from "../components/ChatPanel";

type UploadedDoc = {
  id: string;
  name: string;
  url: string;
};

type FSNode =
  | {
      id: string;
      type: "folder";
      name: string;
      isOpen: boolean;
      children: FSNode[];
    }
  | {
      id: string;
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
  children: Environment[];
  items: FSNode[];
};

const ENV_COLORS = [
  "#F87171",
  "#FBBF24",
  "#34D399",
  "#60A5FA",
  "#A78BFA",
  "#22D3EE",
  "#FB7185",
  "#F97316",
  "#84CC16",
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

function flattenVisibleEnvRows(
  envs: Environment[],
  depth = 0
): Array<{ env: Environment; depth: number }> {
  const out: Array<{ env: Environment; depth: number }> = [];
  for (const env of envs) {
    out.push({ env, depth });
    if (env.isOpen && env.children.length) {
      out.push(...flattenVisibleEnvRows(env.children, depth + 1));
    }
  }
  return out;
}

function getMaxDepth(envs: Environment[], depth = 0): number {
  let max = depth;
  for (const e of envs) {
    max = Math.max(max, depth);
    if (e.children.length) max = Math.max(max, getMaxDepth(e.children, depth + 1));
  }
  return max;
}

// ---------- File Tree Helpers ----------

function cloneNodes(nodes: FSNode[]): FSNode[] {
  return nodes.map((n) =>
    n.type === "file" ? { ...n } : { ...n, children: cloneNodes(n.children) }
  );
}

function sortNodes(nodes: FSNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
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

function mergeFolderFilesIntoTree(existing: FSNode[], files: File[]) {
  const root = cloneNodes(existing);

  for (const file of files) {
    const rel = (file as any).webkitRelativePath || file.name;
    const parts = String(rel).split("/").filter(Boolean);
    if (parts.length === 0) continue;

    const fileName = parts[parts.length - 1];
    const folderParts = parts.slice(0, -1);

    let cursor = root;
    let pathAccum = "";

    for (const folder of folderParts) {
      pathAccum = pathAccum ? `${pathAccum}/${folder}` : folder;
      const folderId = `folder:${pathAccum}`;
      const folderNode = findOrCreateFolder(cursor, folder, folderId);
      cursor = folderNode.children;
    }

    const fileId = `file:${rel}`;
    const existingIdx = cursor.findIndex((n) => n.id === fileId);

    if (existingIdx >= 0) {
      const prev = cursor[existingIdx];
      if (prev.type === "file") {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {}
      }
    }

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

function collectUrls(nodes: FSNode[]): string[] {
  const urls: string[] = [];
  const walk = (ns: FSNode[]) => {
    for (const n of ns) {
      if (n.type === "file") urls.push(n.url);
      else walk(n.children);
    }
  };
  walk(nodes);
  return urls;
}

function removeNodeById(
  nodes: FSNode[],
  nodeId: string
): { next: FSNode[]; removedUrls: string[] } {
  const removedUrls: string[] = [];

  const rec = (list: FSNode[]): FSNode[] => {
    const out: FSNode[] = [];
    for (const n of list) {
      if (n.id === nodeId) {
        if (n.type === "file") removedUrls.push(n.url);
        else removedUrls.push(...collectUrls(n.children));
        continue;
      }
      if (n.type === "folder") out.push({ ...n, children: rec(n.children) });
      else out.push(n);
    }
    return out;
  };

  return { next: rec(nodes), removedUrls };
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const modalFileInputRef = useRef<HTMLInputElement | null>(null);
  const modalFolderInputRef = useRef<HTMLInputElement | null>(null);

  const assignInputRef = useRef<HTMLInputElement | null>(null);

  const [targetEnvId, setTargetEnvId] = useState<string>("__default__");

  const [defaultDocs, setDefaultDocs] = useState<UploadedDoc[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSelectedEnvIds, setUploadSelectedEnvIds] = useState<string[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadIsFolder, setUploadIsFolder] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEnvId, setAssignEnvId] = useState<string | null>(null);
  const [assignUsersDraft, setAssignUsersDraft] = useState<string>("");

  // ===== Resizable Sidebar =====
  const DEFAULT_SIDEBAR = 420;
  const MIN_SIDEBAR = 300;
  const MAX_SIDEBAR = 720;

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(window.localStorage.getItem("admin.sidebarWidth"));
    return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_SIDEBAR;
  });

  const dragStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startWidth: number;
  }>({ dragging: false, startX: 0, startWidth: sidebarWidth });

  useEffect(() => {
    window.localStorage.setItem("admin.sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragStateRef.current.dragging) return;
      const dx = e.clientX - dragStateRef.current.startX;
      const next = Math.max(
        MIN_SIDEBAR,
        Math.min(MAX_SIDEBAR, dragStateRef.current.startWidth + dx)
      );
      setSidebarWidth(next);
    };

    const onUp = () => {
      if (!dragStateRef.current.dragging) return;
      dragStateRef.current.dragging = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startResize = (e: React.MouseEvent) => {
    dragStateRef.current = { dragging: true, startX: e.clientX, startWidth: sidebarWidth };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const confirmRemove = (label: string) => {
    return window.confirm(`Remove "${label}"? This cannot be undone.`);
  };

  // ===== Sidebar pickers =====
  const openFilePickerFor = (envId: string) => {
    setTargetEnvId(envId);
    fileInputRef.current?.click();
  };

  const openFolderPickerFor = (envId: string) => {
    setTargetEnvId(envId);
    folderInputRef.current?.click();
  };

  // ===== Upload handlers =====
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

  // ===== Deletes =====
  const removeDefaultDoc = (doc: UploadedDoc) => {
    if (!confirmRemove(doc.name)) return;
    try {
      URL.revokeObjectURL(doc.url);
    } catch {}
    setDefaultDocs((prev) => prev.filter((d) => d.id !== doc.id));
    showToast(`Removed "${doc.name}"`);
  };

  const removeFSNodeFromEnv = (envId: string, node: FSNode) => {
    const label = node.type === "folder" ? `${node.name} (folder)` : node.name;
    if (!confirmRemove(label)) return;

    setEnvironments((prev) =>
      updateEnvTree(prev, envId, (env) => {
        const { next, removedUrls } = removeNodeById(env.items, node.id);
        for (const u of removedUrls) {
          try {
            URL.revokeObjectURL(u);
          } catch {}
        }
        return { ...env, items: next };
      })
    );

    showToast(`Removed "${node.name}"`);
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

        <button
          type="button"
          onClick={() => removeDefaultDoc(doc)}
          className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
          aria-label="Remove"
          title="Remove"
        >
          <span className="text-red-300 text-base">🗑</span>
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

  // ===== Upload modal =====
  const modalFlattenedAll = useMemo(() => {
    const walk = (
      envs: Environment[],
      depth = 0
    ): Array<{ env: Environment; depth: number }> => {
      const out: Array<{ env: Environment; depth: number }> = [];
      for (const env of envs) {
        out.push({ env, depth });
        if (env.children.length) out.push(...walk(env.children, depth + 1));
      }
      return out;
    };
    return walk(environments, 0);
  }, [environments]);

  const openUploadModal = () => {
    setUploadOpen(true);
    setUploadSelectedEnvIds([]);
    setUploadFiles([]);
    setUploadIsFolder(false);
  };

  const closeUploadModal = () => {
    setUploadOpen(false);
    setUploadSelectedEnvIds([]);
    setUploadFiles([]);
    setUploadIsFolder(false);
  };

  const toggleEnvSelected = (envId: string) => {
    setUploadSelectedEnvIds((prev) =>
      prev.includes(envId) ? prev.filter((x) => x !== envId) : [...prev, envId]
    );
  };

  const onModalFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadFiles(files);
    setUploadIsFolder(false);
    e.target.value = "";
  };

  const onModalFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadFiles(files);
    setUploadIsFolder(true);
    e.target.value = "";
  };

  const confirmModalUpload = () => {
    if (uploadSelectedEnvIds.length === 0 || uploadFiles.length === 0) return;

    setEnvironments((prev) => {
      let updated = prev;
      for (const envId of uploadSelectedEnvIds) {
        updated = updateEnvTree(updated, envId, (env) => ({
          ...env,
          isOpen: true,
          items: uploadIsFolder
            ? mergeFolderFilesIntoTree(env.items, uploadFiles)
            : addFilesToRoot(env.items, uploadFiles),
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

    const what = uploadIsFolder
      ? `a folder (${uploadFiles.length} files)`
      : uploadFiles.length === 1
      ? `"${uploadFiles[0].name}"`
      : `${uploadFiles.length} files`;

    showToast(`Uploaded ${what} to ${destinationText}`);
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

  // ===== FS Tree Rendering =====
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
          <div className="w-full flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex-1 min-w-0 flex items-center gap-2 text-left text-white/90 hover:bg-white/5 rounded-lg px-2 py-2"
              style={{ paddingLeft: 10 + indent }}
              onClick={() => toggleFolderInEnv(envId, node.id)}
              title={node.isOpen ? "Collapse" : "Expand"}
            >
              <span className="text-yellow-500">{node.isOpen ? "▾" : "▸"}</span>
              <span className="text-yellow-400">📁</span>
              <span className="truncate">{node.name}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFSNodeFromEnv(envId, node);
              }}
              className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0"
              aria-label="Remove folder"
              title="Remove folder"
            >
              <span className="text-red-300 text-base">🗑</span>
            </button>
          </div>

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

    return (
      <div
        key={node.id}
        className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-3 py-3"
        style={{ marginLeft: 10 + indent }}
      >
        <div className="truncate text-white/90 flex items-center gap-2 min-w-0">
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

          <button
            type="button"
            onClick={() => removeFSNodeFromEnv(envId, node)}
            className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            aria-label="Remove"
            title="Remove"
          >
            <span className="text-red-300 text-base">🗑</span>
          </button>
        </div>
      </div>
    );
  };

  // ===== VSCode gutter + rows =====
  const maxDepth = useMemo(() => getMaxDepth(environments, 0), [environments]);
  const visibleRows = useMemo(() => flattenVisibleEnvRows(environments, 0), [environments]);

  const LEVEL_GAP = 10;
  const GUTTER_PAD = 10;
  const MAX_GUTTER = 140;
  const gutterWidth = Math.min(MAX_GUTTER, GUTTER_PAD + (maxDepth + 1) * LEVEL_GAP);

  const BASE_ROW_WIDTH = 380;
  const listMinWidth = useMemo(
    () => `${BASE_ROW_WIDTH + Math.min(140, maxDepth * 10)}px`,
    [maxDepth]
  );

  const renderEnvRow = (env: Environment, depth: number) => {
    const guides = Array.from({ length: depth }).map((_, i) => i);

    return (
      <div key={env.id} className="w-full">
        <div
          className="inline-block align-top bg-white/5 rounded-xl px-3 py-3 relative overflow-hidden"
          style={{
            borderLeft: `4px solid ${env.color}`,
            width: "min(100%, 520px)",
            minWidth: listMinWidth,
          }}
        >
          <div className="absolute top-0 bottom-0" style={{ left: 10, width: gutterWidth }}>
            {guides.map((i) => (
              <div
                key={`${env.id}-guide-${i}`}
                className="absolute top-3 bottom-3 w-px bg-white/10"
                style={{ left: GUTTER_PAD + i * LEVEL_GAP }}
              />
            ))}

            <div
              className="absolute top-3 bottom-3 rounded-full"
              style={{
                left: GUTTER_PAD + depth * LEVEL_GAP - 1,
                width: 3,
                background: env.color,
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="flex items-center gap-2 min-w-0 flex-1"
              onClick={() => toggleEnvironment(env.id)}
              title={env.isOpen ? "Collapse" : "Expand"}
              style={{ paddingLeft: 10 + gutterWidth + 6 }}
            >
              <span className="text-yellow-500">{env.isOpen ? "▾" : "▸"}</span>
              <span className="font-medium truncate">{env.name}</span>

              {env.assignedUsers.length > 0 && (
                <span className="ml-2 text-xs text-white/60 truncate">
                  ({env.assignedUsers.length} assigned)
                </span>
              )}
            </button>

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

              <button
                type="button"
                onClick={() => openFolderPickerFor(env.id)}
                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                aria-label="Upload folder"
                title="Upload folder"
              >
                <span className="text-yellow-400 text-lg">📁</span>
              </button>

              <button
                type="button"
                onClick={() => openFilePickerFor(env.id)}
                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                aria-label="Add files"
                title="Add files"
              >
                <span className="text-yellow-500 text-lg font-bold">+</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddChildEnvironment(env.id)}
                className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                aria-label="Add nested environment"
                title="Add nested environment"
              >
                <span className="text-yellow-500 text-lg font-bold">⤴</span>
              </button>
            </div>
          </div>

          {env.isOpen && (
            <div className="mt-3 space-y-2" style={{ paddingLeft: 10 + gutterWidth + 6 }}>
              {env.items.length === 0 ? (
                <div className="text-white/60 text-sm">Empty</div>
              ) : (
                <div className="space-y-2">{env.items.map((n) => renderFSNode(env.id, n, 0))}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * FIX (the only change you asked for):
   * When the sidebar is narrow, the two top buttons were overlapping.
   * We make the header controls responsive:
   * - If sidebar is narrow: buttons stack in 2 rows (no overlap)
   * - If sidebar is wide: buttons sit on one row (as before)
   *
   * This matches VSCode behavior (controls reflow instead of overlapping).
   */
  const headerCompact = sidebarWidth <= 420;

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
          {/* Knowledge Base (Resizable) */}
          <div
            className="flex flex-col bg-white/5 rounded-xl min-h-0 relative overflow-hidden"
            style={{ width: sidebarWidth }}
          >
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-[#2a3153] border-b border-white/10 rounded-t-xl">
              <div className="p-4">
                <div
                  className={`flex items-start justify-between gap-3 ${
                    headerCompact ? "flex-col" : "flex-row"
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-3">
                    <h2 className="font-semibold leading-9 min-w-0">Knowledge Base</h2>

                    {/* When compact, keep buttons aligned right but allow wrap (no overlap) */}
                    <div
                      className={`flex gap-3 ${
                        headerCompact ? "flex-wrap justify-end" : "items-center"
                      }`}
                      style={{ maxWidth: headerCompact ? "100%" : undefined }}
                    >
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

                    {/* Hidden inputs */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFilesSelected}
                    />

                    {/* @ts-expect-error - webkitdirectory */}
                    <input
                      ref={folderInputRef}
                      type="file"
                      multiple
                      webkitdirectory="true"
                      className="hidden"
                      onChange={handleFolderSelected}
                    />
                  </div>

                  <div className="text-white/70 text-sm w-full">No documents uploaded yet.</div>
                </div>
              </div>
            </div>

            {/* Scroll area */}
            <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 px-4 pb-4 pt-4 space-y-4">
              {/* Default docs */}
              <div className="space-y-3">
                {defaultDocs.length === 0 ? null : defaultDocs.map(renderDefaultDocRow)}
              </div>

              {/* Environments */}
              <div className="space-y-3" style={{ minWidth: listMinWidth }}>
                {visibleRows.map(({ env, depth }) => renderEnvRow(env, depth))}
              </div>
            </div>

            {/* Resize handle */}
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={startResize}
              className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
              title="Drag to resize"
              style={{
                background:
                  "linear-gradient(to right, rgba(255,255,255,0.0), rgba(255,255,255,0.10), rgba(255,255,255,0.0))",
              }}
            />
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
                  Select environments, then choose files or a folder.
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
                modalFlattenedAll.map(({ env, depth }) => (
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
                Selection:{" "}
                <span className="text-white/90">
                  {uploadFiles.length === 0
                    ? "None selected"
                    : uploadIsFolder
                    ? `Folder (${uploadFiles.length} files)`
                    : `${uploadFiles.length} file(s)`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => modalFolderInputRef.current?.click()}
                  className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold border border-white/10"
                >
                  Choose folder
                </button>

                <button
                  type="button"
                  onClick={() => modalFileInputRef.current?.click()}
                  className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-95"
                >
                  Choose files
                </button>
              </div>

              <input
                ref={modalFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={onModalFilesSelected}
              />

              {/* @ts-expect-error - webkitdirectory */}
              <input
                ref={modalFolderInputRef}
                type="file"
                multiple
                webkitdirectory="true"
                className="hidden"
                onChange={onModalFolderSelected}
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