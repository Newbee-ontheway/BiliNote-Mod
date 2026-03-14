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
import { getDownloaderCookie, updateDownloaderCookie, getCookieBrowser, updateCookieBrowser } from '@/services/downloader'
import { useParams } from 'react-router-dom'
import { videoPlatforms } from '@/constant/note.ts'
import { ExternalLink, Terminal, Monitor, X } from 'lucide-react'

const CookieSchema = z.object({
  cookie: z.string().min(10, '请填写有效 Cookie'),
})

// 支持的浏览器列表
const BROWSERS = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'edge', label: 'Edge' },
  { value: 'firefox', label: 'Firefox' },
]

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
  const [activeBrowser, setActiveBrowser] = useState<string | null>(null)
  const [selectedBrowser, setSelectedBrowser] = useState('chrome')

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

  // 加载浏览器设置
  const reloadBrowser = async () => {
    if (!id) return
    try {
      const res = await getCookieBrowser(id)
      setActiveBrowser(res?.browser || null)
    } catch {
      // 静默失败
    }
  }

  // 首次加载
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await reloadCookie()
      await reloadBrowser()
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

  // 启用浏览器 Cookie 自动读取
  const enableBrowserCookie = async () => {
    if (!id) return
    try {
      await updateCookieBrowser({ platform: id, browser: selectedBrowser })
      setActiveBrowser(selectedBrowser)
      toast.success(`已启用从 ${BROWSERS.find(b => b.value === selectedBrowser)?.label} 自动读取 Cookie`, { duration: 3000 })
    } catch {
      toast.error('设置失败')
    }
  }

  // 关闭浏览器 Cookie
  const disableBrowserCookie = async () => {
    if (!id) return
    try {
      await updateCookieBrowser({ platform: id, browser: null })
      setActiveBrowser(null)
      toast.success('已关闭浏览器自动读取')
    } catch {
      toast.error('操作失败')
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

          {/* 方式一：自动从浏览器读取（最推荐） */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-green-200 bg-green-50/50 px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Monitor className="h-4 w-4 text-green-500" />
              自动从浏览器读取（推荐）
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              自动读取本机浏览器的 Cookie，包括所有关键字段。只需确保浏览器已登录{platformLabel || '目标平台'}即可。
            </p>

            {activeBrowser ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  ✅ 已启用: {BROWSERS.find(b => b.value === activeBrowser)?.label}
                </span>
                <button
                  type="button"
                  onClick={disableBrowserCookie}
                  className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                  关闭
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={selectedBrowser}
                  onChange={e => setSelectedBrowser(e.target.value)}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  {BROWSERS.map(b => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-green-300 text-green-600 hover:bg-green-50"
                  onClick={enableBrowserCookie}
                >
                  启用自动读取
                </Button>
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              注意：需要 BiliNote 与浏览器在同一台电脑上运行。
            </p>
          </div>

          {/* 方式二：手动粘贴 Cookie */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Terminal className="h-4 w-4 text-blue-500" />
              手动粘贴 Cookie
            </div>

            {activeBrowser && (
              <p className="text-xs text-amber-600">
                ⚠️ 当前已启用浏览器自动读取，手动粘贴的 Cookie 不会生效。如需使用手动方式，请先关闭上方的自动读取。
              </p>
            )}

            <FormField
              control={form.control}
              name="cookie"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>Cookie</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="粘贴从 Network 抓包获取的 Cookie" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={!!activeBrowser}>保存</Button>

            {/* Network 抓包说明 */}
            <div className="space-y-1.5 text-xs text-gray-500 leading-relaxed border-t border-gray-200 pt-2">
              <div className="font-medium text-gray-600">获取方式：F12 → Network 抓包</div>
              <div>❶ 打开<strong>{platformLabel || '目标平台'}</strong>并确保已登录</div>
              <div>❷ 按 <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[11px]">F12</kbd> → 点击顶部 <strong>Network（网络）</strong> 标签</div>
              <div>❸ 按 <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[11px]">Ctrl+R</kbd> 刷新页面</div>
              <div>❹ 点击左侧列表<strong>第一条请求</strong> → 右侧找到 <strong>Request Headers</strong></div>
              <div>❺ 找到 <code className="bg-gray-200 px-1 rounded">Cookie:</code> 那一行 → <strong>选中整行值</strong> → 复制粘贴到上方输入框</div>
            </div>

            {help && (
              <a
                href={help.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1 text-xs text-blue-500 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                前往{platformLabel}
              </a>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}

export default DownloaderForm
