import { StatsCards } from "@/components/StatsCards";
import { LawyerTabs } from "@/components/LawyerTabs";
import { useProfiles } from "@/hooks/useProfiles";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Dashboard() {
  const { data: profiles, isLoading } = useProfiles();

  return (
    <div className="flex-1 min-h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 md:px-8 py-4 flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage lawyer applications & users</p>
        </div>
      </header>

      <main className="p-4 md:p-8 space-y-8 max-w-7xl">
        {isLoading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-96 rounded-xl" />
          </div>
        ) : (
          <>
            <StatsCards profiles={profiles || []} />
            <LawyerTabs profiles={profiles || []} />
          </>
        )}
      </main>
    </div>
  );
}
