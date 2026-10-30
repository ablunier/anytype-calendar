import type { AppConfigStore } from '../app-config-file'
import { DEFAULT_CALENDAR_VIEW, toCalendarView } from './calendar-view'
import { sameCalendarVisibility, SHOWING_EVERYTHING, toCalendarVisibility } from './calendar-visibility'
import { toLanguage, type LanguageState } from './language'
import { preference } from './preference'
import { toTheme, type ThemeState } from './theme'
import { DEFAULT_TIME_FORMAT, toTimeFormat } from './time-format'
import { DEFAULT_WEEK_START, toWeekStart } from './week-start'
import { toWeekNumbers } from './week-numbers'

export type Preferences = ReturnType<typeof composePreferences>

/** The section names are what the app config file already holds: renaming one loses it. */
export function composePreferences(config: AppConfigStore) {
  return {
    theme: preference<ThemeState>({ config, section: 'theme', initial: null, parse: toTheme }),
    language: preference<LanguageState>({ config, section: 'language', initial: null, parse: toLanguage }),
    weekNumbers: preference({ config, section: 'weekNumbers', initial: false, parse: toWeekNumbers }),
    calendarVisibility: preference({
      config,
      section: 'calendarVisibility',
      initial: SHOWING_EVERYTHING,
      parse: toCalendarVisibility,
      equals: sameCalendarVisibility
    }),
    weekStart: preference({ config, section: 'weekStart', initial: DEFAULT_WEEK_START, parse: toWeekStart }),
    calendarView: preference({
      config,
      section: 'calendarView',
      initial: DEFAULT_CALENDAR_VIEW,
      parse: toCalendarView
    }),
    timeFormat: preference({ config, section: 'timeFormat', initial: DEFAULT_TIME_FORMAT, parse: toTimeFormat })
  }
}
