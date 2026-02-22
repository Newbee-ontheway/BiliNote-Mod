import request from '@/utils/request.ts'

export const getDownloaderCookie = async id => {
  return await request.get('/get_downloader_cookie/' + id)
}

export const updateDownloaderCookie = async (data: { cookie: string; platform: any }) => {
  return await request.post('/update_downloader_cookie', data)
}

export const getOutputDir = async () => {
  return await request.get('/get_output_dir')
}

export const updateOutputDir = async (data: { output_dir: string }) => {
  return await request.post('/update_output_dir', data)
}

export const pickFolder = async () => {
  return await request.get('/pick_folder')
}

export const exportFile = async (data: { content: string; filename: string; is_base64?: boolean; format?: string }) => {
  return await request.post('/export_file', data)
}
