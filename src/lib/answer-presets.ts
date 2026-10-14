import {makeAnswer, type AnswerOption, type QuestionType} from './question-types'

export const GREEN = '#16a34a'
export const RED = '#dc2626'
export const AMBER = '#f59e0b'
export const ORANGE = '#ea580c'
export const LIME = '#65a30d'
export const GRAY = '#6b7280'

type Seed = Omit<AnswerOption, 'id'>

export interface AnswerPreset {
  id: string
  label: string
  type: QuestionType
  answers: Seed[]
}

export const ANSWER_PRESETS: AnswerPreset[] = [
  {
    id: 'yes-no',
    label: 'Yes / No',
    type: 'boolean',
    answers: [
      {label: 'Yes', color: GREEN, icon: 'check'},
      {label: 'No', color: RED, icon: 'x'}
    ]
  },
  {
    id: 'no-yes',
    label: 'Yes / No (inverted colors)',
    type: 'boolean',
    answers: [
      {label: 'Yes', color: RED, icon: 'alert-triangle'},
      {label: 'No', color: GREEN, icon: 'check'}
    ]
  },
  {
    id: 'yes-no-unsure',
    label: 'Yes / Unsure / No',
    type: 'choice',
    answers: [
      {label: 'Yes', color: GREEN, icon: 'check'},
      {label: 'Unsure', color: AMBER, icon: 'help-circle'},
      {label: 'No', color: RED, icon: 'x'}
    ]
  },
  {
    id: 'pass-fail',
    label: 'Pass / Fail',
    type: 'choice',
    answers: [
      {label: 'Pass', color: GREEN, icon: 'check-circle'},
      {label: 'Fail', color: RED, icon: 'x-circle'}
    ]
  },
  {
    id: 'status',
    label: 'Not started / In progress / Done',
    type: 'choice',
    answers: [
      {label: 'Not started', color: GRAY, icon: 'circle'},
      {label: 'In progress', color: AMBER, icon: 'clock'},
      {label: 'Done', color: GREEN, icon: 'check-circle'}
    ]
  },
  {
    id: 'low-med-high',
    label: 'Low / Medium / High',
    type: 'score',
    answers: [
      {label: 'Low', color: GREEN, icon: 'arrow-down'},
      {label: 'Medium', color: AMBER, icon: 'minus'},
      {label: 'High', color: RED, icon: 'arrow-up'}
    ]
  },
  {
    id: 'work-arrangement',
    label: 'Remote / Hybrid / On-site',
    type: 'multi',
    answers: [
      {label: 'Remote', color: GREEN, icon: 'check'},
      {label: 'Hybrid', color: AMBER},
      {label: 'On-site', color: RED}
    ]
  },
  {
    id: 'poor-excellent',
    label: 'Poor → Excellent (5)',
    type: 'score',
    answers: [
      {label: 'Poor', color: RED, icon: 'thumbs-down'},
      {label: 'Weak', color: ORANGE, icon: 'frown'},
      {label: 'Possible', color: AMBER, icon: 'meh'},
      {label: 'Good', color: LIME, icon: 'smile'},
      {label: 'Excellent', color: GREEN, icon: 'star'}
    ]
  },
  {
    id: 'agree',
    label: 'Strongly disagree → agree (5)',
    type: 'score',
    answers: [
      {label: 'Strongly disagree', color: RED, icon: 'thumbs-down'},
      {label: 'Disagree', color: ORANGE},
      {label: 'Neutral', color: AMBER, icon: 'minus'},
      {label: 'Agree', color: LIME},
      {label: 'Strongly agree', color: GREEN, icon: 'thumbs-up'}
    ]
  }
]

// A multi pick can start from any choice list too.
export const presetsFor = (type: QuestionType) =>
  ANSWER_PRESETS.filter((p) => p.type === type || (type === 'multi' && p.type === 'choice'))

export const buildAnswers = (preset: AnswerPreset): AnswerOption[] =>
  preset.answers.map((seed) => makeAnswer(seed.label, seed))

export interface ColorPalette {
  id: string
  label: string
  /** Colors in order; interpolated or cycled to the number of answers. */
  colors: string[]
  mode: 'gradient' | 'cycle'
}

export const PALETTES: ColorPalette[] = [
  {id: 'traffic', label: 'Traffic light (red → green)', colors: [RED, AMBER, GREEN], mode: 'gradient'},
  {id: 'traffic-rev', label: 'Reverse traffic light', colors: [GREEN, AMBER, RED], mode: 'gradient'},
  {id: 'cool', label: 'Cool gradient', colors: ['#93c5fd', '#3b82f6', '#1e3a8a'], mode: 'gradient'},
  {id: 'warm', label: 'Warm gradient', colors: ['#fcd34d', '#f97316', '#9a3412'], mode: 'gradient'},
  {
    id: 'categorical',
    label: 'Categorical',
    colors: ['#3b82f6', '#a855f7', '#14b8a6', '#f59e0b', '#ec4899', '#84cc16', '#06b6d4', '#f97316'],
    mode: 'cycle'
  },
  {id: 'neutral', label: 'Neutral grays', colors: ['#d1d5db', '#6b7280', '#111827'], mode: 'gradient'}
]

const hexToRgb = (hex: string): number[] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = (rgb: number[]) =>
  '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')

/** One color per answer. Gradient palettes are interpolated across their stops. */
export function paletteColors(palette: ColorPalette, count: number): string[] {
  if (count <= 0) return []
  if (palette.mode === 'cycle') {
    return Array.from({length: count}, (_, i) => palette.colors[i % palette.colors.length])
  }
  if (count === 1) return [palette.colors[0]]
  const stops = palette.colors.map(hexToRgb)
  return Array.from({length: count}, (_, i) => {
    const pos = (i / (count - 1)) * (stops.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(lo + 1, stops.length - 1)
    const t = pos - lo
    return rgbToHex(stops[lo].map((c, k) => c + (stops[hi][k] - c) * t))
  })
}
