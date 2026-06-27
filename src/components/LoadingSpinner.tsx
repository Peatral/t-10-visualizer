export function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4 bg-[#121212]">
      <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-semibold tracking-wider uppercase text-gray-500 animate-pulse">{text}</span>
    </div>
  )
}
