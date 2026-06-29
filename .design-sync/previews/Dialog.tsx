import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
  Label,
  Input,
} from "eudr-frontend";

export const ConfirmSubmission = () => (
  <Dialog open modal={false}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Submit due diligence statement?</DialogTitle>
        <DialogDescription>
          DDS-2026-0142 will be transmitted to TRACES. Once accepted it can no
          longer be edited.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <Button>Submit to TRACES</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const FormDialog = () => (
  <Dialog open modal={false}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New supplier</DialogTitle>
        <DialogDescription>Add an upstream operator to your due diligence chain.</DialogDescription>
      </DialogHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBlock: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="d-name">Name</Label>
          <Input id="d-name" placeholder="Fazenda Boa Vista" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="d-country">Country of production</Label>
          <Input id="d-country" placeholder="Brazil" />
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <Button>Save supplier</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
