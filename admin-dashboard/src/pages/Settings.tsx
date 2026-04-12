import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="flex-1 min-h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 md:px-8 py-4 flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your dashboard preferences</p>
        </div>
      </header>

      <main className="p-4 md:p-8 space-y-6 max-w-3xl">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-heading">General</CardTitle>
            <CardDescription>Manage general dashboard settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive email when a new lawyer applies</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-heading">Platform</CardTitle>
            <CardDescription>LawyerUp platform information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Version: 1.0.0</p>
            <p>Environment: Production</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
