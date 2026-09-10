import type { CSSProperties } from 'react'
import type { IconName } from '../../types'

/* The 49 Lucide glyphs the product uses, vendored under assets/icons. Vite rewrites each
 * to a hashed URL at build time, so the map is resolved statically rather than by string
 * concatenation at runtime. */
const modules = import.meta.glob('../../assets/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const iconUrls: Partial<Record<IconName, string>> = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.svg'.length),
    url
  ])
)

/** The icon steps the system uses. 14 dense rows, 16 controls, 20 headers, 24 empty states. */
export type IconSize = 10 | 11 | 12 | 13 | 14 | 16 | 18 | 20 | 24

const sizeClass: Record<IconSize, string> = {
  10: 'size-icon-10',
  11: 'size-icon-11',
  12: 'size-icon-12',
  13: 'size-icon-13',
  14: 'size-icon-14',
  16: 'size-icon-16',
  18: 'size-icon-18',
  20: 'size-icon-20',
  24: 'size-icon-24'
}

export interface IconProps {
  name: IconName
  size?: IconSize
  /** Accessible name. Omit for decorative glyphs, which are hidden from assistive tech. */
  title?: string
  className?: string
  style?: CSSProperties
}

/**
 * Monochrome glyph tinted with currentColor.
 *
 * The SVG is applied as a mask rather than inlined, so one file serves every colour and
 * the icon inherits its context's text colour — including across a theme switch.
 */
export function Icon({ name, size = 16, title, className, style }: IconProps): React.JSX.Element {
  const url = iconUrls[name]
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`inline-block shrink-0 bg-current ${sizeClass[size]} ${className ?? ''}`}
      style={{
        WebkitMaskImage: `url("${url}")`,
        maskImage: `url("${url}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        ...style
      }}
    />
  )
}
