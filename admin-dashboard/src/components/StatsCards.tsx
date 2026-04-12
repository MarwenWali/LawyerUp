import { Users, UserCheck, UserCog } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { Profile } from "@/hooks/useProfiles";

interface StatsCardsProps {
  profiles: Profile[];
}

export function StatsCards({ profiles }: StatsCardsProps) {
  const navigate = useNavigate();
  const totalUsers = profiles.length;
  const approvedLawyers = profiles.filter((p) => p.role === "lawyer" && p.status === "approved").length;
  const citizens = profiles.filter((p) => p.role === "citizen").length;

  const stats = [
    { label: "Total Users", value: totalUsers, icon: Users, className: "stat-gradient-1", role: "all" },
    { label: "Approved Lawyers", value: approvedLawyers, icon: UserCheck, className: "stat-gradient-2", role: "lawyer" },
    { label: "Citizens", value: citizens, icon: UserCog, className: "stat-gradient-3", role: "citizen" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          onClick={() => navigate(`/users?role=${stat.role}`)}
          className={`${stat.className} rounded-xl p-5 text-primary-foreground cursor-pointer hover:scale-[1.02] transition-transform`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">{stat.label}</p>
              <p className="text-3xl font-heading font-bold mt-1">{stat.value}</p>
            </div>
            <stat.icon className="w-10 h-10 opacity-30" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
