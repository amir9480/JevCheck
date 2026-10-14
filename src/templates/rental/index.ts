import {newId} from '@/lib/question-types'
import {gateQuestion, presetAnswers, withGate, type QuestionSetTemplate} from '../types'

export const rental: QuestionSetTemplate = {
  id: 'rental',
  name: 'Rental / real estate',
  description: 'Does this listing fit your budget and must-haves? Flags suspicious or missing details.',
  icon: 'home',
  requireDocuments: false,
  context: `You are helping someone assess a rental or real-estate listing.

The **page** is the listing (price, size, location, amenities, terms, contact details). Judge only what the listing states; if something important is not mentioned (deposit, fees, lease length, utilities), treat it as missing information rather than assuming. If the user supplied **documents**, they describe the person's budget, location and must-have criteria.`,
  questions: () =>
    withGate(
      gateQuestion(
        'Is this page a rental or real-estate listing?',
        'Answer Yes only if the page advertises a specific property for rent or sale.'
      ),
      [
        {
          id: newId(),
          text: 'Is this listing a good match for what I am looking for?',
          type: 'boolean',
          answers: presetAnswers('yes-no')
        },
        {
          id: newId(),
          text: 'How good is the value for the price compared with what the listing offers?',
          type: 'score',
          answers: presetAnswers('poor-excellent')
        },
        {
          id: newId(),
          text: 'Is key information missing from the listing (deposit, fees, lease terms, utilities, exact address)?',
          type: 'boolean',
          answers: presetAnswers('no-yes')
        },
        {
          id: newId(),
          text: 'Does the listing show scam or red-flag signs (pressure to pay upfront, price far below market, vague or inconsistent details)?',
          type: 'boolean',
          answers: presetAnswers('no-yes')
        }
      ]
    )
}
