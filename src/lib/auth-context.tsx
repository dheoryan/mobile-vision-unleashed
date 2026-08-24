import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { deleteSubscription } from "@/lib/push.functions";
import { unsubscribeFromPush } from "@/lib/push-subscribe";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const removePushSubscription = useServerFn(deleteSubscription);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe FIRST to avoid race
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") queryClient.clear();
      setSession(s);
      setLoading(false);
    });
    // 2. Then read existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signOut = async () => {
    // Installed apps can keep receiving Web Push after the auth session is
    // gone. Detach this endpoint while the server still knows its owner.
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await removePushSubscription({ data: { endpoint } });
    } catch {
      // Logout must still succeed if the browser or push service is unavailable.
    }
    await supabase.auth.signOut();
    queryClient.clear();
  };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
