import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup)

// jsdom lays nothing out, so it leaves scrolling unimplemented; the time grid scrolls on mount.
Element.prototype.scrollTo ??= () => {}
// The combobox keeps its active option in view on every render while open.
Element.prototype.scrollIntoView ??= () => {}
