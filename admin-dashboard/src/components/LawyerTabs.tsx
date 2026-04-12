import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LawyerCard } from "@/components/LawyerCard";
import { EditUserDialog } from "@/components/EditUserDialog";
import { CredentialDialog } from "@/components/CredentialDialog";
import { useUpdateProfile, useDeleteProfile, type Profile } from "@/hooks/useProfiles";
import { Search, Filter } from "lucide-react";
import { AnimatePresence } from "framer-motion";
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

interface LawyerTabsProps {
  profiles: Profile[];
}

const specializations = [
  "All",
  "Constitutional Law",
  "Labor Law",
  "Criminal Law",
  "Family Law",
  "Corporate Law",
  "International Law",
];

export function LawyerTabs({ profiles }: LawyerTabsProps) {
  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("All");
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [credentialProfile, setCredentialProfile] = useState<Profile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const lawyers = profiles.filter((p) => p.role === "lawyer");

  const filtered = lawyers.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase());
    const matchSpec = specFilter === "All" || l.specialization === specFilter;
    return matchSearch && matchSpec;
  });

  const pending = filtered.filter((l) => l.status === "pending");
  const approved = filtered.filter((l) => l.status === "approved");
  const rejected = filtered.filter((l) => l.status === "rejected");

  const handleApprove = (id: string) => updateProfile.mutate({ id, updates: { status: "approved" } });
  const handleReject = (id: string) => updateProfile.mutate({ id, updates: { status: "rejected" } });
  const handleDelete = () => {
    if (deleteId) {
      deleteProfile.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const renderCards = (list: Profile[], showActions: boolean) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
      <AnimatePresence mode="popLayout">
        {list.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-12">No lawyers found</p>
        ) : (
          list.map((p) => (
            <LawyerCard
              key={p.id}
              profile={p}
              onApprove={showActions && p.status === "pending" ? () => handleApprove(p.id) : undefined}
              onReject={showActions && p.status === "pending" ? () => handleReject(p.id) : undefined}
              onEdit={() => setEditProfile(p)}
              onDelete={() => setDeleteId(p.id)}
              onViewCredentials={() => setCredentialProfile(p)}
            />
          ))
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      <div className="space-y-4">
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
          <Select value={specFilter} onValueChange={setSpecFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {specializations.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="pending" className="gap-1.5">
              Pending <span className="text-xs bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5">{pending.length}</span>
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1.5">
              Approved <span className="text-xs bg-success/20 text-success rounded-full px-1.5 py-0.5">{approved.length}</span>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-1.5">
              Rejected <span className="text-xs bg-destructive/20 text-destructive rounded-full px-1.5 py-0.5">{rejected.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">{renderCards(pending, true)}</TabsContent>
          <TabsContent value="approved">{renderCards(approved, false)}</TabsContent>
          <TabsContent value="rejected">{renderCards(rejected, false)}</TabsContent>
        </Tabs>
      </div>

      <EditUserDialog profile={editProfile} open={!!editProfile} onOpenChange={(open) => !open && setEditProfile(null)} />
      <CredentialDialog profile={credentialProfile} open={!!credentialProfile} onOpenChange={(open) => !open && setCredentialProfile(null)} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this user account.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
