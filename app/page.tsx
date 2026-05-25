import Hero from "@/components/Hero";
import Trusted from "@/components/Trusted";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Showcase from "@/components/Showcase";
import FeatureBreakdown from "@/components/FeatureBreakdown";
import Screenshots from "@/components/Screenshots";
import Integrations from "@/components/Integrations";
import Comparison from "@/components/Comparison";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Trusted />
      <Features />
      <HowItWorks />
      <Showcase />
      <FeatureBreakdown />
      <Screenshots />
      <Integrations />
      <Comparison />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
    </>
  );
}
