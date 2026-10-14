import {thresholdOf, type Question, type QuestionDependency, type StoredAnswer} from '@/lib/question-types'

type Answers = Record<string, StoredAnswer>

/** Ids of the answers that count as picked/winning for a stored answer. */
function winners(source: Question, answer: StoredAnswer): string[] {
  if (answer.type === 'boolean') {
    const top = source.answers[answer.probability >= 0.5 ? 0 : 1]
    return top ? [top.id] : []
  }
  if (answer.type === 'choice') return [answer.choiceId]
  if (answer.type === 'multi') {
    const threshold = thresholdOf(source)
    return Object.entries(answer.probabilities)
      .filter(([, p]) => p >= threshold)
      .map(([id]) => id)
  }
  return []
}

export function isDependencyMet(
  dep: QuestionDependency,
  source: Question,
  answer: StoredAnswer | undefined
): boolean {
  if (!answer || answer.type === 'refusal') return false
  if (source.type === 'score') {
    return answer.type === 'score' && answer.score >= (dep.minScore ?? 0)
  }
  const allowed = dep.answerIds ?? []
  return winners(source, answer).some((id) => allowed.includes(id))
}

/** What the source question answered, for the "Since … is X" note. */
export function describeAnswer(source: Question, answer: StoredAnswer | undefined): string {
  if (!answer || answer.type === 'refusal') return 'unanswered'
  if (answer.type === 'score') return answer.score.toFixed(1)
  const labels = winners(source, answer).map((id) => source.answers.find((a) => a.id === id)?.label)
  return labels.filter(Boolean).join(', ') || 'none'
}

export interface Visibility {
  hidden: boolean
  /** The failing question at the root of the chain; set when `hidden`. */
  gate?: Question
}

/** Per question id. Chains are transitive: a question whose source is hidden is hidden too. */
export function resolveVisibility(questions: Question[], answers: Answers): Map<string, Visibility> {
  const byId = new Map(questions.map((q) => [q.id, q]))
  const result = new Map<string, Visibility>()
  for (const q of questions) {
    const dep = q.dependsOn
    const source = dep && byId.get(dep.questionId)
    if (!dep || !source) {
      result.set(q.id, {hidden: false})
      continue
    }
    const sourceState = result.get(source.id)
    if (sourceState?.hidden) result.set(q.id, {hidden: true, gate: sourceState.gate})
    else if (isDependencyMet(dep, source, answers[source.id])) result.set(q.id, {hidden: false})
    else result.set(q.id, {hidden: true, gate: source})
  }
  return result
}

/**
 * Drops rules that no longer make sense: the source was deleted, moved after the question,
 * changed type, or lost the answers/level the rule refers to.
 */
export function sanitizeDependencies(questions: Question[]): Question[] {
  let changed = false
  const next = questions.map((q, index) => {
    const dep = q.dependsOn
    if (!dep) return q
    const source = questions.slice(0, index).find((s) => s.id === dep.questionId)
    let valid = !!source
    if (source?.type === 'score') {
      valid = dep.minScore !== undefined && dep.minScore >= 0 && dep.minScore <= source.answers.length - 1
    } else if (source) {
      const ids = dep.answerIds ?? []
      valid = ids.length > 0 && ids.every((id) => source.answers.some((a) => a.id === id))
    }
    if (valid) return q
    changed = true
    return {...q, dependsOn: undefined}
  })
  return changed ? next : questions
}
