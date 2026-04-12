import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import Users from "./Users";
import Settings from "./Settings";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface IndexProps {
  page?: "dashboard" | "users" | "settings";
}

const Index = ({ page = "dashboard" }: IndexProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const renderPage = () => {
    switch (page) {
      case "users": return <Users />;
      case "settings": return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        {renderPage()}
      </div>
    </SidebarProvider>
  );
};

export default Index;
