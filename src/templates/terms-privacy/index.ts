import {newId} from '@/lib/question-types'
import {gateQuestion, presetAnswers, withGate, type QuestionSetTemplate} from '../types'

export const termsPrivacy: QuestionSetTemplate = {
  id: 'terms-privacy',
  name: 'Terms & privacy',
  description: 'Is this terms of service or privacy policy safe to accept? Flags data sharing and unfair terms.',
  icon: 'lock',
  requireDocuments: false,
  context: `You are helping a user understand a terms of service, privacy policy or similar legal page before they accept it.

The **page** is the legal text. Base every answer only on what the text says; if the text is silent or vague on a point, say so instead of assuming the best or worst. This is a plain-language reading aid, not legal advice.`,
  questions: () =>
    withGate(
      gateQuestion(
        'Is this page a terms of service, privacy policy or similar legal text?',
        'Answer Yes only if the main content is a legal or policy document.'
      ),
      [
        {
          id: newId(),
          text: 'Is this policy acceptable overall for an ordinary user?',
          type: 'score',
          answers: presetAnswers('poor-excellent')
        },
        {
          id: newId(),
          text: 'Does it allow selling or sharing my personal data with third parties (advertisers, partners, data brokers)?',
          type: 'boolean',
          answers: presetAnswers('no-yes')
        },
        {
          id: newId(),
          text: 'Does it automatically renew paid plans or make cancelling or getting a refund hard?',
          type: 'boolean',
          answers: presetAnswers('no-yes')
        },
        {
          id: newId(),
          text: 'Does it contain unusual or one-sided clauses (forced arbitration, broad liability waivers, rights to my content, unilateral changes without notice)?',
          type: 'boolean',
          answers: presetAnswers('no-yes')
        }
      ]
    )
}
