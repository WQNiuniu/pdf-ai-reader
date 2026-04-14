# VSCode 风格 PDF AI 阅读器

基于 Tauri + React 的桌面 PDF 阅读器，支持文件树浏览、PDF 阅读和 AI 问答。

## 功能

- 左侧目录树：选择本地目录后显示 PDF 文件
- 中间阅读区：翻页、缩放、页码状态
- 右侧 AI 对话：结合当前页及邻近页文本回答问题
- AI 设置：支持用户配置 `baseUrl`、`apiKey`、`model`、`temperature`
- 会话历史按 PDF 文件隔离

## 开发

```bash
npm install
npm run tauri dev
```

## 打包 Windows `.exe`

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。
