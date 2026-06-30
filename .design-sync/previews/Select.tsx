import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  Label,
} from "eudr-frontend";

export const Triggers = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 240 }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label>Commodity</Label>
      <Select defaultValue="coffee">
        <SelectTrigger style={{ width: "100%" }}>
          <SelectValue placeholder="Select commodity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="coffee">Coffee</SelectItem>
          <SelectItem value="cocoa">Cocoa</SelectItem>
          <SelectItem value="wood">Wood</SelectItem>
          <SelectItem value="rubber">Rubber</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label>Risk level</Label>
      <Select>
        <SelectTrigger style={{ width: "100%" }}>
          <SelectValue placeholder="Choose risk level" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="negligible">Negligible</SelectItem>
          <SelectItem value="standard">Standard</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
);

export const Open = () => (
  <Select defaultValue="coffee" defaultOpen>
    <SelectTrigger style={{ width: 220 }}>
      <SelectValue placeholder="Select commodity" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Regulated commodities</SelectLabel>
        <SelectItem value="coffee">Coffee</SelectItem>
        <SelectItem value="cocoa">Cocoa</SelectItem>
        <SelectItem value="wood">Wood</SelectItem>
        <SelectItem value="rubber">Rubber</SelectItem>
        <SelectItem value="palm">Palm oil</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
);
