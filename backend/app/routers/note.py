# app/routers/note.py
import json
import os
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from pydantic import BaseModel, validator, field_validator
from dataclasses import asdict

from app.db.video_task_dao import get_task_by_video
from app.enmus.exception import NoteErrorEnum
from app.enmus.note_enums import DownloadQuality
from app.exceptions.note import NoteError
from app.services.note import NoteGenerator, logger
from app.utils.response import ResponseWrapper as R
from app.utils.url_parser import extract_video_id
from app.validators.video_url_validator import is_supported_video_url
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import httpx
from app.enmus.task_status_enums import TaskStatus

# from app.services.downloader import download_raw_audio
# from app.services.whisperer import transcribe_audio

router = APIRouter()


class RecordRequest(BaseModel):
    video_id: str
    platform: str


class VideoRequest(BaseModel):
    video_url: str
    platform: str
    quality: DownloadQuality
    screenshot: Optional[bool] = False
    link: Optional[bool] = False
    model_name: str
    provider_id: str
    task_id: Optional[str] = None
    format: Optional[list] = []
    style: str = None
    extras: Optional[str]=None
    video_understanding: Optional[bool] = False
    video_interval: Optional[int] = 0
    grid_size: Optional[list] = []
    summary_level: Optional[str] = "medium"  # simple / medium / detailed

    @field_validator("video_url")
    def validate_supported_url(cls, v):
        url = str(v)
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https"):
            # 是网络链接，继续用原有平台校验
            if not is_supported_video_url(url):
                raise NoteError(code=NoteErrorEnum.PLATFORM_NOT_SUPPORTED.code,
                                message=NoteErrorEnum.PLATFORM_NOT_SUPPORTED.message)

        return v


from app.utils.app_settings import get_note_output_dir
UPLOAD_DIR = "uploads"


def save_note_to_file(task_id: str, note):
    out_dir = str(get_note_output_dir())
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, f"{task_id}.json"), "w", encoding="utf-8") as f:
        json.dump(asdict(note), f, ensure_ascii=False, indent=2)


def run_note_task(task_id: str, video_url: str, platform: str, quality: DownloadQuality,
                  link: bool = False, screenshot: bool = False, model_name: str = None, provider_id: str = None,
                  _format: list = None, style: str = None, extras: str = None, video_understanding: bool = False,
                  video_interval=0, grid_size=[], summary_level: str = "medium"
                  ):

    if not model_name or not provider_id:
        raise HTTPException(status_code=400, detail="请选择模型和提供者")

    note = NoteGenerator().generate(
        video_url=video_url,
        platform=platform,
        quality=quality,
        task_id=task_id,
        model_name=model_name,
        provider_id=provider_id,
        link=link,
        _format=_format,
        style=style,
        extras=extras,
        screenshot=screenshot,
        video_understanding=video_understanding,
        video_interval=video_interval,
        grid_size=grid_size,
        summary_level=summary_level,
    )
    logger.info(f"Note generated: {task_id}")
    if not note or not note.markdown:
        logger.warning(f"任务 {task_id} 执行失败，跳过保存")
        return
    save_note_to_file(task_id, note)



@router.post('/delete_task')
def delete_task(data: RecordRequest):
    try:
        # TODO: 待持久化完成
        # NoteGenerator().delete_note(video_id=data.video_id, platform=data.platform)
        return R.success(msg='删除成功')
    except Exception as e:
        return R.error(msg=e)


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_location = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_location, "wb+") as f:
        f.write(await file.read())

    # 假设你静态目录挂载了 /uploads
    return R.success({"url": f"/uploads/{file.filename}"})


