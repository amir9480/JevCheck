import {createContext, useContext} from 'react'

/**
 * Where popovers/selects portal to. Inside a modal dialog they must render within the dialog's
 * own DOM, otherwise the dialog's outside-pointer lock makes them unclickable.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null)
export const usePortalContainer = () => useContext(PortalContainerContext)
