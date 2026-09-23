import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * `calendar.ts`'s Galician fallback only ever runs where `Intl` itself has no `gl` data —
 * Electron's bundled Chromium ICU, not Node's (which does carry `gl`, so these tests would
 * otherwise take the ordinary `Intl` branch and never touch the fallback at all). Forcing
 * `supportedLocalesOf` to say `gl` is unsupported, before the module's own locale-support
 * cache is first populated, reproduces that environment.
 */
describe('Galician calendar fallback', () => {
  const realSupportedLocalesOf = Intl.DateTimeFormat.supportedLocalesOf

  beforeEach(() => {
    vi.resetModules()
    Intl.DateTimeFormat.supportedLocalesOf = ((locales: string | string[]) => {
      const requested = Array.isArray(locales) ? locales : [locales]
      return requested.includes('gl') ? [] : realSupportedLocalesOf(locales)
    }) as typeof Intl.DateTimeFormat.supportedLocalesOf
  })

  afterEach(() => {
    Intl.DateTimeFormat.supportedLocalesOf = realSupportedLocalesOf
  })

  test('weekdayNames falls back to the hardcoded Galician names', async () => {
    const { weekdayNames } = await import('./calendar')
    expect(weekdayNames('gl', 'long')).toEqual([
      'luns',
      'martes',
      'mércores',
      'xoves',
      'venres',
      'sábado',
      'domingo'
    ])
    expect(weekdayNames('gl', 'short')).toEqual(['luns', 'mar.', 'mér.', 'xov.', 'ven.', 'sáb.', 'dom.'])
  })

  test('monthLabel and longDate match real Intl Galician wording', async () => {
    const { monthLabel, longDate } = await import('./calendar')
    expect(monthLabel(2026, 8, 'gl')).toBe('setembro de 2026')
    expect(longDate('2024-01-05', 'gl')).toBe('5 de xaneiro de 2024')
  })

  test('shortDate matches real Intl Galician wording', async () => {
    const { shortDate } = await import('./calendar')
    expect(shortDate('2024-01-05', 'gl')).toBe('ven., 5 de xan.')
  })

  test('dayLabel matches real Intl Galician wording', async () => {
    const { dayLabel } = await import('./calendar')
    expect(dayLabel('2026-09-23', 'gl')).toBe('mércores, 23 de setembro de 2026')
  })

  test('weekLabel names the month once inside one, and both across two', async () => {
    const { weekLabel } = await import('./calendar')
    expect(weekLabel('2026-09-21', '2026-09-27', 'gl')).toBe('21–27 de set. de 2026')
    expect(weekLabel('2026-09-28', '2026-10-04', 'gl')).toBe('28 de set.–4 de out. de 2026')
    expect(weekLabel('2026-12-28', '2027-01-03', 'gl')).toBe(
      '28 de dec. de 2026–3 de xan. de 2027'
    )
  })

  test('formatTime uses a.m./p.m. and leaves 24h untouched', async () => {
    const { formatTime } = await import('./calendar')
    expect(formatTime('13:05', '12h', 'gl')).toBe('1:05 p.m.')
    expect(formatTime('00:30', '12h', 'gl')).toBe('12:30 a.m.')
    expect(formatTime('09:00', '24h', 'gl')).toBe('09:00')
  })

  test("does not affect Spanish, which Electron's ICU does carry", async () => {
    const { monthLabel } = await import('./calendar')
    expect(monthLabel(2026, 8, 'es')).toBe('septiembre de 2026')
  })
})
