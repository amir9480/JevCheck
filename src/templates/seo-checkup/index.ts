import {GREEN, RED} from '@/lib/answer-presets'
import {makeAnswer, newId} from '@/lib/question-types'
import {gateQuestion, presetAnswers, withGate, type QuestionSetTemplate} from '../types'

export const seoCheckup: QuestionSetTemplate = {
  id: 'seo-checkup',
  name: 'SEO content checkup',
  description: 'Reviews the written content for SEO: topic focus, search intent, depth, keyword stuffing and trust signals.',
  icon: 'search',
  requireDocuments: false,
  context: `You are an experienced SEO consultant reviewing a single web page.

The **page** is only the readable text of the page. You cannot see the HTML or source code, meta tags, heading tags, links, images, media, page speed, backlinks or structured data. Judge only the wording itself: what it is about, who it is for, how complete and original it is, how it reads, and the trust signals stated in the text. Do not guess at technical or visual factors.`,
  questions: () =>
    withGate(
      gateQuestion(
        'Is this text meant to rank in search?',
        'Answer Yes for content pages: articles, guides, product, category, service or landing pages. Answer No for login, cart, account, search-result or error pages.'
      ),
      [
        {
          id: newId(),
          text: 'How good is the content for SEO overall?',
          type: 'score',
          answers: presetAnswers('poor-excellent')
        },
        {
          id: newId(),
          text: 'Is it clear which topic or keyword the text targets?',
          type: 'boolean',
          answers: presetAnswers('yes-no')
        },
        {
          id: newId(),
          text: 'What search intent does the page serve?',
          type: 'choice',
          answers: [
            makeAnswer('Informational', {description: 'Answers a question or teaches something', color: '#3b82f6', icon: 'info'}),
            makeAnswer('Commercial', {description: 'Compares options before a purchase', color: '#8b5cf6', icon: 'scale'}),
            makeAnswer('Transactional', {description: 'Aims at a purchase or sign-up', color: GREEN, icon: 'dollar-sign'}),
            makeAnswer('Navigational', {description: 'Helps find a specific site or page', color: '#64748b', icon: 'compass'}),
            makeAnswer('Unclear', {description: 'Mixed or no clear intent', color: RED, icon: 'help-circle'})
          ]
        },
        {
          id: newId(),
          text: 'How thorough and useful is the content for that intent?',
          type: 'score',
          answers: presetAnswers('poor-excellent')
        },
        {
          id: newId(),
          text: 'Does the page show signs of keyword stuffing or thin, generic or repeated content?',
          type: 'boolean',
          answers: presetAnswers('no-yes')
        },
        {
          id: newId(),
          text: 'Does the page show expertise and trust (author, sources, dates, real details)?',
          type: 'boolean',
          answers: presetAnswers('yes-no')
        },
        {
          id: newId(),
          text: 'Which issues does the page have?',
          details: 'Pick only issues visible in the wording itself.',
          type: 'multi',
          threshold: 0.5,
          answers: [
            makeAnswer('Thin content', {icon: 'battery-low'}),
            makeAnswer('Keyword stuffing', {icon: 'ban'}),
            makeAnswer('Duplicate or repeated text', {icon: 'x-circle'}),
            makeAnswer('Vague or generic wording', {icon: 'meh'}),
            makeAnswer('No clear call to action', {icon: 'target'}),
            makeAnswer('No credible sources cited', {icon: 'shield-alert'}),
            makeAnswer('Outdated information', {icon: 'hourglass'}),
            makeAnswer('Missing author or date', {icon: 'user-x'}),
            makeAnswer('Poor readability (long blocks, hard to scan)', {icon: 'eye-off'})
          ]
        }
      ]
    )
}
