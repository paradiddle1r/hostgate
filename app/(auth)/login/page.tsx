import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your HostGate account",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
