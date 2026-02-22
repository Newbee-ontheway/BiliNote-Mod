import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.db.init_db import init_db
from app.db.provider_dao import seed_default_providers
from app.exceptions.exception_handlers import register_exception_handlers
# from app.db.model_dao import init_model_table
# from app.db.provider_dao import init_provider_table
from app.utils.logger import get_logger
from app import create_app
from app.transcriber.transcriber_provider import get_transcriber
from app.utils.env_checker import ensure_optimal_runtime
from events import register_handler
from ffmpeg_helper import ensure_ffmpeg_or_raise

logger = get_logger(__name__)
load_dotenv()

# ── GPU 检测（注入 DLL 路径 + 报告状态）──
ensure_optimal_runtime()
# 如果 .env 未设置 WHISPER_DEVICE，自动检测
if "WHISPER_DEVICE" not in os.environ:
    from app.utils.env_checker import is_cuda_available
    os.environ["WHISPER_DEVICE"] = "cuda" if is_cuda_available() else "cpu"

# 读取 .env 中的路径
static_path = os.getenv('STATIC', '/static')
out_dir = os.getenv('OUT_DIR', './static/screenshots')

# 自动创建本地目录（static 和 static/screenshots）
static_dir = "static"
uploads_dir = "uploads"
if not os.path.exists(static_dir):
    os.makedirs(static_dir)
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir)

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

@asynccontextmanager
async def lifespan(app: FastAPI):
    register_handler()
    init_db()
    get_transcriber(
        transcriber_type=os.getenv("TRANSCRIBER_TYPE", "fast-whisper"),
        device=os.environ.get("WHISPER_DEVICE", "cpu")
    )
    seed_default_providers()
    yield

app = create_app(lifespan=lifespan)
origins = [
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,  # bookmarklet 不需要 credentials
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)
app.mount(static_path, StaticFiles(directory=static_dir), name="static")
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")









if __name__ == "__main__":
    port = int(os.getenv("BACKEND_PORT", 8483))
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, reload=False)