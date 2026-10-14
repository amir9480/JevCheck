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

const reactRoot = createRoot(rootElement as HTMLElement)
reactRoot.render(
  <TooltipProvider>
    <ConfirmProvider>
      <SidebarApp />
    </ConfirmProvider>
  </TooltipProvider>
)
