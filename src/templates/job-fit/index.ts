import {GREEN, RED} from '@/lib/answer-presets'
import {makeAnswer, newId} from '@/lib/question-types'
import {gateQuestion, presetAnswers, withGate, type QuestionSetTemplate} from '../types'

export const jobFit: QuestionSetTemplate = {
  id: 'job-fit',
  name: 'Job fit',
  description: 'Does this job posting suit you? Checks fit, seniority and red flags against your resume.',
  icon: 'briefcase',
  requireDocuments: true,
  documentHint: 'Upload your resume, cover letter or notes. The posting is judged against them.',
  context: `You are helping a job seeker decide whether a job posting suits them.

The **documents** are the job seeker's own material (for example resume, cover letter, notes). The **page** is the job posting being considered. Judge the posting only against what the documents say about the person; do not assume skills they do not mention.`,
  questions: () =>
    withGate(
      gateQuestion(
        'Is this page a job posting?',
        'Answer Yes only if the page describes a specific open job position.'
      ),
      [
        {
          id: newId(),
          text: 'Is this job a good fit for me?',
          type: 'boolean',
          answers: presetAnswers('yes-no')
        },
        {
          id: newId(),
          text: "How well do my documents match this job's requirements?",
          type: 'score',
          answers: presetAnswers('poor-excellent')
        },
        {
          id: newId(),
          text: 'How does the seniority level of this job compare to my experience?',
          type: 'choice',
          answers: [
            makeAnswer('Too junior', {description: 'The role is below my level', color: '#f59e0b', icon: 'arrow-down'}),
            makeAnswer('About right', {description: 'The role matches my level', color: GREEN, icon: 'check-circle'}),
            makeAnswer('Too senior', {description: 'The role is above my level', color: RED, icon: 'arrow-up'})
      ]
    },
    {
      id: newId(),
      text: 'Does the job posting contain red flags (unrealistic demands, vague pay, burnout signals)?',
      type: 'boolean',
      answers: presetAnswers('no-yes')
    }
      ]
    )
}
