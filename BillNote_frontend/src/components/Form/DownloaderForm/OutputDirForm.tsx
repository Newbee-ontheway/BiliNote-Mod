// 下载/导出地址配置 — 点击选择文件夹
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FolderOpen, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOutputDir, updateOutputDir, pickFolder } from '@/services/downloader'

const OutputDirForm = () => {
    const [outputDir, setOutputDir] = useState('')
    const [loading, setLoading] = useState(true)
    const [picking, setPicking] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await getOutputDir()
                setOutputDir(res?.output_dir || '')
            } catch {
                // 使用默认值
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const handlePick = async () => {
        setPicking(true)
        try {
            const res = await pickFolder()
            const path = res?.path
            if (path) {
                setOutputDir(path)
                // 选完直接保存
                await updateOutputDir({ output_dir: path })
                toast.success('已保存')
            }
        } catch {
            toast.error('选择文件夹失败')
        } finally {
            setPicking(false)
        }
    }

    if (loading) return null

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <FolderOpen className="h-4 w-4" />
                下载地址配置
            </div>
            <div className="text-xs text-gray-400">笔记和媒体文件的保存路径</div>

            {/* 当前路径显示 */}
            {outputDir && (
                <div className="flex items-center gap-1.5 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600 break-all">
                    <Check className="h-3 w-3 shrink-0 text-green-500" />
                    {outputDir}
                </div>
            )}

            <Button
                size="sm"
                variant="outline"
                onClick={handlePick}
                disabled={picking}
                className="gap-2"
            >
                <FolderOpen className="h-3.5 w-3.5" />
                {picking ? '选择中...' : outputDir ? '更换文件夹' : '选择文件夹'}
            </Button>
        </div>
    )
}

export default OutputDirForm
