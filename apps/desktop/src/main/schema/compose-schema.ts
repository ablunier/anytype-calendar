import { setTimeout as sleep } from 'timers/promises'
import {
  LoadSchemaSelection,
  RekeySchemaSelection,
  ResetSchemaSync,
  SaveSchemaSelection,
  SchemaSelectionStore,
  SchemaSyncStore,
  SyncSchema
} from '@anytype-calendar/schema/application'
import type { SchemaApiKeySource } from '@anytype-calendar/schema/domain'
import {
  AnytypeSchemaGateway,
  InMemorySchemaGateway,
  JsonFileSchemaSelectionRepository
} from '@anytype-calendar/schema/infrastructure'
import type { Anytype } from '../anytype/compose-anytype'
import type { AppConfigStore } from '../app-config-file'
import { selectionFileAt } from './selection-storage'

export interface SchemaDeps {
  anytype: Anytype
  apiKeys: SchemaApiKeySource
  appConfig: AppConfigStore
}

export type Schema = ReturnType<typeof composeSchema>

export function composeSchema({ anytype, apiKeys, appConfig }: SchemaDeps) {
  const schemaState = new SchemaSyncStore()
  const gateway =
    anytype.kind === 'real'
      ? new AnytypeSchemaGateway({
          client: anytype.client,
          encodeBase64: (bytes) => Buffer.from(bytes).toString('base64')
        })
      : new InMemorySchemaGateway({ sleep: (ms) => sleep(ms) })

  const repository = new JsonFileSchemaSelectionRepository(selectionFileAt(appConfig))
  const schemaSelection = new SchemaSelectionStore()
  const saveSchemaSelection = new SaveSchemaSelection({ repository, store: schemaSelection })
  return {
    schemaState,
    schemaSync: new SyncSchema({ gateway, apiKeys, store: schemaState }),
    resetSchemaSync: new ResetSchemaSync(schemaState),
    schemaSelection,
    loadSchemaSelection: new LoadSchemaSelection({ repository, store: schemaSelection }),
    saveSchemaSelection,
    rekeySchemaSelection: new RekeySchemaSelection(saveSchemaSelection)
  }
}
