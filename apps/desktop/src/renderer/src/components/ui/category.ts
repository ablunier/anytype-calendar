import type { CategoryHue } from '@renderer/types'

/* Tailwind reads class names as literal strings out of the source, so a hue can never be
 * interpolated into a class (`bg-cat-${hue}` produces no CSS). These maps keep every class
 * spelled out, which is also what makes the set of legal hues checkable by the compiler.
 */

/** Solid category fill — all-day chips, checkbox swatches, event dots. */
export const catBg: Record<CategoryHue, string> = {
  sage: 'bg-cat-sage',
  clay: 'bg-cat-clay',
  ochre: 'bg-cat-ochre',
  mustard: 'bg-cat-mustard',
  dusk: 'bg-cat-dusk',
  denim: 'bg-cat-denim',
  plum: 'bg-cat-plum',
  teal: 'bg-cat-teal',
  rose: 'bg-cat-rose',
  graphite: 'bg-cat-graphite'
}

/** Washed category fill — timed chips, tags, type tiles. */
export const catBgSoft: Record<CategoryHue, string> = {
  sage: 'bg-cat-sage-soft',
  clay: 'bg-cat-clay-soft',
  ochre: 'bg-cat-ochre-soft',
  mustard: 'bg-cat-mustard-soft',
  dusk: 'bg-cat-dusk-soft',
  denim: 'bg-cat-denim-soft',
  plum: 'bg-cat-plum-soft',
  teal: 'bg-cat-teal-soft',
  rose: 'bg-cat-rose-soft',
  graphite: 'bg-cat-graphite-soft'
}

/** Solid category edge — the left rule of a timed object in the week and day views. */
export const catBorder: Record<CategoryHue, string> = {
  sage: 'border-cat-sage',
  clay: 'border-cat-clay',
  ochre: 'border-cat-ochre',
  mustard: 'border-cat-mustard',
  dusk: 'border-cat-dusk',
  denim: 'border-cat-denim',
  plum: 'border-cat-plum',
  teal: 'border-cat-teal',
  rose: 'border-cat-rose',
  graphite: 'border-cat-graphite'
}

/** Category ink — text and icons sitting on a soft fill. */
export const catText: Record<CategoryHue, string> = {
  sage: 'text-cat-sage',
  clay: 'text-cat-clay',
  ochre: 'text-cat-ochre',
  mustard: 'text-cat-mustard',
  dusk: 'text-cat-dusk',
  denim: 'text-cat-denim',
  plum: 'text-cat-plum',
  teal: 'text-cat-teal',
  rose: 'text-cat-rose',
  graphite: 'text-cat-graphite'
}
