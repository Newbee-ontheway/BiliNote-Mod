import ProviderCard from '@/components/Form/DownloaderForm/providerCard.tsx'
import { videoPlatforms } from '@/constant/note.ts'
import OutputDirForm from '@/components/Form/DownloaderForm/OutputDirForm.tsx'

const Provider = () => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-sm font-light mb-2">下载器配置</div>
        <div>
          {videoPlatforms &&
            videoPlatforms.map((provider, index) => {
              if (provider.value !== 'local')
                return (
                  <ProviderCard
                    key={index}
                    providerName={provider.label}
                    Icon={provider?.logo}
                    id={provider.value}
                  />
                )
            })}
        </div>
      </div>
      <OutputDirForm />
    </div>
  )
}
export default Provider
