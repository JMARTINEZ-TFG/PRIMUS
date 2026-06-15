import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileText, Loader2, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/receipts")({
  component: Receipts,
});

type Receipt = { id: string; emisor: string; monto: string; venc: string; estado: "Pendiente" | "Pagado" | "Vencido" };

const initial: Receipt[] = [
  { id: "CMP-00481", emisor: "EPEC", monto: "ARS 24.580", venc: "03 Dic 2025", estado: "Pendiente" },
  { id: "CMP-00480", emisor: "Ecogas", monto: "ARS 12.300", venc: "07 Dic 2025", estado: "Pendiente" },
  { id: "CMP-00479", emisor: "Visa Galicia", monto: "ARS 187.420", venc: "10 Dic 2025", estado: "Pendiente" },
  { id: "CMP-00478", emisor: "Aguas Cordobesas", monto: "ARS 8.940", venc: "22 Nov 2025", estado: "Pagado" },
  { id: "CMP-00477", emisor: "Cablevisión", monto: "ARS 18.730", venc: "15 Nov 2025", estado: "Vencido" },
];

function Receipts() {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dup, setDup] = useState(false);

  const handleFiles = () => {
    setLoading(true);
    setDup(false);
    setTimeout(() => {
      setLoading(false);
      // Simulate duplicate detection
      setDup(true);
      toast.warning("Comprobante duplicado detectado.", { description: "EPEC 03 Dic ya está cargado." });
    }, 1800);
  };

  const addNew = () => {
    setDup(false);
    const next: Receipt = { id: `CMP-00482`, emisor: "Telecom", monto: "ARS 9.420", venc: "12 Dic 2025", estado: "Pendiente" };
    setItems([next, ...items]);
    toast.success("Comprobante procesado por OCR.");
  };

  const estadoBadge = (e: Receipt["estado"]) => {
    const map = {
      Pendiente: { c: "bg-warning/15 text-warning", I: Clock },
      Pagado: { c: "bg-success/10 text-success", I: CheckCircle2 },
      Vencido: { c: "bg-destructive/10 text-destructive", I: XCircle },
    }[e];
    return (
      <Badge variant="secondary" className={`gap-1 rounded-full ${map.c}`}>
        <map.I className="h-3 w-3" /> {e}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(); }}
        className={`rounded-2xl border-2 border-dashed p-10 text-center shadow-[var(--shadow-soft)] transition ${dragging ? "border-primary bg-primary/5" : "border-border bg-card"}`}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-sm font-semibold">Procesando OCR…</div>
            <p className="text-xs text-muted-foreground">Extrayendo emisor, monto, fecha de vencimiento y código de pago.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <div className="text-base font-semibold">Arrastrá tu factura o resumen acá</div>
            <p className="max-w-md text-sm text-muted-foreground">
              Aceptamos PDF, JPG y PNG. Nuestro motor OCR extrae automáticamente todos los campos.
            </p>
            <div className="mt-2 flex gap-2">
              <Button onClick={handleFiles} className="rounded-xl">
                <FileText className="mr-1 h-4 w-4" /> Seleccionar archivo
              </Button>
            </div>
          </div>
        )}
      </Card>

      {dup && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
          <div className="flex-1">
            <div className="text-sm font-semibold">Comprobante duplicado detectado</div>
            <p className="text-xs text-muted-foreground">
              Detectamos un comprobante idéntico (EPEC — ARS 24.580 — Venc. 03 Dic 2025). Cargarlo distorsionaría tu proyección de cash flow.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setDup(false)}>Descartar</Button>
            <Button size="sm" className="rounded-xl" onClick={addNew}>Cargar otro</Button>
          </div>
        </div>
      )}

      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Historial de Comprobantes</h3>
            <p className="text-xs text-muted-foreground">{items.length} comprobantes procesados</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>ID</TableHead>
                <TableHead>Emisor</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                  <TableCell className="font-medium">{r.emisor}</TableCell>
                  <TableCell className="text-right font-semibold">{r.monto}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{r.venc}</TableCell>
                  <TableCell>{estadoBadge(r.estado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
