import { Film, BarChart3, Home } from "lucide-react";
import { NavLink } from "@/components/NavLink";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border glass">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="h-7 w-7 text-primary" />
          <span className="font-display text-2xl tracking-wider text-foreground">
            CINE<span className="text-primary">AI</span>
          </span>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-2" activeClassName="text-primary bg-primary/10">
            <Home className="h-4 w-4" />
            Home
          </NavLink>
          <NavLink to="/analytics" className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-2" activeClassName="text-primary bg-primary/10">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
