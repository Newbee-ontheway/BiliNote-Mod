"""
text_extractor.py — 文本提取模块
从文本、文档(TXT/PDF)、网页 URL 提取纯文本并切分为 TranscriptSegment 格式
"""
import os
import re
import logging
from typing import List, Optional
from urllib.parse import urlparse

from app.models.transcriber_model import TranscriptSegment

logger = logging.getLogger(__name__)


def extract_text_from_file(file_path: str) -> str:
    """
    从本地文件提取文本。
    支持: .txt, .md, .pdf (需 PyPDF2 或 pdfplumber)
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext in ('.txt', '.md', '.csv', '.log'):
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

    elif ext == '.pdf':
        try:
            import pdfplumber
            text_parts = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
            return "\n\n".join(text_parts)
        except ImportError:
            logger.warning("pdfplumber 未安装，尝试 PyPDF2")
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(file_path)
                return "\n\n".join(
                    page.extract_text() or "" for page in reader.pages
                )
            except ImportError:
                raise ImportError("需要安装 pdfplumber 或 PyPDF2 来处理 PDF 文件: pip install pdfplumber")

    elif ext in ('.docx',):
        try:
            from docx import Document
            doc = Document(file_path)
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            raise ImportError("需要安装 python-docx 来处理 DOCX 文件: pip install python-docx")

    else:
        # 尝试作为纯文本读取
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()


def _fetch_via_jina(url: str) -> Optional[str]:
    """Layer 2: Jina Reader API — 处理 JS 渲染和反爬页面，返回 markdown"""
    import requests as _req
    jina_url = f"https://r.jina.ai/{url}"
    headers = {"Accept": "text/markdown"}
    api_key = os.environ.get("JINA_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        resp = _req.get(jina_url, headers=headers, timeout=30)
        resp.raise_for_status()
        text = resp.text.strip()
        if text and len(text) > 50:
            logger.info(f"Jina Reader 提取成功 ({len(text)} chars)")
            return text
    except Exception as e:
        logger.warning(f"Jina Reader 提取失败: {e}")
    return None


def _fetch_via_wayback(url: str) -> Optional[str]:
    """Layer 3: Wayback Machine — 获取缓存版本，应对付费墙"""
    import requests as _req
    try:
        api = f"https://archive.org/wayback/available?url={url}"
        resp = _req.get(api, timeout=10)
        data = resp.json()
        snapshot = data.get("archived_snapshots", {}).get("closest")
        if not snapshot or not snapshot.get("available"):
            return None
        cached_url = snapshot["url"]
        logger.info(f"Wayback Machine 找到缓存: {cached_url}")
        # 用 trafilatura 提取缓存页面
        try:
            import trafilatura
            downloaded = trafilatura.fetch_url(cached_url)
            if downloaded:
                text = trafilatura.extract(downloaded, output_format='markdown',
                                          include_tables=True, include_links=False)
                if text and len(text) > 50:
                    return text
        except Exception:
            pass
        # 缓存页面也用 requests 兜底
        resp2 = _req.get(cached_url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        html = resp2.text
        text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        if text and len(text) > 50:
            return text
    except Exception as e:
        logger.warning(f"Wayback Machine 提取失败: {e}")
    return None


def extract_text_from_url(url: str) -> str:
    """
    从网页 URL 提取正文内容（markdown 格式）。
    4 层 fallback 链:
      1. trafilatura (markdown 输出，保留标题/列表/表格结构)
      2. Jina Reader API (处理 JS 渲染、反爬)
      3. Wayback Machine (付费墙缓存版本)
      4. requests + regex (最后兜底)
    """
    # --- Layer 1: trafilatura (markdown) ---
    try:
        import trafilatura
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(downloaded, output_format='markdown',
                                      include_tables=True, include_links=False)
            if text and len(text) > 50:
                logger.info(f"trafilatura 提取成功 ({len(text)} chars)")
                return text
            else:
                logger.info("trafilatura 返回内容过短，尝试下一层")
    except ImportError:
        logger.info("trafilatura 未安装，跳过 Layer 1")
    except Exception as e:
        logger.warning(f"trafilatura 提取失败: {e}")

    # --- Layer 2: Jina Reader API ---
    jina_result = _fetch_via_jina(url)
    if jina_result:
        return jina_result

    # --- Layer 3: Wayback Machine ---
    wayback_result = _fetch_via_wayback(url)
    if wayback_result:
        return wayback_result

    # --- Layer 4: requests + regex (最后兜底) ---
    try:
        import requests
        resp = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        resp.raise_for_status()
        html = resp.text

        text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        if text and len(text) > 50:
            logger.info(f"regex fallback 提取成功 ({len(text)} chars)")
            return text
    except Exception as e:
        logger.warning(f"regex fallback 失败: {e}")

    raise RuntimeError(f"所有提取方式均失败，无法从 URL 获取内容: {url}")


def text_to_segments(text: str, chunk_size: int = 500) -> List[TranscriptSegment]:
    """
    将纯文本按段落拆分为 TranscriptSegment 列表。
    使用段落分割，如果段落太长则按 chunk_size 字符切分。
    """
    paragraphs = re.split(r'\n\s*\n|\n', text.strip())
    segments = []
    idx = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # 如果段落过长，按 chunk_size 切分
        if len(para) > chunk_size:
            for i in range(0, len(para), chunk_size):
                chunk = para[i:i + chunk_size]
                segments.append(TranscriptSegment(
                    start=float(idx),
                    end=float(idx + 1),
                    text=chunk
                ))
                idx += 1
        else:
            segments.append(TranscriptSegment(
                start=float(idx),
                end=float(idx + 1),
                text=para
            ))
            idx += 1

    return segments
