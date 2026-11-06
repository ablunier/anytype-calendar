import type { DateMapping, ObjectType, TypePicks } from '@renderer/types'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTypeSelection } from './useTypeSelection'

const TASK: ObjectType = {
  key: 'sp_1:task',
  space: 'sp_1',
  label: 'Task',
  category: 'denim',
  icon: 'calendar',
  props: [
    { key: 'due_date', label: 'Due date' },
    { key: 'start_date', label: 'Start date' },
    { key: 'end_date', label: 'End date' },
  ],
  selects: [],
  checkboxes: [],
  texts: [],
  panelProps: [],
  from: 'due_date',
  to: null,
  includesTime: false,
  colourBy: null,
  panel: [],
  done: null,
  location: null,
}

const NOTE: ObjectType = { ...TASK, key: 'sp_1:note', label: 'Note' }
const MEETING: ObjectType = { ...TASK, key: 'sp_2:meeting', space: 'sp_2', label: 'Meeting' }

const RANGE: DateMapping = {
  from: 'start_date',
  to: 'end_date',
  includesTime: false,
  colourBy: null,
  panel: [],
  done: null,
  location: null,
  view: null,
}

const NOTHING_PICKED: TypePicks = { spaceKeys: [], typeKeys: [], dates: {} }

function renderSelection(types: ObjectType[], initial: TypePicks = NOTHING_PICKED) {
  return renderHook(({ types }) => useTypeSelection(types, initial), { initialProps: { types } })
}

describe('useTypeSelection', () => {
  it('adds a space or a type on toggle, and removes it on the next', () => {
    const { result } = renderSelection([TASK])
    act(() => result.current.toggleSpace('sp_1'))
    act(() => result.current.toggleType('sp_1:task'))
    expect(result.current.spaceKeys).toEqual(['sp_1'])
    expect(result.current.typeKeys).toEqual(['sp_1:task'])
    act(() => result.current.toggleSpace('sp_1'))
    act(() => result.current.toggleType('sp_1:task'))
    expect(result.current.spaceKeys).toEqual([])
    expect(result.current.typeKeys).toEqual([])
  })

  it('clears To when From is set to the date To names', () => {
    const { result } = renderSelection([TASK], { ...NOTHING_PICKED, dates: { 'sp_1:task': RANGE } })
    act(() => result.current.setFrom('sp_1:task', 'end_date'))
    expect(result.current.mappingFor(TASK)).toMatchObject({ from: 'end_date', to: null })
  })

  it('keeps To when From is set to another date', () => {
    const { result } = renderSelection([TASK], { ...NOTHING_PICKED, dates: { 'sp_1:task': RANGE } })
    act(() => result.current.setFrom('sp_1:task', 'due_date'))
    expect(result.current.mappingFor(TASK)).toMatchObject({ from: 'due_date', to: 'end_date' })
  })

  it('counts as active only the selected types inside a selected space', () => {
    const { result } = renderSelection([TASK, NOTE, MEETING], {
      ...NOTHING_PICKED,
      spaceKeys: ['sp_1'],
      typeKeys: ['sp_1:task', 'sp_2:meeting'],
    })
    expect(result.current.activeTypes).toEqual([TASK])
  })

  it('drops an entry whose date a re-read takes away, so the type falls back to its own dates', () => {
    const { result, rerender } = renderSelection([TASK], { ...NOTHING_PICKED, dates: { 'sp_1:task': RANGE } })
    const withoutEnd: ObjectType = { ...TASK, props: TASK.props.filter((prop) => prop.key !== 'end_date') }
    rerender({ types: [withoutEnd] })
    expect(result.current.picks.dates).toEqual({})
    expect(result.current.mappingFor(withoutEnd)).toMatchObject({ from: 'due_date', to: null })
  })

  it('keeps the entry of a type the re-read no longer has', () => {
    const { result, rerender } = renderSelection([TASK, NOTE], {
      ...NOTHING_PICKED,
      dates: { 'sp_1:task': RANGE, 'sp_1:note': RANGE },
    })
    const withoutEnd: ObjectType = { ...TASK, props: TASK.props.filter((prop) => prop.key !== 'end_date') }
    rerender({ types: [withoutEnd] })
    expect(result.current.picks.dates).toEqual({ 'sp_1:note': RANGE })
  })

  it('leaves the picks the same object when a re-read changes nothing', () => {
    const { result, rerender } = renderSelection([TASK, NOTE], { ...NOTHING_PICKED, dates: { 'sp_1:task': RANGE } })
    const before = result.current.picks
    rerender({ types: [{ ...TASK }, { ...NOTE }] })
    expect(result.current.picks).toBe(before)
  })
})
