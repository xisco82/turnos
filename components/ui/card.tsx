import * as React from "react"
import { cn } from "./button"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-white text-zinc-950 shadow-sm border border-zinc-200",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

export { Card }
