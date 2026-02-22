/* NoteForm.tsx ---------------------------------------------------- */
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form.tsx'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Info, Loader2, Plus } from 'lucide-react'
import { message, Alert } from 'antd'
import { generateNote, generateNoteFromText } from '@/services/note.ts'
import { uploadFile } from '@/services/upload.ts'
import { useTaskStore } from '@/store/taskStore'
import { useModelStore } from '@/store/modelStore'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { ScrollArea } from '@/components/ui/scroll-area.tsx'
import { Button } from '@/components/ui/button.tsx'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { noteStyles, noteFormats, videoPlatforms } from '@/constant/note.ts'
import { fetchModels } from '@/services/model.ts'
import { useNavigate } from 'react-router-dom'

/* -------------------- Schema -------------------- */
const formSchema = z
    .object({
        video_url: z.string().optional(),
        platform: z.string().nonempty('Please select a platform'),
        quality: z.enum(['fast', 'medium', 'slow']),
        screenshot: z.boolean().optional(),
        link: z.boolean().optional(),
        model_name: z.string().nonempty('Please select a model'),
        format: z.array(z.string()).default([]),
        style: z.string().nonempty('Please select a note style'),
        summary_level: z.string().default('medium'),
        extras: z.string().optional(),
        video_understanding: z.boolean().optional(),
        video_interval: z.coerce.number().min(1).max(30).default(4).optional(),
        grid_size: z
            .tuple([z.coerce.number().min(1).max(10), z.coerce.number().min(1).max(10)])
            .default([3, 3])
            .optional(),
    })
    .superRefine(({ video_url, platform }, ctx) => {
        if (platform === 'local') {
            if (!video_url) {
                ctx.addIssue({ code: 'custom', message: 'Local path required', path: ['video_url'] })
            }
        } else {
            if (!video_url) {
                ctx.addIssue({ code: 'custom', message: 'Video URL required', path: ['video_url'] })
            } else {
                try {
                    const url = new URL(video_url)
                    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
                } catch {
                    ctx.addIssue({ code: 'custom', message: 'Invalid video URL', path: ['video_url'] })
                }
            }
        }
    })

export type NoteFormValues = z.infer<typeof formSchema>

