import {newId} from '@/lib/question-types'
import {gateQuestion, presetAnswers, withGate, type QuestionSetTemplate} from '../types'

export const product: QuestionSetTemplate = {
  id: 'product',
  name: 'Product / shopping',
  description: 'Is this product worth buying? Checks price, reviews and hidden costs.',
  icon: 'package',
  requireDocuments: false,
  context: `You are helping a shopper decide whether to buy the product on a web page.

The **page** is a product listing (it may include price, specifications, seller details and customer reviews). Judge only what the page actually states. If a detail such as shipping cost, warranty or return policy is not on the page, say it is missing rather than guessing. If the user supplied **documents**, they describe the shopper's requirements or budget.`,
  questions: () =>
    withGate(
      gateQuestion(
        'Is this page a product page for something that can be bought?',
        'Answer Yes only if the page is a listing for a specific product.'
      ),
      [
        {
          id: newId(),
          text: 'Is this product worth buying?',
          type: 'boolean',
          answers: presetAnswers('yes-no')
        },
        {
          id: newId(),
          text: 'Is the price fair for what is offered?',
          type: 'score',
          answers: presetAnswers('poor-excellent')
        },
        {
          id: newId(),
          text: 'How trustworthy do the reviews and the seller look (fake-review signs, one-sided praise, unknown seller)?',
          type: 'score',
          answers: presetAnswers('poor-excellent')
        },
        {
          id: newId(),
          text: 'Does the page hide or omit costs and risks (extra fees, subscriptions, poor return policy, missing warranty)?',
          type: 'boolean',
          answers: presetAnswers('no-yes')
        }
      ]
    )
}
