'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Download, BrainCircuit, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

interface NoteHeaderProps {
  modelName: string
  style: string
  noteStyles: { value: string; label: string }[]
  onCopy: () => void
  onDownload: (format?: string) => void
  createAt?: string | Date
  showTranscribe: boolean
  setShowTranscribe: (show: boolean) => void
  viewMode: string
  setViewMode: (mode: string) => void
}

const EXPORT_FORMATS = [
  { value: 'md', label: 'Markdown', icon: '📝' },
  { value: 'pdf', label: 'PDF', icon: '📄' },
  { value: 'docx', label: 'Word', icon: '📘' },
] as const

export function MarkdownHeader({
  modelName,
  style,
  noteStyles,
  onCopy,
  onDownload,
  createAt,
  showTranscribe,
  setShowTranscribe,
  viewMode,
  setViewMode,
}: NoteHeaderProps) {
  const [copied, setCopied] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (copied) {
      timer = setTimeout(() => setCopied(false), 2000)
    }
    return () => clearTimeout(timer)
  }, [copied])

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCopy = () => {
    onCopy()
    setCopied(true)
  }

  const styleName = noteStyles.find(v => v.value === style)?.label || style

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    return d
      .toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(/\//g, '-')
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-white/95 px-4 py-2 backdrop-blur-sm">
      {/* 左侧区域：模型 + 风格 + 创建时间 */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-pink-100 text-pink-700 hover:bg-pink-200">
          {modelName}
        </Badge>
        <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200">
          {styleName}
        </Badge>

        {createAt && (
          <span className="text-muted-foreground ml-1 text-xs">创建于 {formatDate(createAt)}</span>
        )}
      </div>

      {/* 右侧操作按钮 */}
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  setViewMode(viewMode == 'preview' ? 'map' : 'preview')
                }}
                variant="ghost"
                size="sm"
                className="h-8 px-2"
              >
                <BrainCircuit className="mr-1.5 h-4 w-4" />
                <span className="text-sm">{viewMode == 'preview' ? '思维导图' : 'markdown'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>思维导图</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleCopy} variant="ghost" size="sm" className="h-8 px-2">
                <Copy className="mr-1.5 h-4 w-4" />
                <span className="text-sm">{copied ? '已复制' : '复制'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>复制内容</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 导出下拉菜单 */}
        <div ref={exportRef} className="relative">
          <Button
            onClick={() => setExportOpen(!exportOpen)}
            variant="ghost"
            size="sm"
            className="h-8 px-2"
          >
            <Download className="mr-1.5 h-4 w-4" />
            <span className="text-sm">导出</span>
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-md border bg-white py-1 shadow-lg">
              {EXPORT_FORMATS.map((fmt) => (
                <button
                  key={fmt.value}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors"
                  onClick={() => {
                    setExportOpen(false)
                    onDownload(fmt.value)
                  }}
                >
                  <span>{fmt.icon}</span>
                  <span>{fmt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  setShowTranscribe(!showTranscribe)
                }}
                variant="ghost"
                size="sm"
                className="h-8 px-2"
              >
                {/*<Download className="mr-1.5 h-4 w-4" />*/}
                <span className="text-sm">原文参照</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>原文参照</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
