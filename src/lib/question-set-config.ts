import type {z} from 'zod'
import {sanitizeDependencies} from '@/lib/dependencies'
import {ICONS} from '@/lib/icon-map'
import {
  CONFIG_COMMENT,
  CONFIG_FORMAT,
  CONFIG_VERSION,
  SCHEMA_URL,
  configSchema,
  headerSchema,
  type QuestionSetConfig
} from '@/lib/question-set-schema'
import type {Question, QuestionSet} from '@/lib/question-types'

/** Export (download / copy) and import (+ → Import) of question sets. Format: question-set-schema.ts. */

/** What an import produces: a draft for `importQuestionSet` (which refreshes the ids). */
export type ImportedConfig = Pick<QuestionSet, 'name' | 'context' | 'requireDocuments' | 'questions'>

export class ConfigError extends Error {}

/** Documents, quick access and timestamps are local to this browser and never exported. */
export function exportConfig(set: ImportedConfig): string {
  // Key order is the file's order: the note first, then `$schema` for editor autocomplete.
  const config: QuestionSetConfig = {
    $comment: CONFIG_COMMENT,
    $schema: SCHEMA_URL,
    format: CONFIG_FORMAT,
    version: CONFIG_VERSION,
    name: set.name,
    context: set.context,
    requireDocuments: set.requireDocuments,
    questions: set.questions.map(exportQuestion) as QuestionSetConfig['questions']
  }
  return JSON.stringify(config, null, 2) + '\n'
}

/** Drops empty and irrelevant fields so the output stays tidy and matches the schema. */
function exportQuestion(q: Question): Question {
  return {
    id: q.id,
    text: q.text,
    ...(q.details ? {details: q.details} : {}),
    type: q.type,
    answers: q.answers.map((a) => ({
      id: a.id,
      label: a.label,
      ...(a.description ? {description: a.description} : {}),
      ...(a.color ? {color: a.color} : {}),
      ...(a.icon ? {icon: a.icon} : {})
    })),
    ...(q.type === 'multi' && q.threshold !== undefined ? {threshold: q.threshold} : {}),
    ...(q.dependsOn ? {dependsOn: q.dependsOn} : {})
  }
}

export function configFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'question-set'}.jevcheck.json`
}

type Raw = Record<string, unknown>

/** Upgrades a version N-1 object to version N, keyed by N. Empty until version 2 exists. */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {}

/** Parses and validates pasted or uploaded text. Throws `ConfigError` with a user-facing message. */
export function parseConfig(text: string): ImportedConfig {
  if (!text.trim()) throw new ConfigError('Paste a configuration or choose a file.')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ConfigError('This is not valid JSON.')
  }
  const header = headerSchema.safeParse(raw)
  if (!header.success) throw new ConfigError('This is not a Jev Check question set configuration.')
  if (header.data.version > CONFIG_VERSION) {
    throw new ConfigError(
      'This configuration was made by a newer version of Jev Check. Update the extension to import it.'
    )
  }
  let current = raw as Raw
  for (let v = header.data.version + 1; v <= CONFIG_VERSION; v++) current = MIGRATIONS[v](current)

  const result = configSchema.safeParse(current)
  if (!result.success) throw new ConfigError(describeIssue(result.error.issues[0]))
  const config = result.data

  const questions = config.questions.map((q): Question => ({
    ...q,
    // Unknown icons (e.g. from a newer icon list) are dropped instead of failing.
    answers: q.answers.map(({icon, ...a}) => (icon && icon in ICONS ? {...a, icon} : a))
  }))
  const ids = new Set<string>()
  for (const q of questions) {
    for (const id of [q.id, ...q.answers.map((a) => a.id)]) {
      if (ids.has(id)) throw new ConfigError(`The id "${id}" is used more than once.`)
      ids.add(id)
    }
  }
  return {
    name: config.name,
    context: config.context,
    requireDocuments: config.requireDocuments,
    // Rules that point nowhere are dropped, like in the editor.
    questions: sanitizeDependencies(questions)
  }
}

/** `questions.2.answers.0.label` → `Question 3, answer 1, "label"`. */
function describeIssue(issue: z.core.$ZodIssue): string {
  const parts: string[] = []
  const path = issue.path
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    const next = path[i + 1]
    if ((key === 'questions' || key === 'answers') && typeof next === 'number') {
      parts.push(`${key === 'questions' ? 'Question' : 'answer'} ${next + 1}`)
      i++
    } else {
      parts.push(`"${String(key)}"`)
    }
  }
  const where = parts.join(', ')
  return where ? `${where[0].toUpperCase()}${where.slice(1)}: ${issue.message}` : issue.message
}
