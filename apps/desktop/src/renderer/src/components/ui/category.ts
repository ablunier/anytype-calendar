import type { CategoryHue } from '../../types'

/* Tailwind reads class names as literal strings out of the source, so a hue can never be
 * interpolated into a class (`bg-cat-${hue}` produces no CSS). These maps keep every class
 * spelled out, which is also what makes the set of legal hues checkable by the compiler.
 */

/** Solid category fill — all-day chips, checkbox swatches, space dots. */
export const catBg: Record<CategoryHue, string> = {
  sage: 'bg-cat-sage',
  clay: 'bg-cat-clay',
  ochre: 'bg-cat-ochre',
  dusk: 'bg-cat-dusk',
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
  dusk: 'bg-cat-dusk-soft',
  plum: 'bg-cat-plum-soft',
  teal: 'bg-cat-teal-soft',
  rose: 'bg-cat-rose-soft',
  graphite: 'bg-cat-graphite-soft'
}

/** Category ink — text and icons sitting on a soft fill. */
export const catText: Record<CategoryHue, string> = {
  sage: 'text-cat-sage',
  clay: 'text-cat-clay',
  ochre: 'text-cat-ochre',
  dusk: 'text-cat-dusk',
  plum: 'text-cat-plum',
  teal: 'text-cat-teal',
  rose: 'text-cat-rose',
  graphite: 'text-cat-graphite'
}