@router.post("/generate_note")
def generate_note(data: VideoRequest, background_tasks: BackgroundTasks):
    try:

        video_id = extract_video_id(data.video_url, data.platform)
        # if not video_id:
        #     raise HTTPException(status_code=400, detail="无法提取视频 ID")
        # existing = get_task_by_video(video_id, data.platform)
        # if existing:
        #     return R.error(
        #         msg='笔记已生成，请勿重复发起',
        #
        #     )
        if data.task_id:
            # 如果传了task_id，说明是重试！
            task_id = data.task_id
            # 更新之前的状态
            NoteGenerator()._update_status(task_id, TaskStatus.PENDING)
            logger.info(f"重试模式，复用已有 task_id={task_id}")
        else:
            # 正常新建任务
            task_id = str(uuid.uuid4())

        background_tasks.add_task(run_note_task, task_id, data.video_url, data.platform, data.quality, data.link,
                                  data.screenshot, data.model_name, data.provider_id, data.format, data.style,
                                  data.extras, data.video_understanding, data.video_interval, data.grid_size,
                                  data.summary_level)
        return R.success({"task_id": task_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task_status/{task_id}")
def get_task_status(task_id: str):
    out_dir = str(get_note_output_dir())
    status_path = os.path.join(out_dir, f"{task_id}.status.json")
    result_path = os.path.join(out_dir, f"{task_id}.json")

    # 优先读状态文件
    if os.path.exists(status_path):
        with open(status_path, "r", encoding="utf-8") as f:
            status_content = json.load(f)

        status = status_content.get("status")
        message = status_content.get("message", "")

        if status == TaskStatus.SUCCESS.value:
            # 成功状态的话，继续读取最终笔记内容
            if os.path.exists(result_path):
                with open(result_path, "r", encoding="utf-8") as rf:
                    result_content = json.load(rf)
                return R.success({
                    "status": status,
                    "result": result_content,
                    "message": message,
                    "task_id": task_id
                })
            else:
                # 理论上不会出现，保险处理
                return R.success({
                    "status": TaskStatus.PENDING.value,
                    "message": "任务完成，但结果文件未找到",
                    "task_id": task_id
                })

        if status == TaskStatus.FAILED.value:
            return R.error(message or "任务失败", code=500)

        # 处理中状态
        return R.success({
            "status": status,
            "message": message,
            "task_id": task_id
        })

    # 没有状态文件，但有结果
    if os.path.exists(result_path):
        with open(result_path, "r", encoding="utf-8") as f:
            result_content = json.load(f)
        return R.success({
            "status": TaskStatus.SUCCESS.value,
            "result": result_content,
            "task_id": task_id
        })

    # 什么都没有，默认PENDING
    return R.success({
        "status": TaskStatus.PENDING.value,
        "message": "任务排队中",
        "task_id": task_id
    })


@router.get("/image_proxy")
async def image_proxy(request: Request, url: str):
    headers = {
        "Referer": "https://www.bilibili.com/",
        "User-Agent": request.headers.get("User-Agent", ""),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)

            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="图片获取失败")

            content_type = resp.headers.get("Content-Type", "image/jpeg")
            return StreamingResponse(
                resp.aiter_bytes(),
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400",  #  缓存一天
                    "Content-Type": content_type,
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Phase 3: 文档/网页/文本输入 ====================

class TextNoteRequest(BaseModel):
    """从纯文本、文档文件路径或网页 URL 生成笔记"""
    source_type: str  # "text" / "file" / "url"
    content: str      # 原文 / 文件路径 / URL
    title: Optional[str] = "文本笔记"
    model_name: str
    provider_id: str
    style: Optional[str] = "minimal"
    summary_level: Optional[str] = "medium"
    extras: Optional[str] = None
    format: Optional[list] = []


def run_text_note_task(
    task_id: str,
    source_type: str,
    content: str,
    title: str,
    model_name: str,
    provider_id: str,
    style: str,
    summary_level: str,
    extras: str,
    formats: list,
):
    """后台任务：从文本/文档/URL 生成笔记"""
    from app.utils.text_extractor import extract_text_from_file, extract_text_from_url, text_to_segments
    from app.models.transcriber_model import TranscriptResult
    from app.models.gpt_model import GPTSource

    gen = NoteGenerator()

    try:
        gen._update_status(task_id, TaskStatus.PARSING)

        # 1. 提取文本
        if source_type == "text":
            raw_text = content
        elif source_type == "file":
            file_path = content
            if file_path.startswith('/uploads'):
                file_path = os.path.join(os.getcwd(), file_path.lstrip('/'))
                file_path = os.path.normpath(file_path)
            raw_text = extract_text_from_file(file_path)
        elif source_type == "url":
            raw_text = extract_text_from_url(content)
        else:
            raise ValueError(f"不支持的 source_type: {source_type}")

        if not raw_text or len(raw_text.strip()) < 10:
            raise ValueError("提取的文本内容过短或为空")

        # 2. 切分为 segments
        segments = text_to_segments(raw_text)
        transcript = TranscriptResult(language="zh", full_text=raw_text, segments=segments)

        # 3. GPT 总结
        gen._update_status(task_id, TaskStatus.SUMMARIZING)
        gpt = gen._get_gpt(model_name, provider_id)

        source = GPTSource(
            title=title,
            segment=transcript.segments,
            tags=[],
            screenshot=False,
            link=False,
            _format=formats,
            style=style,
            extras=extras,
            summary_level=summary_level,
            video_img_urls=[],
        )

        markdown = gpt.summarize(source)

        # 4-1. 自动提取标题：如果用户没有填标题，从 markdown 第一个 # 标题中提取
        import re as _re
        if not title or title in ("文本笔记", ""):
            heading_match = _re.search(r'^#\s+(.+)', markdown, _re.MULTILINE)
            if heading_match:
                title = heading_match.group(1).strip()
                # 清理可能的 markdown 格式符号
                title = _re.sub(r'\*\*(.+?)\*\*', r'\1', title)
                title = _re.sub(r'\*(.+?)\*', r'\1', title)
                title = title.strip()
            if not title:
                title = "文本笔记"

        # 4-2. 缓存 + 保存
        markdown_cache = get_note_output_dir() / f"{task_id}_markdown.md"
        markdown_cache.write_text(markdown, encoding="utf-8")

        from app.models.notes_model import NoteResult
        from app.models.audio_model import AudioDownloadResult

        note = NoteResult(
            markdown=markdown,
            transcript=transcript,
            audio_meta=AudioDownloadResult(
                file_path="",
                title=title,
                duration=0,
                cover_url="",
                platform="text",
                video_id=task_id,
                raw_info={"source_type": source_type},
                video_path=None,
            ),
        )
        save_note_to_file(task_id, note)
        gen._update_status(task_id, TaskStatus.SUCCESS)
        logger.info(f"文本笔记生成成功 (task_id={task_id})")

    except Exception as exc:
        logger.error(f"文本笔记生成失败 (task_id={task_id}): {exc}", exc_info=True)
        gen._update_status(task_id, TaskStatus.FAILED, message=str(exc))


@router.post("/generate_note_from_text")
def generate_note_from_text(data: TextNoteRequest, background_tasks: BackgroundTasks):
    """从文本/文档/网页生成笔记"""
    try:
        task_id = str(uuid.uuid4())
        background_tasks.add_task(
            run_text_note_task,
            task_id=task_id,
            source_type=data.source_type,
            content=data.content,
            title=data.title,
            model_name=data.model_name,
            provider_id=data.provider_id,
            style=data.style,
            summary_level=data.summary_level,
            extras=data.extras,
            formats=data.format or [],
        )
        return R.success({"task_id": task_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Phase 4: 笔记对话 ====================

class ChatRequest(BaseModel):
    """基于已有笔记进行对话"""
    task_id: str        # 笔记对应的 task_id
    message: str        # 用户的提问
    model_name: str
    provider_id: str
    history: Optional[list] = []  # [{"role": "user", "content": "..."}, ...]


@router.post("/chat_with_note")
def chat_with_note(data: ChatRequest):
    """基于已有笔记内容进行对话"""
    try:
        # 1. 读取笔记
        out_dir = str(get_note_output_dir())
        result_path = os.path.join(out_dir, f"{data.task_id}.json")
        md_path = os.path.join(out_dir, f"{data.task_id}_markdown.md")

        note_content = ""
        if os.path.exists(md_path):
            with open(md_path, "r", encoding="utf-8") as f:
                note_content = f.read()
        elif os.path.exists(result_path):
            with open(result_path, "r", encoding="utf-8") as f:
                result = json.load(f)
                note_content = result.get("markdown", "")

        if not note_content:
            raise HTTPException(status_code=404, detail="未找到对应笔记内容")

        # 2. 创建 GPT 实例
        gpt = NoteGenerator()._get_gpt(data.model_name, data.provider_id)

        # 3. 构建对话
        system_prompt = f"""你是一个智能笔记助手。以下是用户生成的笔记内容，请基于这些内容回答用户的问题。

## 笔记内容：
{note_content}

## 要求：
- 回答必须基于笔记内容，不要编造信息
- 如果笔记中没有相关信息，请如实告知
- 使用 Markdown 格式输出
- 回答要简洁准确"""

        messages = [{"role": "system", "content": system_prompt}]
        if data.history:
            for msg in data.history:
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": data.message})

        # 4. 调用 LLM
        response = gpt.client.chat.completions.create(
            model=gpt.model,
            messages=messages,
            temperature=0.5,
        )
        reply = response.choices[0].message.content.strip()
        return R.success({"reply": reply})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"笔记对话失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
