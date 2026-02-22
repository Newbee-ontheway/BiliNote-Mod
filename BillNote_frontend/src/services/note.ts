import request from '@/utils/request'
import toast from 'react-hot-toast'

export const generateNote = async (data: {
  video_url: string
  platform: string
  quality: string
  model_name: string
  provider_id: string
  task_id?: string
  format: Array<string>
  style: string
  extras?: string
  video_understand?: boolean
  video_interval?: number
  grid_size: Array<number>
  summary_level?: string
}) => {
  try {
    console.log('generateNote', data)
    const response = await request.post('/generate_note', data)

    if (!response) {
      if (response.data.msg) {
        toast.error(response.data.msg)
      }
      return null
    }
    toast.success('笔记生成任务已提交！')

    console.log('res', response)
    // 成功提示

    return response
  } catch (e: any) {
    console.error('❌ 请求出错', e)

    // 错误提示
    // toast.error('笔记生成失败，请稍后重试')

    throw e // 抛出错误以便调用方处理
  }
}

export const delete_task = async ({ video_id, platform }) => {
  try {
    const data = {
      video_id,
      platform,
    }
    const res = await request.post('/delete_task', data)


    toast.success('任务已成功删除')
    return res
  } catch (e) {
    toast.error('请求异常，删除任务失败')
    console.error('❌ 删除任务失败:', e)
    throw e
  }
}

export const get_task_status = async (task_id: string) => {
  try {
    // 成功提示

    return await request.get('/task_status/' + task_id)
  } catch (e) {
    console.error('❌ 请求出错', e)

    // 错误提示
    toast.error('笔记生成失败，请稍后重试')

    throw e // 抛出错误以便调用方处理
  }
}

// ==================== Phase 3: 文档/网页/文本笔记 ====================

export const generateNoteFromText = async (data: {
  source_type: string   // "text" / "file" / "url"
  content: string       // 文本内容 / 文件路径 / URL
  title?: string
  model_name: string
  provider_id: string
  style?: string
  summary_level?: string
  extras?: string
  format?: Array<string>
}) => {
  try {
    console.log('generateNoteFromText', data)
    const response = await request.post('/generate_note_from_text', data)

    if (!response) {
      return null
    }
    toast.success('文本笔记生成任务已提交！')
    return response
  } catch (e: any) {
    console.error('❌ 文本笔记请求出错', e)
    throw e
  }
}

// ==================== Phase 4: 笔记对话 ====================

export const chatWithNote = async (data: {
  task_id: string
  message: string
  model_name: string
  provider_id: string
  history?: Array<{ role: string; content: string }>
}) => {
  try {
    const response = await request.post('/chat_with_note', data)
    return response
  } catch (e: any) {
    console.error('❌ 笔记对话请求出错', e)
    throw e
  }
}
