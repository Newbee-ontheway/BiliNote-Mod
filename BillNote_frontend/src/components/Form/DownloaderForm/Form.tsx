// 下载器 Cookie 设置表单
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getDownloaderCookie, updateDownloaderCookie } from '@/services/downloader'
import { useParams } from 'react-router-dom'
import { videoPlatforms } from '@/constant/note.ts'
import { ExternalLink, ClipboardCopy, Terminal } from 'lucide-react'

const CookieSchema = z.object({
  cookie: z.string().min(10, '请填写有效 Cookie'),
})

// 生成 Console 一键命令（检测平台 → 读取 cookie → POST 到后端）
const CONSOLE_COMMAND = [
  "fetch('http://localhost:8000/api/update_downloader_cookie',",
  "{method:'POST',headers:{'Content-Type':'application/json'},",
  "body:JSON.stringify({platform:",
  "location.hostname.includes('bilibili')?'bilibili':",
  "location.hostname.includes('youtube')?'youtube':",
  "location.hostname.includes('douyin')?'douyin':",
  "location.hostname.includes('kuaishou')?'kuaishou':'unknown',",
  "cookie:document.cookie})})",
  ".then(r=>r.json())",
  ".then(()=>console.log('✅ Cookie 已导入 EverythingNote！切回去即可自动加载'))",
  ".catch(()=>console.log('❌ 导入失败，请确认后端已启动'))",
].join('')

// 各平台帮助链接
const cookieHelpMap: Record<string, { url: string }> = {
  bilibili: { url: 'https://www.bilibili.com' },
  youtube: { url: 'https://www.youtube.com' },
  douyin: { url: 'https://www.douyin.com' },
  kuaishou: { url: 'https://www.kuaishou.com' },
}

const DownloaderForm = () => {
  const form = useForm({
    resolver: zodResolver(CookieSchema),
    defaultValues: { cookie: '' },
  })
  const { id } = useParams()

  const [loading, setLoading] = useState(true)

  // 加载 Cookie（首次 + tab 切回时复用）
  const reloadCookie = async (showToast = false) => {
    if (!id) return
    try {
      const res = await getDownloaderCookie(id)
      const cookie = res?.cookie || ''
      const current = form.getValues('cookie')
      if (cookie && cookie !== current) {
        form.reset({ cookie })
        if (showToast) toast.success('Cookie 已自动加载')
      } else if (!current) {
        form.reset({ cookie })
      }
    } catch {
      // 静默失败
    }
  }

  // 首次加载
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await reloadCookie()
      setLoading(false)
    }
    init()
  }, [id])

  // 切回 tab 时自动检查新 cookie（Console 命令导入后切回来）
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reloadCookie(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [id])

  const onSubmit = async (values: { cookie: string }) => {
    try {
      await updateDownloaderCookie({
        platform: id,
        cookie: String(values.cookie),
      })
      toast.success('保存成功')
    } catch {
      toast.error('保存失败')
    }
  }

  // 复制 Console 命令到剪贴板
  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(CONSOLE_COMMAND)
      toast.success('命令已复制！请到目标网站按 F12 → Console → 粘贴执行', { duration: 4000 })
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  if (loading) return <div className="p-4">加载中...</div>

  const platformLabel = videoPlatforms.find(item => item.value === id)?.label || ''
  const help = id ? cookieHelpMap[id] : undefined

  return (
    <div className="max-w-xl p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="text-lg font-bold">
            设置{platformLabel}下载器 Cookie
          </div>

          <FormField
            control={form.control}
            name="cookie"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel>Cookie</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="粘贴 Cookie 或使用下方一键导入" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit">保存</Button>

          {/* 一键导入引导 */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Terminal className="h-4 w-4 text-blue-500" />
              一键导入 Cookie（推荐）
            </div>

            <div className="space-y-1.5 text-xs text-gray-500 leading-relaxed">
              <div>❶ 打开<strong>{platformLabel || '目标平台'}</strong>并确保已登录</div>
              <div>❷ 按 <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[11px]">F12</kbd> 打开开发者工具 → 切到 <strong>Console/控制台</strong> 标签</div>
              <div>❸ 点击下方按钮复制命令 → 在 Console/控制台 中空白区域粘贴并回车</div>
              <div>❹ 切回此页面，Cookie 将自动加载</div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={copyCommand}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              复制导入命令
            </Button>

            <div className="border-t border-blue-100 pt-2 text-xs text-gray-400">
              支持：B站 · YouTube · 抖音 · 快手（同一条命令通用）
            </div>
          </div>

          {/* 手动获取备选 */}
          {help && (
            <div className="flex flex-col gap-1 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <span>📝 备选：登录后 F12 → Console → 输入 <code className="bg-gray-200 px-1 rounded">document.cookie</code> → 复制结果粘贴到上方输入框</span>
              <a
                href={help.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1 text-blue-500 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                前往{platformLabel}
              </a>
            </div>
          )}
        </form>
      </Form>
    </div>
  )
}

export default DownloaderForm
