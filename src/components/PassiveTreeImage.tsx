interface Props {
  imageUrl: string
  alt: string
  className?: string
}

export function PassiveTreeImage({ imageUrl, alt, className = 'passive-tree-image' }: Props) {
  return <img className={className} src={imageUrl} alt={alt} loading="lazy" />
}
