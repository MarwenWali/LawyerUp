import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Profile } from "@/hooks/useProfiles";
import { FileText, User, Briefcase, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CredentialDialogProps {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CredentialDialog({ profile, open, onOpenChange }: CredentialDialogProps) {
  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">{profile.name}'s Credentials</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-heading font-bold">
              {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="font-medium text-foreground">{profile.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />{profile.email}
              </div>
              {profile.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" />{profile.phone}
                </div>
              )}
            </div>
          </div>

          {profile.specialization && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Specialization:</span>
              <span className="font-medium text-foreground">{profile.specialization}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge
              variant={profile.status === "approved" ? "default" : profile.status === "rejected" ? "destructive" : "secondary"}
              className="capitalize"
            >
              {profile.status}
            </Badge>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> License / Credentials
            </p>
            {profile.document_url ? (
              <div className="rounded-lg overflow-hidden border border-border bg-muted">
                <img
                  src={profile.document_url}
                  alt={`${profile.name}'s license`}
                  className="w-full h-auto object-contain max-h-96"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    target.nextElementSibling?.classList.remove("hidden");
                  }}
                />
                <div className="hidden p-8 text-center text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Unable to load license image</p>
                  <a href={profile.document_url} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline mt-1 inline-block">
                    Open document link
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No credentials uploaded yet</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
