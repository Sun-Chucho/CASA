"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Building2, Coffee, Download, Lock, Package, ShieldCheck, ShoppingCart, Smartphone, User, Utensils } from "lucide-react";
import { Role } from "@/app/lib/mock-data";
import {
  getDefaultLoginPassword,
  getProfilePassword,
  hydrateLoginProfilesFromServer,
  isProfileUserBlocked,
  MANAGER_SESSION_VERSION,
  readLocalLoginProfiles,
  saveLoginProfileToServer,
  STORAGE_ACTIVE_USERNAME,
  STORAGE_LOGIN_PROFILES,
  STORAGE_MANAGER_SESSION_VERSION,
  upsertProfileUser,
  writeLocalLoginProfiles,
} from "@/app/lib/login-profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { cn } from "@/lib/utils";

interface RoleLoginPageProps {
  role: Role;
}

type LoginConfig = {
  label: string;
  username: string;
  description: string;
  color: string;
  destination: string;
  icon: typeof ShieldCheck;
};

const ROLE_CONFIG: Record<Role, LoginConfig> = {
  manager: {
    label: "Hotel Manager",
    username: "manager",
    description: "Full system oversight and operations control.",
    color: "bg-orange-500",
    destination: "/dashboard",
    icon: ShieldCheck,
  },
  director: {
    label: "Managing Director",
    username: "md",
    description: "Executive overview and strategic read-only controls.",
    color: "bg-emerald-700",
    destination: "/dashboard",
    icon: Building2,
  },
  inventory: {
    label: "Inventory Manager",
    username: "inventory",
    description: "Stock control, movements, and procurement management.",
    color: "bg-black",
    destination: "/dashboard/inventory",
    icon: Package,
  },
  cashier: {
    label: "Reception Booking",
    username: "reception",
    description: "Bookings, guest check-in, and reception payments.",
    color: "bg-orange-600",
    destination: "/dashboard/cashier",
    icon: ShoppingCart,
  },
  kitchen: {
    label: "Kitchen POS",
    username: "kitchen",
    description: "Kitchen orders, queue handling, and stock usage.",
    color: "bg-orange-700",
    destination: "/dashboard/kitchen",
    icon: Utensils,
  },
  barista: {
    label: "Barista POS",
    username: "barista",
    description: "Barista orders, beverage service, and stock usage.",
    color: "bg-orange-400",
    destination: "/dashboard/barista",
    icon: Coffee,
  },
};

