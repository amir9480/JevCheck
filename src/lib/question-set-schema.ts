import {z} from 'zod'
import {
  MAX_CHOICES,
  MAX_DESCRIPTION_CHARS,
  MAX_DETAILS_CHARS,
  MAX_LABEL_CHARS,
  MAX_LEVELS,
  MAX_MULTI,
  MAX_NAME_CHARS,
  MAX_QUESTION_CHARS,
  MAX_QUESTIONS,
  MIN_LEVELS
} from '@/lib/decision/limits'
import {ICON_NAMES} from '@/lib/icon-map'

/**
 * Shareable question set configuration: the zod schema validates imports, and `pnpm schema`
 * (`scripts/generate-schema.ts`) turns it into `public/schema/question-set.v<N>.json`, the file
 * `$schema` points at for editor autocomplete.
 *
 * Compatibility rules (also in CLAUDE.md):
 * - `version` is the format version. Adding an optional field keeps it (regenerate the schema);
 *   renaming, removing or changing a field bumps it, adds a migration from N-1 in `MIGRATIONS`
 *   (question-set-config.ts) and a new schema file. Old schema files and migrations stay forever.
 * - Unknown fields are ignored on import, so files written by a newer build of the same version
 *   still load. A newer version is rejected with an "update the extension" message.
 */
export const CONFIG_VERSION = 1
export const CONFIG_FORMAT = 'jevcheck-question-set'
export const SCHEMA_URL = `https://raw.githubusercontent.com/amir9480/JevCheck/main/public/schema/question-set.v${CONFIG_VERSION}.json`
export const CONFIG_COMMENT =
  'Jev Check question set configuration. To use it, install the Jev Check browser extension (https://github.com/amir9480/JevCheck), click + and choose "Import".'

const id = z.string().min(1, 'must be non-empty text').describe('Unique id within the file.')

const answerSchema = z
  .object({
    id,
    label: z.string().min(1, 'must not be empty').max(MAX_LABEL_CHARS),
    description: z.string().max(MAX_DESCRIPTION_CHARS).optional().describe('Shown under the label.'),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #16a34a')
      .optional()
      .describe('Hex color, e.g. #16a34a.'),
    // Unknown names (e.g. from a newer icon list) are dropped on import instead of failing.
    icon: z.string().optional().meta({description: 'Lucide icon name.', examples: ICON_NAMES})
  })
  .meta({id: 'Answer'})

const dependencySchema = z
  .object({
    questionId: id.describe('An earlier question.'),
    answerIds: z
      .array(id)
      .min(1)
      .optional()
      .describe('boolean / choice: the top answer is one of these. multi: any of these is picked.'),
    minScore: z.int().min(0).optional().describe('score: the level index (0 = lowest) must be at least this.')
  })
  .meta({id: 'Dependency', description: 'Show this question only when an earlier question was answered this way.'})

const questionBase = {
  id,
  text: z.string().min(1, 'must not be empty').max(MAX_QUESTION_CHARS).describe('The question.'),
  details: z
    .string()
    .max(MAX_DETAILS_CHARS)
    .optional()
    .describe('Extra instructions for the model. Never shown in the side panel.'),
  dependsOn: dependencySchema.optional()
}

const questionSchema = z
  .discriminatedUnion('type', [
    z.object({
      ...questionBase,
      type: z.literal('boolean').describe('Yes / no.'),
      answers: z.array(answerSchema).length(2).describe('Exactly two: yes first, then no.')
    }),
    z.object({
      ...questionBase,
      type: z.literal('choice').describe('Pick one answer.'),
      answers: z.array(answerSchema).min(1).max(MAX_CHOICES)
    }),
    z.object({
      ...questionBase,
      type: z.literal('score').describe('A level on an ordered scale.'),
      answers: z.array(answerSchema).min(MIN_LEVELS).max(MAX_LEVELS).describe('Lowest to highest.')
    }),
    z.object({
      ...questionBase,
      type: z.literal('multi').describe('Each answer is judged on its own.'),
      answers: z.array(answerSchema).min(1).max(MAX_MULTI),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Answers at or above this probability count as picked. Default 0.5.')
    })
  ])
  .meta({id: 'Question'})

export const configSchema = z
  .object({
    $comment: z.string().optional(),
    $schema: z.string().optional(),
    format: z.literal(CONFIG_FORMAT),
    version: z.literal(CONFIG_VERSION),
    name: z.string().trim().min(1, 'must not be empty').max(MAX_NAME_CHARS).describe('Question set name.'),
    context: z.string().default('').describe('Markdown given to the model before the documents and the page.'),
    requireDocuments: z
      .boolean()
      .default(false)
      .describe('Block evaluation until the user adds at least one document to the set.'),
    questions: z.array(questionSchema).min(1).max(MAX_QUESTIONS)
  })
  .meta({
    title: 'Jev Check question set',
    description: CONFIG_COMMENT
  })

export type QuestionSetConfig = z.input<typeof configSchema>

/** Read first, so a newer or foreign file gets a clear message instead of a schema error. */
export const headerSchema = z.object({
  format: z.literal(CONFIG_FORMAT),
  version: z.int().min(1)
})

export function questionSetJsonSchema() {
  const {$schema, ...rest} = z.toJSONSchema(configSchema, {io: 'input', target: 'draft-2020-12'})
  return {$schema, $id: SCHEMA_URL, ...rest}
}
