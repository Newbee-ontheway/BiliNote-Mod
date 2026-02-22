import os
import json
import logging
from abc import ABC
from typing import Union, Optional, List

import yt_dlp

from app.downloaders.base import Downloader, DownloadQuality
from app.models.notes_model import AudioDownloadResult
from app.models.transcriber_model import TranscriptResult, TranscriptSegment
from app.utils.path_helper import get_data_dir
from app.utils.url_parser import extract_video_id

logger = logging.getLogger(__name__)


class YoutubeDownloader(Downloader, ABC):
    def __init__(self):
        super().__init__()

    @staticmethod
    def _get_proxy() -> Optional[str]:
        """从环境变量获取代理地址"""
        return os.environ.get('PROXY') or os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')

    def download(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
        quality: DownloadQuality = "fast",
        need_video:Optional[bool]=False
    ) -> AudioDownloadResult:
        if output_dir is None:
            output_dir = get_data_dir()
        if not output_dir:
            output_dir=self.cache_data
        os.makedirs(output_dir, exist_ok=True)

        output_path = os.path.join(output_dir, "%(id)s.%(ext)s")

        ydl_opts = {
            'format': 'bestaudio/best',  # 不限制容器格式，最大兼容性
            'outtmpl': output_path,
            'noplaylist': True,
            'quiet': False,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }

        proxy = self._get_proxy()
        if proxy:
            ydl_opts['proxy'] = proxy
            logger.info(f"YouTube 下载使用代理: {proxy}")

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info.get("id")
                title = info.get("title")
                duration = info.get("duration", 0)
                cover_url = info.get("thumbnail")
                ext = "mp3"
                audio_path = os.path.join(output_dir, f"{video_id}.{ext}")
        except yt_dlp.utils.DownloadError as e:
            err_msg = str(e)
            if "403" in err_msg or "format is not available" in err_msg.lower():
                raise RuntimeError(
                    "❌ YouTube 视频下载失败（网络无法访问 YouTube）\n"
                    "\n"
                    "📋 解决方法（3步）：\n"
                    "\n"
                    "  1️⃣ 打开文件：BiliNote-src/backend/.env\n"
                    "     （就是和 main.py 同一个文件夹下的 .env 文件）\n"
                    "\n"
                    "  2️⃣ 在文件最后新起一行，添加：\n"
                    "     PROXY=http://127.0.0.1:7890\n"
                    "     ⚠️ 端口号 7890 要改成你自己代理软件的端口！\n"
                    "     （Clash 默认 7890，V2Ray 默认 10809，看你代理软件设置里的 HTTP 端口）\n"
                    "\n"
                    "  3️⃣ 保存文件，然后重启程序（关掉再重新打开 start.bat）\n"
                ) from e
            raise

        return AudioDownloadResult(
            file_path=audio_path,
            title=title,
            duration=duration,
            cover_url=cover_url,
            platform="youtube",
            video_id=video_id,
            raw_info={'tags':info.get('tags')}, #全部返回会报错
            video_path=None  # ❗音频下载不包含视频路径
        )

    def download_video(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
    ) -> str:
        """
        下载视频，返回视频文件路径
        """
        if output_dir is None:
            output_dir = get_data_dir()
        video_id = extract_video_id(video_url, "youtube")
        video_path = os.path.join(output_dir, f"{video_id}.mp4")
        if os.path.exists(video_path):
            return video_path
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "%(id)s.%(ext)s")

        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': output_path,
            'noplaylist': True,
            'quiet': False,
            'merge_output_format': 'mp4',
        }
        proxy = self._get_proxy()
        if proxy:
            ydl_opts['proxy'] = proxy

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            video_id = info.get("id")
            video_path = os.path.join(output_dir, f"{video_id}.mp4")

        if not os.path.exists(video_path):
            raise FileNotFoundError(f"视频文件未找到: {video_path}")

        return video_path

    def download_subtitles(self, video_url: str, output_dir: str = None,
                           langs: List[str] = None) -> Optional[TranscriptResult]:
        """
        尝试获取YouTube视频字幕（优先人工字幕，其次自动生成）

        :param video_url: 视频链接
        :param output_dir: 输出路径
        :param langs: 优先语言列表
        :return: TranscriptResult 或 None
        """
        if output_dir is None:
            output_dir = get_data_dir()
        if not output_dir:
            output_dir = self.cache_data
        os.makedirs(output_dir, exist_ok=True)

        if langs is None:
            langs = ['zh-Hans', 'zh', 'zh-CN', 'zh-TW', 'en', 'en-US']

        video_id = extract_video_id(video_url, "youtube")

        ydl_opts = {
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': langs,
            'subtitlesformat': 'json3',
            'skip_download': True,
            'outtmpl': os.path.join(output_dir, f'{video_id}.%(ext)s'),
            'quiet': True,
        }
        proxy = self._get_proxy()
        if proxy:
            ydl_opts['proxy'] = proxy

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)

                # 查找下载的字幕文件
                subtitles = info.get('requested_subtitles') or {}
                if not subtitles:
                    logger.info(f"YouTube视频 {video_id} 没有可用字幕")
                    return None

                # 按优先级查找字幕文件
                subtitle_file = None
                detected_lang = None
                for lang in langs:
                    if lang in subtitles:
                        subtitle_file = os.path.join(output_dir, f"{video_id}.{lang}.json3")
                        detected_lang = lang
                        break

                # 如果按优先级没找到，取第一个可用的
                if not subtitle_file:
                    for lang, sub_info in subtitles.items():
                        subtitle_file = os.path.join(output_dir, f"{video_id}.{lang}.json3")
                        detected_lang = lang
                        break

                if not subtitle_file or not os.path.exists(subtitle_file):
                    logger.info(f"字幕文件不存在: {subtitle_file}")
                    return None

                # 解析字幕文件
                return self._parse_json3_subtitle(subtitle_file, detected_lang)

        except Exception as e:
            logger.warning(f"获取YouTube字幕失败: {e}")
            return None

    def _parse_json3_subtitle(self, subtitle_file: str, language: str) -> Optional[TranscriptResult]:
        """
        解析 json3 格式字幕文件

        :param subtitle_file: 字幕文件路径
        :param language: 语言代码
        :return: TranscriptResult
        """
        try:
            with open(subtitle_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            segments = []
            events = data.get('events', [])

            for event in events:
                # json3 格式中时间单位是毫秒
                start_ms = event.get('tStartMs', 0)
                duration_ms = event.get('dDurationMs', 0)

                # 提取文本
                segs = event.get('segs', [])
                text = ''.join(seg.get('utf8', '') for seg in segs).strip()

                if text:  # 只添加非空文本
                    segments.append(TranscriptSegment(
                        start=start_ms / 1000.0,
                        end=(start_ms + duration_ms) / 1000.0,
                        text=text
                    ))

            if not segments:
                return None

            full_text = ' '.join(seg.text for seg in segments)

            logger.info(f"成功解析YouTube字幕，共 {len(segments)} 段")
            return TranscriptResult(
                language=language,
                full_text=full_text,
                segments=segments,
                raw={'source': 'youtube_subtitle', 'file': subtitle_file}
            )

        except Exception as e:
            logger.warning(f"解析字幕文件失败: {e}")
            return None