/* -------------------- Sub-components -------------------- */
const SectionHeader = ({ title, tip }: { title: string; tip?: string }) => (
    <div className="my-3 flex items-center justify-between">
        <h2 className="block">{title}</h2>
        {tip && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="hover:text-primary h-4 w-4 cursor-pointer text-neutral-400" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">{tip}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}
    </div>
)

const CheckboxGroup = ({
    value,
    onChange,
    disabledMap = {},
    visibleItems,
}: {
    value: string[]
    onChange: (v: string[]) => void
    disabledMap?: Record<string, boolean>
    visibleItems?: string[]
}) => (
    <div className="flex flex-wrap gap-3 py-1">
        {noteFormats.filter(nf => !visibleItems || visibleItems.includes(nf.value)).map(nf => {
            const checked = value.includes(nf.value)
            const disabled = !!disabledMap[nf.value]
            return (
                <label key={nf.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                        disabled={disabled}
                        checked={checked}
                        onCheckedChange={v => {
                            if (v) onChange([...value, nf.value])
                            else onChange(value.filter(x => x !== nf.value))
                        }}
                    />
                    {nf.label}
                </label>
            )
        })}
    </div>
)

/* -------------------- Main -------------------- */
const NoteForm = () => {
    const navigate = useNavigate()
    const [isUploading, setIsUploading] = useState(false)
    const [uploadSuccess, setUploadSuccess] = useState(false)

    const [inputMode, setInputMode] = useState<'video' | 'text'>('video')
    const [textSourceType, setTextSourceType] = useState<'text' | 'url'>('text')
    const [textContent, setTextContent] = useState('')
    const [textTitle, setTextTitle] = useState('')

    const { addPendingTask, currentTaskId, setCurrentTask, getCurrentTask, retryTask } =
        useTaskStore()
    const { loadEnabledModels, modelList, showFeatureHint, setShowFeatureHint } = useModelStore()

    const form = useForm<NoteFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            platform: 'bilibili',
            quality: 'medium',
            model_name: modelList[0]?.model_name || '',
            style: 'minimal',
            summary_level: 'medium',
            video_interval: 4,
            grid_size: [3, 3],
            format: [],
        },
    })
    const currentTask = getCurrentTask()
    const platform = useWatch({ control: form.control, name: 'platform' }) as string
    const videoUnderstandingEnabled = useWatch({ control: form.control, name: 'video_understanding' })
    const editing = currentTask && currentTask.id

    useEffect(() => { loadEnabledModels() }, [])
    useEffect(() => {
        if (modelList.length > 0 && !form.getValues('model_name')) {
            form.setValue('model_name', modelList[0].model_name)
        }
    }, [modelList])
    useEffect(() => {
        if (currentTask) {
            const raw = currentTask.formData as NoteFormValues | undefined
            if (raw) form.reset(raw)
        }
    }, [currentTask?.id])

    const goModelAdd = () => { navigate('/settings'); setShowFeatureHint(true) }
    const isGenerating = () => !['SUCCESS', 'FAILED', undefined].includes(getCurrentTask()?.status)
    const generating = isGenerating()

    const handleFileUpload = async (file: File, cb: (url: string) => void) => {
        const formData = new FormData()
        formData.append('file', file)
        setIsUploading(true)
        setUploadSuccess(false)
        try {
            const data = await uploadFile(formData)
            cb(data.url)
            setUploadSuccess(true)
        } catch (err) {
            console.error('Upload failed:', err)
        } finally {
            setIsUploading(false)
        }
    }

    const onSubmit = async (values: NoteFormValues) => {
        if (inputMode === 'text') {
            if (!textContent.trim()) { message.error('Please enter text or a URL'); return }
            const pid = modelList.find(m => m.model_name === values.model_name)?.provider_id || ''
            try {
                const data = await generateNoteFromText({
                    source_type: textSourceType,
                    content: textContent,
                    title: textTitle || undefined,
                    model_name: values.model_name,
                    provider_id: pid,
                    style: values.style,
                    summary_level: values.summary_level || 'medium',
                    extras: values.extras,
                    format: values.format,
                })
                if (data?.task_id) addPendingTask(data.task_id, 'text', values)
            } catch (e) { console.error('Text note failed', e) }
            return
        }
        const payload: NoteFormValues = {
            ...values,
            provider_id: modelList.find(m => m.model_name === values.model_name)!.provider_id,
            task_id: currentTaskId || '',
        }
        if (currentTaskId) { retryTask(currentTaskId, payload); return }
        const data = await generateNote(payload)
        addPendingTask(data.task_id, values.platform, payload)
    }

    const onInvalid = (errors: any) => console.warn('Validation failed:', errors)
    const handleCreateNew = () => setCurrentTask(null)

    const FormButton = () => {
        const label = generating ? 'Generating...' : editing ? 'Regenerate' : 'Generate Note'
        return (
            <div className="flex gap-2">
                <Button type="submit" className={!editing ? 'w-full' : 'w-2/3' + ' bg-primary'} disabled={generating}>
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {label}
                </Button>
                {editing && (
                    <Button type="button" variant="outline" className="w-1/3" onClick={handleCreateNew}>
                        <Plus className="mr-2 h-4 w-4" />
                        New
                    </Button>
                )}
            </div>
        )
    }

    return (
        <div className="h-full w-full">
            <Form {...form}>
                <form onSubmit={(e) => {
                    e.preventDefault()
                    if (inputMode === 'text') {
                        onSubmit(form.getValues())
                    } else {
                        form.handleSubmit(onSubmit, onInvalid)()
                    }
                }} className="space-y-4">
                    <FormButton />

                    {/* Mode toggle */}
                    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                        <button type="button" onClick={() => setInputMode('video')}
                            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${inputMode === 'video' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            Video Note
                        </button>
                        <button type="button" onClick={() => setInputMode('text')}
                            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${inputMode === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            Text / URL
                        </button>
                    </div>

                    {/* Text mode input */}
                    {inputMode === 'text' && (
                        <div className="space-y-3">
                            <SectionHeader title="Input Source" tip="Paste text or a URL" />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setTextSourceType('text')}
                                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${textSourceType === 'text' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                    Plain Text
                                </button>
                                <button type="button" onClick={() => setTextSourceType('url')}
                                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${textSourceType === 'url' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                    Web URL
                                </button>
                            </div>
                            {textSourceType === 'url' ? (
                                <Input placeholder="https://example.com/article" value={textContent} onChange={e => setTextContent(e.target.value)} />
                            ) : (
                                <Textarea className="min-h-[120px]" placeholder="Paste text content here..." value={textContent} onChange={e => setTextContent(e.target.value)} />
                            )}
                            <Input placeholder="Note title (optional)" value={textTitle} onChange={e => setTextTitle(e.target.value)} />
                        </div>
                    )}

                    {/* Video mode input */}
                    {inputMode === 'video' && (
                        <>
                            <SectionHeader title="Video Link" tip="Supports Bilibili, YouTube, etc." />
                            <div className="flex gap-2">
                                <FormField control={form.control} name="platform" render={({ field }) => (
                                    <FormItem>
                                        <Select disabled={!!editing} value={field.value} onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {videoPlatforms?.map(p => (
                                                    <SelectItem key={p.value} value={p.value}>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="h-4 w-4">{p.logo()}</div>
                                                            <span>{p.label}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage style={{ display: 'none' }} />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="video_url" render={({ field }) => (
                                    <FormItem className="flex-1">
                                        {platform === 'local' ? (
                                            <Input disabled={!!editing} placeholder="Local video path" {...field} />
                                        ) : (
                                            <Input disabled={!!editing} placeholder="Video URL" {...field} />
                                        )}
                                        <FormMessage style={{ display: 'none' }} />
                                    </FormItem>
                                )} />
                            </div>

                            <FormField control={form.control} name="video_url" render={({ field }) => (
                                <FormItem className="flex-1">
                                    {platform === 'local' && (
                                        <div
                                            className="hover:border-primary mt-2 flex h-40 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 transition-colors"
                                            onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                                            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFileUpload(f, field.onChange) }}
                                            onClick={() => {
                                                const inp = document.createElement('input')
                                                inp.type = 'file'
                                                inp.accept = 'video/*,audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac,.wma,.opus'
                                                inp.onchange = ev => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleFileUpload(f, field.onChange) }
                                                inp.click()
                                            }}
                                        >
                                            {isUploading ? (
                                                <p className="text-center text-sm text-blue-500">Uploading...</p>
                                            ) : uploadSuccess ? (
                                                <p className="text-center text-sm text-green-500">Upload successful!</p>
                                            ) : (
                                                <p className="text-center text-sm text-gray-500">
                                                    Drag files here <br />
                                                    <span className="text-xs text-gray-400">or click to select</span>
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <SectionHeader title="Video Understanding" tip="Screenshot analysis via multimodal model" />
                            <div className="flex flex-col gap-2">
                                <FormField control={form.control} name="video_understanding" render={() => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <FormLabel>Enable</FormLabel>
                                            <Checkbox checked={videoUnderstandingEnabled} onCheckedChange={v => form.setValue('video_understanding', v)} />
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="video_interval" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Interval (s)</FormLabel>
                                            <Input disabled={!videoUnderstandingEnabled} type="number" {...field} />
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="grid_size" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Grid (col x row)</FormLabel>
                                            <div className="flex items-center space-x-2">
                                                <Input disabled={!videoUnderstandingEnabled} type="number" value={field.value?.[0] || 3}
                                                    onChange={e => field.onChange([+e.target.value, field.value?.[1] || 3])} className="w-16" />
                                                <span>x</span>
                                                <Input disabled={!videoUnderstandingEnabled} type="number" value={field.value?.[1] || 3}
                                                    onChange={e => field.onChange([field.value?.[0] || 3, +e.target.value])} className="w-16" />
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <Alert closable type="error" message={<div><strong>Note:</strong><p>Requires multimodal model.</p></div>} className="text-sm" />
                            </div>
                        </>
                    )}

                    {/* Shared: Model + Style + Summary Level */}
                    <div className="grid grid-cols-2 gap-2">
                        {modelList.length > 0 ? (
                            <FormField className="w-full" control={form.control} name="model_name" render={({ field }) => (
                                <FormItem>
                                    <SectionHeader title="Model" tip="Different models, different results" />
                                    <Select onOpenChange={() => loadEnabledModels()} value={field.value} onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full min-w-0 truncate"><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {modelList.map(m => (<SelectItem key={m.id} value={m.model_name}>{m.model_name}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        ) : (
                            <FormItem>
                                <SectionHeader title="Model" tip="Different models, different results" />
                                <Button type="button" variant="outline" onClick={goModelAdd}>Add model first</Button>
                                <FormMessage />
                            </FormItem>
                        )}

                        <FormField className="w-full" control={form.control} name="style" render={({ field }) => (
                            <FormItem>
                                <SectionHeader title="Note Style" tip="Presentation style" />
                                <Select value={field.value} onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="w-full min-w-0 truncate"><SelectValue /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {noteStyles.map(({ label, value }) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                    </div>

                    {/* Extra Notes with format checkboxes */}
                    <FormField control={form.control} name="extras" render={({ field }) => (
                        <FormItem>
                            <SectionHeader title="Extra Notes" tip="Format options and custom instructions" />
                            <FormField control={form.control} name="format" render={({ field: fmtField }) => (
                                <CheckboxGroup value={fmtField.value} onChange={fmtField.onChange}
                                    visibleItems={inputMode === 'text' ? ['toc', 'summary'] : undefined}
                                    disabledMap={{ link: platform === 'local', screenshot: !videoUnderstandingEnabled }} />
                            )} />
                            <Textarea placeholder="Key points to cover..." {...field} />
                            <FormMessage />
                        </FormItem>
                    )} />
                </form>
            </Form>
        </div>
    )
}

export default NoteForm
