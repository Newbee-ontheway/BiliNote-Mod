"""
GPU / CUDA 环境自动检测。
启动时调用 detect_best_device() 即可。

faster-whisper 使用 CTranslate2 作为推理后端，
所以 GPU 支持取决于 CTranslate2 是否支持 CUDA，不是 onnxruntime。
"""
import subprocess
import logging
import ctypes
import os

logger = logging.getLogger(__name__)

CUDA_TOOLKIT_URL = "https://developer.nvidia.com/cuda-downloads"


# ── 检测逻辑 ─────────────────────────────────────────────────

def has_nvidia_gpu() -> bool:
    """检测系统是否有 NVIDIA 显卡（通过 nvidia-smi）"""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            gpu_name = result.stdout.strip().split("\n")[0]
            logger.info(f"✅ 检测到 NVIDIA GPU: {gpu_name}")
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return False


def has_cuda_runtime() -> bool:
    """检测 CUDA 运行时是否可用"""
    try:
        result = subprocess.run(
            ["nvidia-smi"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and "CUDA Version" in result.stdout:
            for line in result.stdout.split("\n"):
                if "CUDA Version" in line:
                    logger.info(f"✅ {line.strip()}")
                    return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return False


def has_ctranslate2_cuda() -> bool:
    """检测 CTranslate2 是否支持 CUDA（faster-whisper 的推理后端）"""
    try:
        import ctranslate2
        cuda_types = ctranslate2.get_supported_compute_types("cuda")
        if cuda_types:
            logger.info(f"✅ CTranslate2 CUDA 支持: {cuda_types}")
            return True
    except Exception:
        pass
    return False


def inject_nvidia_dll_paths() -> bool:
    """
    扫描所有已安装的 nvidia pip 包（cudnn, cublas, cuda_runtime 等），
    把它们的 bin/ 和 lib/ 目录加到 PATH 里，让 CTranslate2 找得到 DLL。
    返回是否找到了 nvidia 包。
    """
    try:
        import nvidia
        nvidia_root = list(nvidia.__path__)[0]
    except ImportError:
        logger.info("nvidia pip 包未安装")
        return False

    found_any = False
    # 遍历 nvidia 命名空间下的所有子包（cudnn, cublas, cuda_runtime 等）
    for entry in os.listdir(nvidia_root):
        pkg_dir = os.path.join(nvidia_root, entry)
        if not os.path.isdir(pkg_dir):
            continue
        for subdir in ["bin", "lib"]:
            dll_dir = os.path.join(pkg_dir, subdir)
            if os.path.isdir(dll_dir) and dll_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = dll_dir + os.pathsep + os.environ.get("PATH", "")
                logger.info(f"✅ 已添加到 PATH: {dll_dir}")
                found_any = True

    return found_any


# ── 向后兼容 ──────────────────────────────────────────────────

def is_cuda_available() -> bool:
    """CUDA 是否真正可用（有 GPU + CUDA + nvidia DLL + CTranslate2 支持）"""
    if not (has_nvidia_gpu() and has_cuda_runtime()):
        return False
    inject_nvidia_dll_paths()
    return has_ctranslate2_cuda()


def is_torch_installed() -> bool:
    try:
        import torch
        return True
    except ImportError:
        return False


# ── 主入口 ────────────────────────────────────────────────────

def ensure_optimal_runtime() -> None:
    """
    启动时调用一次。检测硬件环境，注入 NVIDIA DLL 路径，打印状态报告。
    不自动启用 CUDA — 用户需在 .env 中设置 WHISPER_DEVICE=cuda 手动启用。
    """
    gpu = has_nvidia_gpu()
    cuda = has_cuda_runtime() if gpu else False

    if not gpu:
        logger.info("💻 未检测到 NVIDIA GPU，使用 CPU 模式")
        return

    if not cuda:
        print("\n" + "=" * 70)
        print("⚠️  检测到 NVIDIA 显卡，但系统未安装 CUDA 驱动")
        print("   当前使用 CPU 模式，语音转文字速度较慢")
        print("")
        print("   👉 安装 CUDA 后可提速 5-10 倍：")
        print(f"      {CUDA_TOOLKIT_URL}")
        print("")
        print("   安装完成后重启本程序即可自动启用 GPU 加速")
        print("=" * 70 + "\n")
        return

    # 注入所有 nvidia pip 包的 DLL 路径（cuDNN, cuBLAS 等）
    nvidia_found = inject_nvidia_dll_paths()
    ct2 = has_ctranslate2_cuda()

    whisper_device = os.environ.get("WHISPER_DEVICE", "cpu")

    if nvidia_found and ct2:
        if whisper_device == "cuda":
            print("\n" + "=" * 70)
            print("🚀 GPU 加速已启用！语音转文字将使用 CUDA 加速")
            print("=" * 70 + "\n")
        else:
            print("\n" + "=" * 70)
            print("✅ 检测到 GPU + CUDA，环境就绪")
            print("   当前使用 CPU 模式（稳定）")
            print("")
            print("   👉 如需启用 GPU 加速，在 .env 文件中添加：")
            print("      WHISPER_DEVICE=cuda")
            print("=" * 70 + "\n")
    elif not nvidia_found:
        print("\n" + "=" * 70)
        print("⚠️  检测到 GPU + CUDA，但缺少 CUDA 运行时库 (cuDNN/cuBLAS)")
        print("   当前使用 CPU 模式")
        print("")
        print("   👉 一条命令安装所有 CUDA 依赖（在 backend 目录下运行）：")
        print("      .venv\\Scripts\\pip install nvidia-cudnn-cu12 nvidia-cublas-cu12")
        print("=" * 70 + "\n")
    else:
        print("\n" + "=" * 70)
        print("⚠️  检测到 GPU + CUDA，但 CTranslate2 不支持 CUDA")
        print("   可能需要重装 ctranslate2：")
        print("   pip install ctranslate2 --force-reinstall")
        print("=" * 70 + "\n")

