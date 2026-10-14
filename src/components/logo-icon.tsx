import type {SVGProps} from 'react'

/** Square accept/reject mark: a 30° divider with a check above and a cross below. */
export function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="4" />
      <path d="M14.8 1.5 9.2 22.5" strokeWidth="0.9" />
      <path d="m3.8 12.2 2.4 2.4 3.6-4.6" />
      <path d="m15.5 9.5 5 5m0-5-5 5" />
    </svg>
  )
}
