import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '@/lib/api';
import { toast } from 'sonner';

export function useUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const data = await adminAPI.getUsers();
      // Backend returns { users: [...] }
      if (data && Array.isArray(data.users)) return data.users;
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminAPI.getStats(),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}

export function useLogs() {
  return useQuery({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const data = await adminAPI.getLogs();
      // Backend returns { logs: [...] }
      if (data && Array.isArray(data.logs)) return data.logs;
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 10000,
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => adminAPI.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Status updated');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => adminAPI.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('User deleted');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useVerifyLawyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }) => adminAPI.verifyLawyer(id, action),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      const labels = { verify: 'Lawyer verified', reject: 'Lawyer rejected', revoke: 'Verification revoked' };
      toast.success(labels[action] || 'Updated');
    },
    onError: (e) => toast.error(e.message),
  });
}
