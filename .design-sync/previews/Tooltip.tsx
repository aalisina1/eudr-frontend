import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Button,
} from "eudr-frontend";
import { Info } from "lucide-react";

export const OnButton = () => (
  <TooltipProvider>
    <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
      <Tooltip open>
        <TooltipTrigger render={<Button variant="outline">Geolocation</Button>} />
        <TooltipContent>Plot boundary verified against the 2020 cutoff</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
);

export const OnIcon = () => (
  <TooltipProvider>
    <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
      <Tooltip open>
        <TooltipTrigger
          render={
            <Button size="icon" variant="ghost" aria-label="Info">
              <Info />
            </Button>
          }
        />
        <TooltipContent>Negligible risk: no further mitigation required</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
);
