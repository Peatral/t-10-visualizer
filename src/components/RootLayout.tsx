import React from 'react'
import { Outlet } from '@tanstack/react-router'
import { Navbar } from './Navbar'

export const RootLayout: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col bg-[#121212] text-[#e0e0e0]">
      <Navbar />
      <main className="flex-grow overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  )
}
export default RootLayout