export function RoleLoginPage({ role }: RoleLoginPageProps) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  const isDirector = role === "director";
  const isInstallableRole = role === "director" || role === "kitchen" || role === "barista";
  const [shift, setShift] = useState<"day" | "night">("day");
  const [profileUsers, setProfileUsers] = useState<Array<{ name: string; blocked?: boolean }>>([]);
  const [username, setUsername] = useState(config.username);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [installFeedback, setInstallFeedback] = useState("");
  const { installPrompt, isStandaloneApp, promptInstall } = usePwaInstall(isInstallableRole);

  const selectableUsers = useMemo(
    () => profileUsers.filter((user) => !user.blocked),
    [profileUsers],
  );

  useEffect(() => {
    const applyProfiles = () => {
      const profile = readLocalLoginProfiles()?.[role];
      const users = (profile?.users ?? []).map((user) => ({
        name: user.username,
        blocked: user.blocked,
      }));
      const available = users.filter((user) => !user.blocked);
      setProfileUsers(users);
      setUsername((current) => {
        const currentIsAvailable = available.some(
          (user) => user.name.trim().toLowerCase() === current.trim().toLowerCase(),
        );
        return currentIsAvailable
          ? current
          : available[0]?.name ?? profile?.username ?? config.username;
      });
      if (role === "cashier" && (profile?.shift === "day" || profile?.shift === "night")) {
        setShift(profile.shift);
      }
    };

    applyProfiles();
    void hydrateLoginProfilesFromServer().then(applyProfiles);
    const onProfilesUpdated = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key === STORAGE_LOGIN_PROFILES) applyProfiles();
    };
    window.addEventListener("orange-hotel-storage-updated", onProfilesUpdated);
    return () => window.removeEventListener("orange-hotel-storage-updated", onProfilesUpdated);
  }, [config.username, role]);

  const handleInstall = async () => {
    if (installPrompt) {
      const result = await promptInstall();
      setInstallFeedback(result?.outcome === "accepted" ? "The CASSA Hotel app is being installed." : "Installation dismissed.");
      return;
    }
    setInstallFeedback("Open your browser menu and choose Install app or Add to Home Screen.");
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const profiles = readLocalLoginProfiles() ?? {};
    const profile = profiles[role];
    const loginUsername = username.trim() || config.username;
    const expectedPassword = getProfilePassword(profile, loginUsername, getDefaultLoginPassword(role));
    const allowedNames = selectableUsers.map((user) => user.name.trim().toLowerCase());

    if (isProfileUserBlocked(profile, loginUsername)) {
      setError("This user is blocked. Contact the manager.");
      return;
    }
    if (!loginUsername || (allowedNames.length > 0 && !allowedNames.includes(loginUsername.toLowerCase())) || password !== expectedPassword) {
      setError("Invalid username or password.");
      return;
    }

    setError("");
    localStorage.setItem(STORAGE_ACTIVE_USERNAME, loginUsername);
    localStorage.setItem("orange-hotel-role", role);
    if (role === "manager") {
      localStorage.setItem(STORAGE_MANAGER_SESSION_VERSION, MANAGER_SESSION_VERSION);
    } else {
      localStorage.removeItem(STORAGE_MANAGER_SESSION_VERSION);
    }
    if (role === "cashier") {
      localStorage.setItem("orange-hotel-shift", shift);
    } else {
      localStorage.removeItem("orange-hotel-shift");
    }

    const nextEntry = {
      ...upsertProfileUser(profile, loginUsername, {
        password: expectedPassword,
        updatedAt: Date.now(),
      }),
      ...(role === "cashier" ? { shift } : {}),
      updatedAt: Date.now(),
    };
    writeLocalLoginProfiles({ ...profiles, [role]: nextEntry });
    void saveLoginProfileToServer(role, nextEntry);
    window.location.assign(config.destination);
  };

  return (
    <div className={cn("flex min-h-[100dvh] w-full items-center justify-center p-6", isDirector ? "bg-[#f4f7f2]" : "bg-background")}>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className={cn("mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg", config.color)}>
            <Icon className="h-8 w-8" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">CASSA Hotel</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{config.label}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{config.description}</p>
        </div>

        <form className="space-y-5 rounded-2xl border bg-white p-8 shadow-sm" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest">Username</label>
            {selectableUsers.length > 0 ? (
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={username} onChange={(event) => setUsername(event.target.value)}>
                {selectableUsers.map((user) => <option key={user.name} value={user.name}>{user.name}</option>)}
              </select>
            ) : (
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input name="username" className="pl-10" value={username} onChange={(event) => setUsername(event.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input name="password" type="password" className="pl-10" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
            </div>
          </div>

          {role === "cashier" && (
            <Tabs value={shift} onValueChange={(value) => setShift(value as "day" | "night")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="day">Day Shift</TabsTrigger>
                <TabsTrigger value="night">Night Shift</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
          <Button type="submit" className={cn("w-full font-black uppercase tracking-widest", config.color)}>Sign In</Button>
        </form>

        {isInstallableRole && !isStandaloneApp && (
          <div className="mt-4 rounded-xl border bg-white p-4">
            <Button type="button" variant="outline" className="w-full" onClick={() => void handleInstall()}>
              <Download className="mr-2 h-4 w-4" /> Install CASSA Hotel App
            </Button>
            {installFeedback && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Smartphone className="h-4 w-4" />{installFeedback}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
