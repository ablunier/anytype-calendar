import type { TFunction } from 'i18next'
import type { EventsEditResult } from '@shared/ipc'
import type { EditAccess } from '@renderer/types'

/** What went wrong with an edit, for the toast that reports it. */
export function editFailureText(t: TFunction, result: Exclude<EventsEditResult, { ok: true }>): string {
  switch (result.failure) {
    case 'unauthorized':
      return t('calendar.edit.failure.unauthorized')
    case 'not-granted':
      return t('calendar.edit.failure.notGranted')
    case 'rate-limited':
      return t('calendar.edit.failure.rateLimited')
    case 'unsupported':
      return t('calendar.edit.failure.unsupported')
    case 'unreachable':
      return t('calendar.edit.failure.unreachable')
    case 'gone':
      return t('calendar.edit.failure.gone')
    case 'invalid':
      return t('calendar.edit.failure.invalid')
    case 'rejected':
      return result.message === ''
        ? t('calendar.edit.failure.rejectedSilently')
        : t('calendar.edit.failure.rejected', { message: result.message })
  }
}

/** Why the calendar cannot edit; null when it can. */
export function readOnlyText(t: TFunction, access: EditAccess): string | null {
  switch (access) {
    case 'editable':
      return null
    case 'read-only':
      return t('calendar.edit.readOnly.key')
    case 'needs-v2':
      return t('calendar.edit.readOnly.needsV2')
    case 'checking':
      return t('calendar.edit.readOnly.checking')
  }
}
