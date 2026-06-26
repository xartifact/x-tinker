import { Link, Outlet } from "@tanstack/react-router";
import { Settings, History, Wrench } from "lucide-react";
import { Button } from "./ui/button";

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold no-underline">
            <Wrench className="h-5 w-5 text-primary" />
            <span>x-tinker</span>
          </Link>
          <nav className="flex items-center gap-1 ml-6">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Configuration
              </Button>
            </Link>
            <Link to="/fixes">
              <Button variant="ghost" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                Fix History
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto py-8 px-4">
        <Outlet />
      </main>
    </div>
  );
}