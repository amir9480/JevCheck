import {newId} from '@/lib/question-types'
import {gateQuestion, presetAnswers, withGate, type QuestionSetTemplate} from '../types'

export const travel: QuestionSetTemplate = {
  id: 'travel',
  name: 'Travel booking',
  description: 'Is this hotel, flight or tour a good booking? Checks fit, value, fees and cancellation terms.',
  icon: 'plane',
  requireDocuments: false,
  context: `You are helping a traveler evaluate a hotel, flight, rental or tour booking page.

The **page** is the booking or listing. Judge only what the page states. If the total price, fees, cancellation or refund terms, or baggage and check-in rules are not shown, say they are missing rather than assuming. If the user supplied **documents**, they describe the trip (dates, budget, party size, accessibility or other needs).`,
  questions: () =>
    withGate(
      gateQuestion(
        'Is this page a hotel, flight, rental or tour booking or listing?',
        'Answer Yes only if the page offers a specific travel option to book.'
      ),
      [
        {
          id: newId(),
          text: 'Does this option fit my trip needs (dates, location, budget, party, accessibility)?',
          type: 'boolean',
          answers: presetAnswers('yes-no')
        },
        {
          id: newId(),
          text: 'How good is the value for the price?',
          type: 'score',
          answers: presetAnswers('poor-excellent')
        },
        {
          id: newId(),
          text: 'Are there extra or hidden costs (resort or cleaning fees, baggage, taxes added at checkout)?',
          type: 'boolean',
          answers: presetAnswers('no-yes')
        },
        {
          id: newId(),
          text: 'How flexible are the cancellation and refund terms?',
          type: 'choice',
          answers: [
            {id: newId(), label: 'Flexible', description: 'Free or low-cost cancellation', color: '#16a34a', icon: 'check-circle'},
            {id: newId(), label: 'Limited', description: 'Partial refund or a short window', color: '#f59e0b', icon: 'clock'},
            {id: newId(), label: 'Strict', description: 'Non-refundable or not stated', color: '#dc2626', icon: 'x-circle'}
      ]
    }
      ]
    )
}
