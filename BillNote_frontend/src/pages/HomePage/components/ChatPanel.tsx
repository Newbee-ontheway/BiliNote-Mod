import { useState, useRef, useEffect, useCallback, FC } from 'react'
import { Send, X, MessageCircle, Loader2, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chatWithNoteSSE } from '@/services/note'
import { useTaskStore } from '@/store/taskStore'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

interface ChatPanelProps {
    taskId: string
    onClose: () => void
}

const ChatPanel: FC<ChatPanelProps> = ({ taskId, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [minimized, setMinimized] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const currentTask = useTaskStore(state => state.getCurrentTask())
    const streamContentRef = useRef('')

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    useEffect(() => {
        if (!minimized) inputRef.current?.focus()
    }, [minimized])

    const sendMessage = async () => {
        const trimmed = input.trim()
        if (!trimmed || isStreaming) return

        const userMsg: ChatMessage = { role: 'user', content: trimmed }
        const historyForApi = messages.map(m => ({ role: m.role, content: m.content }))

        setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }])
        setInput('')
        setIsStreaming(true)
        streamContentRef.current = ''

        try {
            const response = await chatWithNoteSSE({
                task_id: taskId,
                message: trimmed,
                model_name: currentTask?.formData?.model_name || 'deepseek-chat',
                provider_id: currentTask?.formData?.provider_id || '',
                history: historyForApi,
            })

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No reader')

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const data = line.slice(6).trim()
                    if (data === '[DONE]') continue

                    try {
                        const parsed = JSON.parse(data)
                        if (parsed.content) {
                            streamContentRef.current += parsed.content
                            const newContent = streamContentRef.current
                            setMessages(prev => {
                                const newMsgs = prev.slice(0, -1)
                                return [...newMsgs, { role: 'assistant', content: newContent }]
                            })
                        }
                        if (parsed.error) {
                            streamContentRef.current = `❌ 错误: ${parsed.error}`
                            const errContent = streamContentRef.current
                            setMessages(prev => {
                                const newMsgs = prev.slice(0, -1)
                                return [...newMsgs, { role: 'assistant', content: errContent }]
                            })
                        }
                    } catch {
                        // skip malformed JSON
                    }
                }
            }
        } catch (e: any) {
            setMessages(prev => {
                const newMsgs = prev.slice(0, -1)
                return [...newMsgs, { role: 'assistant', content: `❌ 请求失败: ${e.message || '网络错误'}` }]
            })
        } finally {
            setIsStreaming(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    // Floating overlay panel — fixed position, bottom-right
    return (
        <div
            className="fixed bottom-4 right-4 z-50 flex flex-col rounded-xl border border-gray-200 bg-white shadow-2xl"
            style={{
                width: minimized ? '280px' : '420px',
                height: minimized ? 'auto' : '520px',
                transition: 'width 0.2s, height 0.2s',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-white shrink-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageCircle className="h-4 w-4" />
                    笔记对话
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setMinimized(!minimized)}
                        className="rounded p-1 hover:bg-white/20"
                        title={minimized ? '展开' : '最小化'}
                    >
                        <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="rounded p-1 hover:bg-white/20"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {!minimized && (
                <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3 py-3">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-gray-400">
                                <MessageCircle className="h-8 w-8 text-gray-300" />
                                <p>基于笔记内容进行提问</p>
                                <p>长视频会自动检索相关段落</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user'
                                            ? 'bg-blue-500 text-white'
                                            : 'border border-gray-200 bg-gray-50 text-gray-800'
                                            }`}
                                    >
                                        {msg.role === 'assistant' ? (
                                            msg.content ? (
                                                <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0 break-words">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-gray-400">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    思考中...
                                                </div>
                                            )
                                        ) : (
                                            <span className="whitespace-pre-wrap">{msg.content}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input */}
                    <div className="border-t px-3 py-2 shrink-0">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="输入问题... (Enter 发送)"
                                rows={1}
                                className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                disabled={isStreaming}
                            />
                            <Button
                                size="sm"
                                onClick={sendMessage}
                                disabled={!input.trim() || isStreaming}
                                className="h-9 w-9 p-0"
                            >
                                {isStreaming ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export default ChatPanel
