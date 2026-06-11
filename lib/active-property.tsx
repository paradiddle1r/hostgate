"use client";

// Client context for the currently-managed property. The server resolves the
// active property from the `hg_active_property` cookie (see
// lib/active-property-server.ts); this provider exposes it to client
// components and lets the property switcher change it: writing the cookie +
// router.refresh() re-runs the server tree against the new property.

import { createContext, useContext, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Property } from "@/lib/db/properties";

interface ActivePropertyValue {
  property: Property;
  properties: Property[];
  plan: string;
  setActiveProperty: (id: string) => void;
}

const ActivePropertyCtx = createContext<ActivePropertyValue | null>(null);

export function useActiveProperty(): ActivePropertyValue {
  const ctx = useContext(ActivePropertyCtx);
  if (!ctx) throw new Error("useActiveProperty must be used inside <ActivePropertyProvider>");
  return ctx;
}

const COOKIE = "hg_active_property";

export function ActivePropertyProvider({
  property,
  properties,
  plan,
  children,
}: {
  property: Property;
  properties: Property[];
  plan: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const setActiveProperty = useCallback(
    (id: string) => {
      if (id === property.id) return;
      // 1-year cookie, lax so it survives normal navigation.
      document.cookie = `${COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      router.refresh();
    },
    [property.id, router]
  );

  return (
    <ActivePropertyCtx.Provider value={{ property, properties, plan, setActiveProperty }}>
      {children}
    </ActivePropertyCtx.Provider>
  );
}
