import { TopBar } from "@/components/TopBar";
import { TutorClient } from "@/components/tutor/TutorClient";

export default function TutorPage() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref="/" eyebrow="Home" title="AI Tutor" />
      <TutorClient />
    </div>
  );
}
