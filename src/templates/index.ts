import {article} from './article'
import {jobFit} from './job-fit'
import {product} from './product'
import {rental} from './rental'
import {seoCheckup} from './seo-checkup'
import {techJob} from './tech-job'
import {termsPrivacy} from './terms-privacy'
import {travel} from './travel'
import type {QuestionSetTemplate} from './types'

export type {QuestionSetTemplate} from './types'

/** Order is the order shown in the pickers. To add a template, create a directory and list it here. */
export const TEMPLATES: QuestionSetTemplate[] = [
  jobFit,
  techJob,
  product,
  rental,
  article,
  termsPrivacy,
  travel,
  seoCheckup
]

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id)
