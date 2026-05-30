import { EamPremiereDashboard } from "@/components/eam-premiere-generale/EamPremiereDashboard";
import { EamPremiereRouteShell } from "@/components/eam-premiere-generale/EamPremiereRouteShell";

export default function EamPremierePage() {
  return (
    <EamPremiereRouteShell>
      <EamPremiereDashboard />
    </EamPremiereRouteShell>
  );
}
