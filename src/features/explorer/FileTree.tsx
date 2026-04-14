import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FileNode } from "../../app/types";

type Props = {
  rootPath: string;
  onRootChange: (rootPath: string) => void;
  onOpenPdf: (filePath: string) => void;
  activePdf: string;
};

async function loadTree(path: string): Promise<FileNode[]> {
  return invoke<FileNode[]>("list_pdf_tree", { rootPath: path });
}

function NodeItem(props: {
  node: FileNode;
  activePdf: string;
  onOpenPdf: (filePath: string) => void;
}) {
  const { node, activePdf, onOpenPdf } = props;
  const [open, setOpen] = useState(false);
  if (node.isDir) {
    return (
      <li>
        <button className="tree-row" onClick={() => setOpen((v) => !v)}>
          {open ? "▾" : "▸"} {node.name}
        </button>
        {open && node.children && (
          <ul className="tree-list">
            {node.children.map((child) => (
              <NodeItem
                key={child.path}
                node={child}
                activePdf={activePdf}
                onOpenPdf={onOpenPdf}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const active = activePdf === node.path;
  return (
    <li>
      <button
        className={`tree-row ${active ? "active" : ""}`}
        onClick={() => onOpenPdf(node.path)}
      >
        📄 {node.name}
      </button>
    </li>
  );
}

export function FileTree({ rootPath, onRootChange, onOpenPdf, activePdf }: Props) {
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rootPath) return;
    loadTree(rootPath)
      .then((next) => {
        setNodes(next);
        setError("");
      })
      .catch((e) => setError(String(e)));
  }, [rootPath]);

  const chooseFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      onRootChange(selected);
    }
  };

  return (
    <div className="panel-body">
      <div className="panel-header">
        <span>资源管理器</span>
        <button onClick={chooseFolder}>打开目录</button>
      </div>
      <div className="panel-subtitle">{rootPath || "未选择目录"}</div>
      {error && <div className="error-text">{error}</div>}
      <ul className="tree-list">
        {nodes.map((node) => (
          <NodeItem
            key={node.path}
            node={node}
            activePdf={activePdf}
            onOpenPdf={onOpenPdf}
          />
        ))}
      </ul>
    </div>
  );
}
