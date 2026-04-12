import { Mail, Phone, Edit, Trash2, CheckCircle, XCircle, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import type { Profile } from "@/hooks/useProfiles";

interface LawyerCardProps {
  profile: Profile;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewCredentials: () => void;
}

export function LawyerCard({ profile, onApprove, onReject, onEdit, onDelete, onViewCredentials }: LawyerCardProps) {
  const initials = profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card rounded-xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-heading font-bold text-sm">
            {initials}
          </div>
          <div>
            <button
              onClick={onViewCredentials}
              className="font-heading font-semibold text-foreground hover:text-primary transition-colors text-left"
            >
              {profile.name}
            </button>
            {profile.specialization && (
              <div className="flex items-center gap-1 mt-0.5">
                <Briefcase className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{profile.specialization}</span>
              </div>
            )}
          </div>
        </div>
        <Badge
          variant={profile.status === "approved" ? "default" : profile.status === "rejected" ? "destructive" : "secondary"}
          className="text-xs capitalize"
        >
          {profile.status}
        </Badge>
      </div>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{profile.email}</div>
        {profile.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{profile.phone}</div>}
      </div>

      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border">
        {onApprove && (
          <Button size="sm" onClick={onApprove} className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground">
            <CheckCircle className="w-3.5 h-3.5" />Approve
          </Button>
        )}
        {onReject && (
          <Button size="sm" variant="destructive" onClick={onReject} className="gap-1.5">
            <XCircle className="w-3.5 h-3.5" />Reject
          </Button>
        )}
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
