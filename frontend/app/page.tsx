import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";
import { CORDON_NAME, CORDON_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: CORDON_NAME,
  description: CORDON_TAGLINE,
};

export default function Home() {
  return <LandingPage />;
}
