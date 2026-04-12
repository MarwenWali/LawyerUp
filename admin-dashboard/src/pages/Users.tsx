import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useProfiles, useDeleteProfile, type Profile } from "@/hooks/useProfiles";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { EditUserDialog } from "@/components/EditUserDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Users() {
  const { data: profiles, isLoading } = useProfiles();
  const deleteProfile = useDeleteProfile();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get("role") || "all";
  const [roleFilter, setRoleFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = (profiles || []).filter((p) => {
    const matchRole = roleFilter === "all" || p.role === roleFilter;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const handleDelete = () => {
    if (deleteId) {
      deleteProfile.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="flex-1 min-h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 md:px-8 py-4 flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">View and manage all users</p>
        </div>
      </header>

      <main className="p-4 md:p-8 space-y-6 max-w-7xl">
        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={roleFilter} onValueChange={setRoleFilter}>
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="all">All ({profiles?.length || 0})</TabsTrigger>
                  <TabsTrigger value="citizen">Citizens ({profiles?.filter(p => p.role === "citizen").length || 0})</TabsTrigger>
                  <TabsTrigger value="lawyer">Lawyers ({profiles?.filter(p => p.role === "lawyer").length || 0})</TabsTrigger>
                  <TabsTrigger value="admin">Admins ({profiles?.filter(p => p.role === "admin").length || 0})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="glass-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{p.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {p.status && (
                            <Badge
                              variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}
                              className="capitalize"
                            >
                              {p.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{p.specialization || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditProfile(p)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteId(p.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </main>

      <EditUserDialog profile={editProfile} open={!!editProfile} onOpenChange={(open) => !open && setEditProfile(null)} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
