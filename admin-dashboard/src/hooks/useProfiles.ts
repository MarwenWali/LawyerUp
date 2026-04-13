import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAPI } from "@/lib/api";
import { toast } from "sonner";

export type Profile = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: "citizen" | "lawyer" | "admin";
  specialization: string | null;
  status: "pending" | "approved" | "rejected" | "suspended" | "active" | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
  is_verified: boolean;
};

// Map backend response (User row) to Frontend Profile type
function mapUserToProfile(u: any): Profile {
  return {
    id: u.id,
    user_id: u.id,
    name: u.full_name || u.email || 'Unknown',
    email: u.email,
    phone: u.phone_number || null,
    role: u.role === 'user' ? 'citizen' : u.role,
    specialization: u.specialization || null,
    // Map backend status/is_verified to the UI's status field
    status: u.is_verified ? "approved" : (u.status === 'rejected' ? 'rejected' : 'pending'),
    document_url: u.diploma_url || null,
    created_at: u.created_at,
    updated_at: u.created_at, // available fields may vary
    is_verified: !!u.is_verified
  };
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const data = await adminAPI.getUsers();
      const users = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []);
      return users.map(mapUserToProfile);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Profile> }) => {
      // In the modern backend, we update status via specific endpoints
      if (updates.status) {
        if (updates.status === 'approved') {
          return await adminAPI.verifyLawyer(id, 'verify');
        } else if (updates.status === 'rejected') {
          return await adminAPI.verifyLawyer(id, 'reject');
        }
      }
      // General update (if needed)
      // return await adminAPI.updateUser(id, updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Profile status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return await adminAPI.deleteUser(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Profile deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
