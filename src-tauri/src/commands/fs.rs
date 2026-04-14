use serde::Serialize;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct FileNode {
    name: String,
    path: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
    children: Option<Vec<FileNode>>,
}

fn is_pdf(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
}

fn build_tree(root: &Path, max_depth: usize) -> Vec<FileNode> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root)
        .min_depth(1)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if path.is_dir() {
            continue;
        }
        if !is_pdf(path) {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("unknown.pdf")
            .to_string();
        files.push(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir: false,
            children: None,
        });
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));
    files
}

#[tauri::command]
pub fn list_pdf_tree(root_path: String) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&root_path);
    if !root.exists() {
        return Err("目录不存在".to_string());
    }
    Ok(build_tree(root, 6))
}
