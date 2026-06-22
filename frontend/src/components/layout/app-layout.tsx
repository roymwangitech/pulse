import { LeftSidebar } from './left-sidebar';
import { RightSidebar } from './right-sidebar';
import { MobileNav } from './mobile-nav';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto flex min-h-screen w-full max-w-[1280px] justify-center gap-0 md:gap-4 lg:gap-6">
        <LeftSidebar />
        <main className="min-h-screen w-full min-w-0 max-w-[600px] border-x-0 border-border sm:border-x lg:max-w-[600px] pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          {children}
        </main>
        <RightSidebar />
      </div>
      <MobileNav />
    </>
  );
}
