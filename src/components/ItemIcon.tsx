import { useEffect, useState } from 'react'
import type { BuildItem } from '../types/build'
import { buildRePoEArtUrl, buildRePoEItemIconDisplayUrl } from '../lib/repoeAssets'

interface Props {
  item: BuildItem
  size?: number
  className?: string
}

export function ItemIcon({ item, size = 32, className = '' }: Props) {
  const iconDdsFile = item.iconDdsFile
  const [src, setSrc] = useState(() => buildRePoEItemIconDisplayUrl(iconDdsFile))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setSrc(buildRePoEItemIconDisplayUrl(iconDdsFile))
    setFailed(false)
  }, [iconDdsFile])

  if (!iconDdsFile || !src || failed) return null

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`item-icon ${className}`.trim()}
      loading="lazy"
      draggable={false}
      data-art-url={buildRePoEArtUrl(iconDdsFile) ?? undefined}
      onError={() => {
        const repoeUrl = buildRePoEArtUrl(iconDdsFile)
        if (repoeUrl && src !== repoeUrl) {
          setSrc(repoeUrl)
          return
        }
        setFailed(true)
      }}
    />
  )
}
