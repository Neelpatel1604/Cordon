import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";
import { CORDON_NAME, CORDON_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${CORDON_NAME} console`,
  description: CORDON_TAGLINE,
};

export default function ConsolePage() {
  return <Dashboard />;
}
