import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { LanguageProvider } from '../context'
import Navbar from '../components/Navbar'

import '../index.css'

const RootLayout = () => {
  return (
    <LanguageProvider>
      <div className="h-full w-full flex flex-col bg-[#121212] text-[#e0e0e0]">
        <Navbar />
        <main className="grow overflow-hidden relative">
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </LanguageProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})