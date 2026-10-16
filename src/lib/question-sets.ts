import {useLiveQuery} from 'dexie-react-hooks'
import {MAX_NAME_CHARS} from '@/lib/decision/limits'
import {DuplicateNameError, db, isConstraintError, nameKeyOf, type StoredDocument} from '@/lib/db'
import type {Evaluation, Question, QuestionSet} from '@/lib/question-types'
import type {ImportedConfig} from '@/lib/question-set-config'
import type {QuestionSetTemplate} from '@/templates/types'

export type QuestionSetDraft = Pick<
  QuestionSet,
  'name' | 'context' | 'questions' | 'documentIds' | 'requireDocuments' | 'quickAccess'
>

export async function isNameTaken(name: string, exceptId?: number): Promise<boolean> {
  const key = nameKeyOf(name)
  if (!key) return false
  const match = await db.questionSets.where('nameKey').equals(key).first()
  return !!match && match.id !== exceptId
}

export async function createQuestionSet(draft: QuestionSetDraft): Promise<number> {
  const now = Date.now()
  const name = draft.name.trim()
  try {
    return await db.questionSets.add({
      ...draft,
      name,
      nameKey: nameKeyOf(name),
      createdAt: now,
      updatedAt: now
    } as QuestionSet)
  } catch (error) {
    if (isConstraintError(error)) throw new DuplicateNameError(name)
    throw error
  }
}

/** `base`, or `base (2)`, `base (3)`… until no set uses the name. */
async function freeName(base: string): Promise<string> {
  let name = base
  for (let n = 2; await isNameTaken(name); n++) name = `${base} (${n})`
  return name
}

/** Creates an empty set under a free name and returns it, ready to be edited. */
export async function createBlankSet(): Promise<QuestionSet> {
  const id = await createQuestionSet({
    name: await freeName('New question set'),
    context: '',
    questions: [],
    documentIds: [],
    requireDocuments: true,
    quickAccess: false
  })
  await setActiveSetId(id)
  return (await db.questionSets.get(id))!
}

/** Creates a set from a template (fresh ids, free name), makes it active and returns it. */
export async function createFromTemplate(
  template: QuestionSetTemplate,
  documentIds: number[] = []
): Promise<QuestionSet> {
  const id = await createQuestionSet({
    name: await freeName(template.name),
    context: template.context,
    questions: template.questions(),
    documentIds,
    requireDocuments: template.requireDocuments,
    quickAccess: false
  })
  await setActiveSetId(id)
  return (await db.questionSets.get(id))!
}

/** Fresh question and answer ids; dependency rules are remapped to the new ids. */
function cloneQuestions(questions: Question[]): Question[] {
  const ids = new Map<string, string>()
  for (const q of questions) {
    ids.set(q.id, crypto.randomUUID())
    for (const a of q.answers) ids.set(a.id, crypto.randomUUID())
  }
  return questions.map((q) => ({
    ...q,
    id: ids.get(q.id)!,
    answers: q.answers.map((a) => ({...a, id: ids.get(a.id)!})),
    dependsOn: q.dependsOn && {
      ...q.dependsOn,
      questionId: ids.get(q.dependsOn.questionId) ?? q.dependsOn.questionId,
      answerIds: q.dependsOn.answerIds?.map((id) => ids.get(id) ?? id)
    }
  }))
}

/**
 * Copies a set's name (made unique), context, questions and settings under fresh ids. Documents
 * are deliberately not selected: the user chooses or uploads them for the clone.
 */
export async function cloneQuestionSet(source: QuestionSet): Promise<QuestionSet> {
  // The suffix is kept whole and the source name shortened, so the result fits the name limit.
  const withSuffix = (n: number) => {
    const suffix = n === 1 ? ' (copy)' : ` (copy ${n})`
    return source.name.slice(0, MAX_NAME_CHARS - suffix.length).trimEnd() + suffix
  }
  let name = withSuffix(1)
  for (let n = 2; await isNameTaken(name); n++) name = withSuffix(n)
  const id = await createQuestionSet({
    name,
    context: source.context,
    questions: cloneQuestions(source.questions),
    documentIds: [],
    requireDocuments: source.requireDocuments,
    quickAccess: false
  })
  await setActiveSetId(id)
  return (await db.questionSets.get(id))!
}

/** Creates a set from an imported configuration (fresh ids, free name), makes it active and returns it. */
export async function importQuestionSet(config: ImportedConfig): Promise<QuestionSet> {
  const id = await createQuestionSet({
    name: await freeName(config.name),
    context: config.context,
    questions: cloneQuestions(config.questions),
    documentIds: [],
    requireDocuments: config.requireDocuments,
    quickAccess: false
  })
  await setActiveSetId(id)
  return (await db.questionSets.get(id))!
}

export async function updateQuestionSet(id: number, draft: QuestionSetDraft): Promise<void> {
  const name = draft.name.trim()
  try {
    await db.questionSets.update(id, {
      ...draft,
      name,
      nameKey: nameKeyOf(name),
      updatedAt: Date.now()
    })
  } catch (error) {
    if (isConstraintError(error)) throw new DuplicateNameError(name)
    throw error
  }
}

/** Deletes the set and its saved results. Documents live in the shared library and stay. */
export async function deleteQuestionSet(id: number): Promise<void> {
  await db.transaction('rw', db.questionSets, db.evaluations, db.meta, async () => {
    await db.evaluations.where('setId').equals(id).delete()
    await db.questionSets.delete(id)
    if ((await db.meta.get('activeSetId'))?.value === id) await db.meta.delete('activeSetId')
  })
}

export const setActiveSetId = (id: number) => db.meta.put({key: 'activeSetId', value: id})

/** Sets (name-sorted), the active one (falls back to the first), and loading state. */
export function useQuestionSets() {
  const sets = useLiveQuery(() => db.questionSets.orderBy('nameKey').toArray(), [])
  const activeId = useLiveQuery(
    async () => (await db.meta.get('activeSetId'))?.value as number | undefined,
    []
  )
  const active = sets?.find((s) => s.id === activeId) ?? sets?.[0] ?? null
  return {sets: sets ?? [], active, isLoaded: sets !== undefined}
}

/** The whole document library, oldest first. */
export function useDocuments() {
  return useLiveQuery(async () => (await db.documents.orderBy('createdAt').toArray()), []) as
    | StoredDocument[]
    | undefined
}

/** The set's documents that exist, and the ids that no longer do (deleted from the library). */
export function resolveSetDocuments(
  set: Pick<QuestionSet, 'documentIds'>,
  library: StoredDocument[]
): {found: StoredDocument[]; missing: number[]} {
  const byId = new Map(library.map((d) => [d.id, d]))
  const found: StoredDocument[] = []
  const missing: number[] = []
  for (const id of set.documentIds) {
    const doc = byId.get(id)
    if (doc) found.push(doc)
    else missing.push(id)
  }
  return {found, missing}
}

export function useEvaluations(setId: number | undefined) {
  return useLiveQuery(
    async () =>
      setId === undefined
        ? []
        : await db.evaluations.where('setId').equals(setId).reverse().sortBy('createdAt'),
    [setId]
  ) as Evaluation[] | undefined
}

/** The newest saved result for these inputs (re-runs add more entries under the same hash). */
export const findEvaluation = (setId: number, hash: string) =>
  db.evaluations.where('[setId+hash]').equals([setId, hash]).reverse().first()

export const saveEvaluation = (evaluation: Omit<Evaluation, 'id'>) =>
  db.evaluations.add(evaluation as Evaluation)

export const deleteEvaluation = (id: number) => db.evaluations.delete(id)
