import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your HostGate account",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string | string[] };
}) {
  const error = Array.isArray(searchParams?.error) ? searchParams.error[0] : searchParams?.error;
  return <AuthForm mode="login" initialError={error} />;
}
