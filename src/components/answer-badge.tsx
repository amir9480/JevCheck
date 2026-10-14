import type {ReactNode} from 'react'
import {badgeStyle} from '@/lib/color'
import {ICONS} from '@/lib/icon-map'
import type {AnswerOption} from '@/lib/question-types'
import {cn} from '@/lib/utils'

/** An answer shown with its icon and color, so it can be recognized at a glance. */
export function AnswerBadge({
  answer,
  className,
  children
}: {
  answer: Pick<AnswerOption, 'label' | 'color' | 'icon'>
  className?: string
  children?: ReactNode
}) {
  const Icon = answer.icon ? ICONS[answer.icon] : undefined
  const style = badgeStyle(answer.color)
  return (
    <span
      style={style}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        !style && 'bg-muted text-foreground',
        className
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate">{answer.label || 'Untitled'}</span>
      {children}
    </span>
  )
}
