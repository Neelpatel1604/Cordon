import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "Cordon - gateway console",
  description: "Live console for the Cordon Cohere gateway: chat, embed, cache, coalescing, and metrics.",
};

export default function ConsolePage() {
  return <Dashboard />;
}
