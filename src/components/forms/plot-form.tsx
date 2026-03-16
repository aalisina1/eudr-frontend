"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/api/client";

const plotSchema = z.object({
  supplier_id: z.string().uuid("Select a valid supplier"),
  country: z.string().min(2, "Country code is required (e.g. GH, BR)"),
  region: z.string().optional(),
  area_hectares: z.number().positive("Area must be positive"),
  geometry_source: z.enum(["GPS_DEVICE", "SATELLITE_IMAGERY", "MANUAL_ENTRY", "THIRD_PARTY", "DATA_IMPORT"]),
  accuracy_meters: z.number().nonnegative().nullable().optional(),
  collection_date: z.string().optional(),
  external_id: z.string().optional(),
  geometry_json: z.string().min(1, "GeoJSON geometry is required").refine(
    (val) => {
      try {
        const parsed = JSON.parse(val);
        return parsed.type && parsed.coordinates;
      } catch {
        return false;
      }
    },
    { message: "Invalid GeoJSON — must have 'type' and 'coordinates'" },
  ),
});

type PlotFormValues = z.infer<typeof plotSchema>;

interface PlotFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlotForm({ open, onOpenChange }: PlotFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlotFormValues>({
    resolver: zodResolver(plotSchema),
    defaultValues: {
      supplier_id: "",
      country: "",
      region: "",
      area_hectares: 0,
      geometry_source: "MANUAL_ENTRY",
      accuracy_meters: null,
      collection_date: new Date().toISOString().split("T")[0],
      external_id: "",
      geometry_json: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: PlotFormValues) => {
      const { geometry_json, ...rest } = values;
      const geometry = JSON.parse(geometry_json);
      const res = await authFetch("/api/v1/geolocation/plots/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, geometry }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Failed to create plot");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plots"] });
      onOpenChange(false);
      reset();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add Land Plot</SheetTitle>
          <SheetDescription>
            Register a new geo-referenced parcel. Paste GeoJSON geometry below.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 px-4 flex-1 overflow-y-auto"
        >
          <div className="space-y-1.5">
            <Label htmlFor="supplier_id">Supplier ID *</Label>
            <Input id="supplier_id" {...register("supplier_id")} placeholder="Supplier UUID" />
            {errors.supplier_id && <p className="text-xs text-destructive">{errors.supplier_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="country">Country (ISO) *</Label>
              <Input id="country" {...register("country")} placeholder="e.g. GH" maxLength={3} />
              {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">Region</Label>
              <Input id="region" {...register("region")} placeholder="e.g. Ashanti" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="area_hectares">Area (ha) *</Label>
              <Input id="area_hectares" type="number" step="0.0001" {...register("area_hectares", { valueAsNumber: true })} />
              {errors.area_hectares && <p className="text-xs text-destructive">{errors.area_hectares.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accuracy_meters">Accuracy (m)</Label>
              <Input id="accuracy_meters" type="number" step="0.1" {...register("accuracy_meters", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="geometry_source">Geometry Source</Label>
            <select
              id="geometry_source"
              {...register("geometry_source")}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="GPS_DEVICE">GPS Device</option>
              <option value="SATELLITE_IMAGERY">Satellite Imagery</option>
              <option value="MANUAL_ENTRY">Manual Entry</option>
              <option value="THIRD_PARTY">Third Party</option>
              <option value="DATA_IMPORT">Data Import</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="collection_date">Collection Date</Label>
            <Input id="collection_date" type="date" {...register("collection_date")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="external_id">External ID</Label>
            <Input id="external_id" {...register("external_id")} placeholder="Optional reference" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="geometry_json">GeoJSON Geometry *</Label>
            <Textarea
              id="geometry_json"
              {...register("geometry_json")}
              placeholder='{"type": "Polygon", "coordinates": [[[lng, lat], ...]]}'
              rows={6}
              className="font-mono text-xs"
            />
            {errors.geometry_json && <p className="text-xs text-destructive">{errors.geometry_json.message}</p>}
            <p className="text-xs text-muted-foreground">
              Paste a GeoJSON geometry object (Polygon or MultiPolygon).
            </p>
          </div>

          {mutation.error && (
            <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
          )}

          <SheetFooter className="px-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create Plot"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
