import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import { 
  Hammer, LayoutDashboard, PlusSquare, FolderOpen, 
  Library, CreditCard, UserCircle, LogOut, Settings, Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Create Project", href: "/create", icon: PlusSquare },
    { name: "My Projects", href: "/projects", icon: FolderOpen },
    { name: "Templates", href: "/templates", icon: Library },
    { name: "Gallery", href: "/gallery", icon: Hammer },
    { name: "Pricing", href: "/pricing", icon: CreditCard },
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
          <Hammer className="h-5 w-5" />
          MakerForge
        </Link>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-4">
          <Show when="signed-in">
            {navigation.slice(0, 4).map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </Show>
          <div className="my-4 border-t border-border/50"></div>
          {navigation.slice(4).map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <Show when="signed-in">
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <UserCircle className="h-full w-full text-muted-foreground p-1" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.fullName || user?.primaryEmailAddress?.emailAddress}
              </p>
              <Link href="/profile" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                <Settings className="h-3 w-3" /> Settings
              </Link>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut({ redirectUrl: "/" })} title="Sign Out">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden w-64 shrink-0 md:block">
        <SidebarContent />
      </div>

      <div className="flex flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-card border-r-border">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
            <Hammer className="h-5 w-5" />
            MakerForge
          </Link>
          
          <Show when="signed-out">
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-up">Sign Up</Link>
              </Button>
            </div>
          </Show>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-6xl w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
