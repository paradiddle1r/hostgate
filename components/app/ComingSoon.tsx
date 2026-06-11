"use client";

import { Hammer } from "lucide-react";
import EmptyState from "@/components/app/ui/EmptyState";
import { useAppT } from "@/lib/app-i18n";

// Placeholder for PMS pages still being built (rooms/guests/calendar land in
// later milestones). Keeps the nav from 404-ing meanwhile.
export default function ComingSoon() {
  const t = useAppT();
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <EmptyState icon={<Hammer size={22} />} title={t("common.comingSoon")} hint={t("common.comingSoonHint")} />
    </div>
  );
}
