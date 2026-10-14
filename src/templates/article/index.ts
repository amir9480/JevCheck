import {AMBER, GREEN, RED} from '@/lib/answer-presets'
import {makeAnswer, newId} from '@/lib/question-types'
import {gateQuestion, presetAnswers, withGate, type QuestionSetTemplate} from '../types'

export const article: QuestionSetTemplate = {
  id: 'article',
  name: 'Article credibility',
  description: 'Is this article trustworthy? Checks sourcing, bias and whether claims are supported.',
  icon: 'shield-check',
  requireDocuments: false,
  context: `You are helping a reader judge the credibility of an article or blog post.

The **page** is the article. Evaluate it only on what the text itself shows: named sources, cited evidence, tone, and whether claims are backed up. You cannot verify facts outside the page, so do not claim a statement is true or false; say whether the article supports it.`,
  questions: () =>
    withGate(
      gateQuestion(
        'Is this page an article, blog post or news story?',
        'Answer Yes only if the main content is written editorial text.'
      ),
      [
        {
          id: newId(),
          text: 'Does this article look credible overall?',
          type: 'score',
          answers: presetAnswers('poor-excellent')
        },
        {
          id: newId(),
          text: 'Are the main claims backed by named sources or evidence?',
          type: 'boolean',
          answers: presetAnswers('yes-no')
        },
        {
          id: newId(),
          text: 'How slanted is the article?',
          type: 'choice',
          answers: [
            makeAnswer('Balanced', {description: 'Presents multiple sides fairly', color: GREEN, icon: 'scale'}),
            makeAnswer('Leaning', {description: 'Has a clear viewpoint but stays mostly factual', color: AMBER, icon: 'flag'}),
            makeAnswer('One-sided', {description: 'Persuasion or opinion dominates over facts', color: RED, icon: 'alert-triangle'})
      ]
    },
    {
      id: newId(),
      text: 'Is it worth reading in full?',
      type: 'boolean',
      answers: presetAnswers('yes-no')
    }
      ]
    )
}
