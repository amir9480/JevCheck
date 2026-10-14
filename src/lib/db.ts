import Dexie, {type EntityTable} from 'dexie'
import type {Evaluation, QuestionSet} from '@/lib/question-types'

export interface StoredDocument {
  id: number
  title: string
  /** Normalized title (trim + lowercase); unique across the library. */
  titleKey: string
  markdown: string
  sourceName: string
  createdAt: number
  updatedAt: number
}

export interface MetaRow {
  key: string
  value: unknown
}

export class DuplicateTitleError extends Error {
  constructor(title: string) {
    super(`A document titled "${title}" already exists.`)
    this.name = 'DuplicateTitleError'
  }
}

export class DuplicateNameError extends Error {
  constructor(name: string) {
    super(`A question set named "${name}" already exists.`)
    this.name = 'DuplicateNameError'
  }
}

export const db = new Dexie('JevCheckDB') as Dexie & {
  documents: EntityTable<StoredDocument, 'id'>
  questionSets: EntityTable<QuestionSet, 'id'>
  evaluations: EntityTable<Evaluation, 'id'>
  meta: EntityTable<MetaRow, 'key'>
}

db.version(1).stores({
  documents: '++id, &titleKey, createdAt'
})
db.version(2)
  .stores({documents: '++id, &titleKey, createdAt'})
  .upgrade((tx) =>
    tx
      .table('documents')
      .toCollection()
      .modify((doc) => {
        doc.included = true
      })
  )
db.version(3)
  .stores({
    documents: '++id, setId, &[setId+titleKey]',
    questionSets: '++id, &nameKey',
    evaluations: '++id, setId, [setId+hash], createdAt',
    meta: 'key'
  })
  // Documents used to be global; they briefly belonged to a set. Nothing is carried over.
  .upgrade((tx) => tx.table('documents').clear())
// Documents are a shared library again: sets reference them by id. Step 4 relaxes the unique
// index so titles can be made unique first (an index cannot be built over duplicates); step 5
// makes it unique again.
db.version(4)
  .stores({documents: '++id, setId, titleKey, createdAt'})
  .upgrade(async (tx) => {
    const docs = await tx.table('documents').toArray()
    const taken = new Set<string>()
    const idsBySet = new Map<number, number[]>()
    for (const doc of docs.sort((a, b) => a.id - b.id)) {
      let title: string = doc.title
      for (let n = 2; taken.has(title.trim().toLowerCase()); n++) title = `${doc.title} (${n})`
      taken.add(title.trim().toLowerCase())
      if (doc.included !== false) idsBySet.set(doc.setId, [...(idsBySet.get(doc.setId) ?? []), doc.id])
      await tx.table('documents').update(doc.id, {title, titleKey: title.trim().toLowerCase()})
    }
    await tx
      .table('questionSets')
      .toCollection()
      .modify((set) => {
        set.documentIds = idsBySet.get(set.id) ?? []
        set.requireDocuments = true
      })
  })
db.version(5).stores({documents: '++id, &titleKey, createdAt'})

/**
 * A unique-index violation. `add` rejects with a ConstraintError, but `update` goes through
 * `Collection.modify`, which wraps it in a ModifyError.
 */
export function isConstraintError(error: unknown): boolean {
  if (error instanceof Dexie.ConstraintError) return true
  return (
    error instanceof Dexie.ModifyError &&
    error.failures.some((failure) => (failure as {name?: string})?.name === 'ConstraintError')
  )
}

export const titleKeyOf = (title: string) => title.trim().toLowerCase()
export const nameKeyOf = (name: string) => name.trim().toLowerCase()

// ---- Onboarding -------------------------------------------------------------------------------

/**
 * Brand-new installs (no sets, no `onboarded` flag) get the onboarding dialog. Databases that
 * already have sets are marked as onboarded so they never see it. Runs on 'ready' so databases
 * that existed before this flag are covered too.
 */
async function markExistingInstall(): Promise<void> {
  await db.transaction('rw', db.meta, db.questionSets, async () => {
    if (await db.meta.get('onboarded')) return
    if ((await db.questionSets.count()) > 0) await db.meta.put({key: 'onboarded', value: true})
  })
}

db.on('ready', () => markExistingInstall().catch(() => undefined))

export const markOnboarded = () => db.meta.put({key: 'onboarded', value: true})

// ---- Consent ----------------------------------------------------------------------------------

/** Bump when the consent text changes materially so everyone is asked again. */
export const CONSENT_VERSION = 1

export const hasAcceptedConsent = async () =>
  (await db.meta.get('consent'))?.value === CONSENT_VERSION

export const acceptConsent = () => db.meta.put({key: 'consent', value: CONSENT_VERSION})

// ---- Documents --------------------------------------------------------------------------------

/** `exceptId` lets a document keep its own title while being edited. */
export async function isTitleTaken(title: string, exceptId?: number): Promise<boolean> {
  const key = titleKeyOf(title)
  if (!key) return false
  const match = await db.documents.where('titleKey').equals(key).first()
  return !!match && match.id !== exceptId
}

/** Returns `base`, or `base (2)`, `base (3)`… until it is free. */
export async function uniqueTitle(base: string): Promise<string> {
  const root = base.trim() || 'Untitled'
  let candidate = root
  for (let n = 2; await isTitleTaken(candidate); n++) candidate = `${root} (${n})`
  return candidate
}

export async function saveDocument(input: {
  title: string
  markdown: string
  sourceName: string
}): Promise<number> {
  const title = input.title.trim()
  const now = Date.now()
  try {
    return await db.documents.add({
      title,
      titleKey: titleKeyOf(title),
      markdown: input.markdown,
      sourceName: input.sourceName,
      createdAt: now,
      updatedAt: now
    } as StoredDocument)
  } catch (error) {
    // The unique index also guards against two dialogs racing for one title.
    if (isConstraintError(error)) throw new DuplicateTitleError(title)
    throw error
  }
}

export async function updateDocument(
  id: number,
  input: {title: string; markdown: string}
): Promise<void> {
  const title = input.title.trim()
  try {
    await db.documents.update(id, {
      title,
      titleKey: titleKeyOf(title),
      markdown: input.markdown,
      updatedAt: Date.now()
    })
  } catch (error) {
    if (isConstraintError(error)) throw new DuplicateTitleError(title)
    throw error
  }
}

/** Sets that reference this document keep the id, so they report it as missing. */
export const deleteDocument = (id: number) => db.documents.delete(id)

/** Ask the browser not to evict our data under storage pressure (best effort). */
export function requestPersistentStorage(): void {
  void navigator.storage?.persist?.().catch(() => undefined)
}
