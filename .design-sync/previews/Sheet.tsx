import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
  Button,
  Label,
  Input,
  Textarea,
} from "eudr-frontend";

export const SupplierForm = () => (
  <Sheet open modal={false}>
    <SheetContent side="right" style={{ position: "absolute" }}>
      <SheetHeader>
        <SheetTitle>Edit supplier</SheetTitle>
        <SheetDescription>Update operator details used across due diligence statements.</SheetDescription>
      </SheetHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 16px", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="s-name">Name</Label>
          <Input id="s-name" defaultValue="Fazenda Boa Vista" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="s-country">Country</Label>
          <Input id="s-country" defaultValue="Brazil" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="s-notes">Notes</Label>
          <Textarea id="s-notes" defaultValue="Verified geolocation, low risk." rows={3} />
        </div>
      </div>
      <SheetFooter>
        <Button>Save changes</Button>
        <SheetClose render={<Button variant="outline">Cancel</Button>} />
      </SheetFooter>
    </SheetContent>
  </Sheet>
);
