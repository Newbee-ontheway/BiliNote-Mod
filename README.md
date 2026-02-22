<p align="center">
  <img src="BillNote_frontend/public/icon.svg" width="80" />
</p>

<h1 align="center">BiliNote ✨魔改版</h1>

<p align="center">
  基于 <a href="https://github.com/JefferyHcool/BiliNote">BiliNote</a> 二次开发的 AI 视频笔记工具，新增多项实用功能
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v1.1.1-blue" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
  <img src="https://img.shields.io/badge/docker-available-brightgreen" />
  <img src="https://img.shields.io/badge/based%20on-BiliNote%20v1.8.1-orange" />
</p>

---

## ✨ 功能特性 (魔改版新增功能加粗)

| # | 功能 | 说明 |
|---|------|------|
| 1 | 多平台支持 | 支持 Bilibili、YouTube、本地视频、抖音等多个平台 |
| 2 | 笔记格式与风格选择 | 支持返回多种笔记格式与风格，个性化定制且结构化 (Markdown) |
| 3 | 多模态视频理解 | 结合视觉和音频内容，全面理解视频 |
| 4 | 自定义大模型配置 | 支持自行配置 GPT 等大语言模型 |
| 5 | 本地音频转写 | 支持 Fast-Whisper 等本地模型音频转写 |
| 6 | 智能截图与内容跳转 | 可插入自动截取的关键画面，并支持关联原视频的精确时间点跳转 |
| 7 | **🌐 网页文本总结** | **直接粘贴文本即可生成结构化笔记，不再仅限于视频** |
| 8 | **⚡ 优化笔记生成速度** | **GPU 加速自动检测，正确适配 GTX/RTX 全系显卡（int8_float32）** |
| 9 | **📤 更多导出格式** | **支持导出为 PDF、Word 文档** |
| 10 | **🎬 本地视频总结** | **支持直接上传本地视频文件进行转录和笔记生成** |
| 11 | **🛡️ 下载配置防呆** | **智能检测下载地址和下载器配置，避免常见错误** |
| 12 | **🔗 YouTube 代理提示** | **下载 YouTube 视频失败时，给出清晰的代理配置指引（3 步搞定）** |
| 13 | **🎨 UI 深度优化** | **前端界面微调，更符合 AI 生产力工具的直觉操作** |

## 🚀 快速开始

### 3. 使用 Docker 部署 (推荐)

我们已提供预构建镜像，只需一个 `docker-compose.yml` 即可启动：

```yaml
services:
  backend:
    image: newbeeontheway/bilinote-mod-backend:latest
    env_file: .env
    volumes:
      - ./backend_data:/app/data
    restart: always

  frontend:
    image: newbeeontheway/bilinote-mod-frontend:latest
    restart: always

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - backend
      - frontend
```

运行：
```bash
docker compose up -d
```

### 4. 一键启动（Windows 本地开发）

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
