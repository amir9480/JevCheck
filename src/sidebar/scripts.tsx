import {createRoot} from 'react-dom/client'
import SidebarApp from './sidebar-app'
import {TooltipProvider} from '@/components/ui/tooltip'
import {ConfirmProvider} from '@/components/confirm-dialog'
import {initTheme} from '@/lib/theme'
import './styles.css'

initTheme()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Sidebar root element not found')
}

// Firefox can open its sidebar without a per-tab URL (from its own sidebar menu): follow the active tab.
const tabIdParam = new URLSearchParams(location.search).get('tabId')
if (tabIdParam) {
  createRoot(rootElement as HTMLElement).render(
    <TooltipProvider>
      <ConfirmProvider>
        <SidebarApp />
      </ConfirmProvider>
    </TooltipProvider>
  )
} else {
  void chrome.tabs.query({active: true, currentWindow: true}).then(([tab]) => {
    if (tab?.id !== undefined) location.replace(`${location.pathname}?tabId=${tab.id}`)
  })
}
