import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "Cordon - LLM gateway for Cohere",
  description:
    "Intelligent gateway for Cohere APIs. Auth, rate limiting, request coalescing, and semantic caching before upstream calls.",
};

export default function Home() {
  return <LandingPage />;
}
