"""
app_settings.py — 全局应用设置（动态读取）
提供 get_note_output_dir() 用于各模块获取当前笔记输出目录
"""
import os
import json
from pathlib import Path

_SETTINGS_FILE = Path("config/app_settings.json")


def _load_settings() -> dict:
    if _SETTINGS_FILE.exists():
        try:
            return json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_settings(settings: dict):
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SETTINGS_FILE.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")


def _get_default_output_dir() -> str:
    """返回默认导出目录：桌面/BiliNote导出"""
    desktop = Path.home() / "Desktop" / "BiliNote_Export"
    return str(desktop)


def get_note_output_dir() -> Path:
    """动态获取笔记输出目录，优先读取用户配置，其次环境变量，最后桌面默认值"""
    settings = _load_settings()
    dir_str = (
        settings.get("output_dir")
        or os.getenv("NOTE_OUTPUT_DIR")
        or _get_default_output_dir()
    )
    p = Path(dir_str)
    p.mkdir(parents=True, exist_ok=True)
    return p
