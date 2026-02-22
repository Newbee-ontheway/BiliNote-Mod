<p align="center">
  <img src="BillNote_frontend/public/icon.svg" width="80" />
</p>

<h1 align="center">BiliNote ✨魔改版</h1>

<p align="center">
  基于 <a href="https://github.com/JefferyHcool/BiliNote">BiliNote</a> 二次开发的 AI 视频笔记工具，新增多项实用功能
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v1.0.0-blue" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
  <img src="https://img.shields.io/badge/based%20on-BiliNote%20v1.8.1-orange" />
</p>

---

## ✨ 魔改版新增功能

| # | 功能 | 说明 |
|---|------|------|
| 1 | 🌐 **网页文本总结** | 直接粘贴文本即可生成结构化笔记，不限于视频 |
| 2 | ⚡ **优化笔记生成速度** | GPU 加速自动检测，正确适配 GTX/RTX 全系显卡（int8_float32） |
| 3 | 📤 **更多导出格式** | 支持导出为 PDF、Word 文档 |
| 4 | 🎬 **本地视频总结** | 支持直接上传本地视频文件进行转录和笔记生成 |
| 5 | 🛡️ **下载配置防呆** | 智能检测下载地址和下载器配置，避免常见错误 |
| 6 | 🔗 **YouTube 代理提示** | 下载 YouTube 视频失败时，给出清晰的代理配置指引（3 步搞定） |
| 7 | 🎨 **UI 优化** | 界面微调，更清爽好用 |

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/Newbee-ontheway/BiliNote-Mod-Bilinote-.git
cd BiliNote-Mod-Bilinote-
```

### 2. 启动后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python main.py
```

### 3. 启动前端

```bash
cd BillNote_frontend
pnpm install
pnpm dev
```

### 4. 一键启动（Windows）

直接双击根目录下的 `start.bat` 即可同时启动前后端。

## ⚙️ 配置说明

编辑 `backend/.env` 文件：

```env
# 通用
ENV=production
API_BASE_URL=http://127.0.0.1:8000

# 转录引擎
TRANSCRIBER_TYPE=fast-whisper
WHISPER_MODEL_SIZE=base

# GPU 加速（有 NVIDIA 显卡会自动启用，也可手动指定）
# WHISPER_DEVICE=cuda

# YouTube 代理（下载 YouTube 视频需要）
# PROXY=http://127.0.0.1:7890
```

## 🙏 致谢

- 原项目：[BiliNote](https://github.com/JefferyHcool/BiliNote) by [JefferyHcool](https://github.com/JefferyHcool)
- 本项目基于 BiliNote v1.8.1 进行二次开发

## 📜 License

MIT License
