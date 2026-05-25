import type { Metadata } from "next";
import VerifyEmailClient from "./VerifyEmailClient";

export const metadata: Metadata = {
  title: "Check your inbox",
};

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  return <VerifyEmailClient email={searchParams.email ?? ""} />;
}
