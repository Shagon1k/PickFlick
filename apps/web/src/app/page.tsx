import { SERVICE_NAMES, type ServiceStatus } from "@pickflick/contracts";
import { ScaffoldPanel } from "@pickflick/ui";

const status: ServiceStatus = {
  service: SERVICE_NAMES.web,
  status: "scaffold",
};

export default function HomePage() {
  return (
    <ScaffoldPanel eyebrow={`Runtime · ${status.status}`} title="PickFlick">
      <p>The web workspace is ready for its first product slice.</p>
    </ScaffoldPanel>
  );
}
