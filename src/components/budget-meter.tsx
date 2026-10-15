import {Progress} from '@/components/ui/progress'
import {MIN_PAGE_TOKENS, type Budget} from '@/lib/decision/limits'
import {cn} from '@/lib/utils'

/** How much of the model's input limit the set uses, leaving room for the page. */
export function BudgetMeter({budget, className}: {budget: Budget; className?: string}) {
  const usable = Math.max(budget.stateBudget - MIN_PAGE_TOKENS, 1)
  const percent = Math.min(100, Math.round((budget.fixedTokens / usable) * 100))
  const over = budget.headroom < 0
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-medium', over && 'text-destructive')}>
          Context &amp; documents: ~{budget.fixedTokens.toLocaleString()} tokens
        </span>
        <span className="text-muted-foreground">
          {over
            ? `${Math.abs(budget.headroom).toLocaleString()} over`
            : `${budget.headroom.toLocaleString()} left`}
        </span>
      </div>
      <Progress value={percent} className={cn('h-1.5', over && '[&>div]:bg-destructive')} />
      <p className="text-xs text-muted-foreground">
        Questions: ~{(budget.totalQuestionTokens - budget.checkTokens).toLocaleString()} tokens, plus ~
        {budget.checkTokens.toLocaleString()} for the built-in page checks sent with every evaluation
        (mixed content, enough content). About {Math.max(budget.pageBudget, 0).toLocaleString()} tokens
        remain for each page (longer pages are cut in the middle).
      </p>
    </div>
  )
}
