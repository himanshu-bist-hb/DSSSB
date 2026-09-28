import { TopBar } from "@/components/TopBar";
import { DoubtClient } from "@/components/doubt/DoubtClient";

export default function DoubtPage() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref="/" eyebrow="Home" title="AI Doubt Solver" />
      <DoubtClient />
    </div>
  );
}
