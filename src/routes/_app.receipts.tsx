import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Plus, Trash2, CheckCircle2, Clock, XCircle, AlertCircle, Receipt,
  Loader2, PenLine, FileSearch, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  getObligations, addObligation, deleteObligation, toggleObligation,
  computeEstado, formatObligationDate,
  type Obligation, type EstadoObligation,
} from "@/lib/api/obligations.functions";
import { readDocumentText, type ReadProgress } from "@/lib/ocr/read-document";
import { extractFields } from "@/lib/ocr/extract-fields";

const PROGRESS_LABEL: Record<ReadProgress, string> = {
  "pdf":         "Leyendo el texto del PDF…",
  "ocr-loading": "Preparando el reconocimiento de texto (OCR)… la primera vez puede demorar unos segundos.",
  "ocr":         "Reconociendo el texto de la imagen…",
};

export const Route = createFileRoute("/_app/receipts")({
  loader: async () => {
    const obligations = await getObligations();
    return { obligations };
  },
  component: Obligations,
});

function formatMonto(s: string): string {
  const n = parseFloat(s);
  return `ARS ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Campo de monto: el texto se maneja en formato argentino ("57.437,08") ──────

function montoToInput(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mientras se escribe: solo dígitos y una coma decimal (máx. 2 decimales);
// los puntos de miles se agregan automáticamente.
function normalizeMontoInput(value: string): string {
  const [intRaw, ...decParts] = value.replace(/[^\d,]/g, "").split(",");
  const int = intRaw.replace(/^0+(?=\d)/, "");
  const intFmt = int ? Number(int).toLocaleString("es-AR") : decParts.length ? "0" : "";
  return decParts.length ? `${intFmt},${decParts.join("").slice(0, 2)}` : intFmt;
}

function parseMontoInput(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

function EstadoBadge({ estado }: { estado: EstadoObligation }) {
  const map: Record<EstadoObligation, { c: string; Icon: React.ElementType }> = {
    Próximo: { c: "bg-warning/15 text-warning",         Icon: Clock        },
    Urgente: { c: "bg-orange-100 text-orange-600",      Icon: AlertCircle  },
    Vencido: { c: "bg-destructive/10 text-destructive", Icon: XCircle      },
    Pagado:  { c: "bg-success/10 text-success",         Icon: CheckCircle2 },
  };
  const { c, Icon } = map[estado];
  return (
    <Badge variant="secondary" className={`gap-1 rounded-full ${c}`}>
      <Icon className="h-3 w-3" /> {estado}
    </Badge>
  );
}

function Obligations() {
  const { obligations } = Route.useLoaderData();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen]           = useState(false);
  const [step, setStep]           = useState<"choice" | "form" | "duplicate">("choice");
  const [saving, setSaving]       = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [scanStage, setScanStage] = useState<ReadProgress | null>(null);
  const [emisor, setEmisor]       = useState("");
  const [monto, setMonto]         = useState("");
  const [fecha, setFecha]         = useState("");
  const [dupMatch, setDupMatch]   = useState<Obligation | null>(null);
  const [dupSource, setDupSource] = useState<"ocr" | "manual">("ocr");
  const [forceAdd, setForceAdd]   = useState(false);

  // Cola de comprobantes subidos juntos: se revisan de a uno ("1 de n")
  const [queue, setQueue]           = useState<File[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueSaved, setQueueSaved] = useState(0);
  const scanToken                   = useRef(0); // invalida lecturas en curso al cerrar
  const inQueue    = queue.length > 0;
  const queueLabel = queue.length > 1 ? ` (${queueIndex + 1} de ${queue.length})` : "";

  const todayStr = new Date().toISOString().slice(0, 10);
  const [payingOb, setPayingOb]   = useState<Obligation | null>(null);
  const [fechaPago, setFechaPago] = useState(todayStr);

  const resetFields = () => { setEmisor(""); setMonto(""); setFecha(""); setDupMatch(null); setForceAdd(false); };
  const reset = () => { resetFields(); setStep("choice"); };
  const openManual = () => { resetFields(); setStep("form"); setOpen(true); };

  function findDuplicate(e: string, m: number, f: string): Obligation | null {
    const norm = (s: string) => s.toLowerCase().trim();
    return obligations.find((ob) =>
      norm(ob.emisor) === norm(e) &&
      Math.abs(parseFloat(ob.monto) - m) < 0.01 &&
      ob.fecha_vencimiento === f,
    ) ?? null;
  }

  function findDuplicateByAmountAndDate(m: number, f: string): Obligation | null {
    return obligations.find((ob) =>
      Math.abs(parseFloat(ob.monto) - m) < 0.01 &&
      ob.fecha_vencimiento === f,
    ) ?? null;
  }

  // ── OCR ──────────────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (files.length === 0) return;

    const tooBig = files.filter((f) => f.size > 5 * 1024 * 1024);
    if (tooBig.length > 0) {
      toast.error(
        tooBig.length === 1
          ? `"${tooBig[0].name}" supera los 5 MB y no se cargará.`
          : `${tooBig.length} archivos superan los 5 MB y no se cargarán.`,
      );
    }
    const valid = files.filter((f) => f.size <= 5 * 1024 * 1024);
    if (valid.length === 0) return;

    setQueue(valid);
    setQueueIndex(0);
    setQueueSaved(0);
    setOpen(true);
  };

  // Cada comprobante de la cola se lee cuando le toca (así los duplicados se
  // comparan también contra los guardados antes en la misma tanda)
  useEffect(() => {
    const file = queue[queueIndex];
    if (file) void processFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, queueIndex]);

  const advanceQueue = (saved: boolean) => {
    const savedCount = queueSaved + (saved ? 1 : 0);
    if (queueIndex + 1 < queue.length) {
      setQueueSaved(savedCount);
      setQueueIndex((i) => i + 1);
      return;
    }
    if (queue.length > 1) {
      toast.success(`${savedCount} de ${queue.length} obligaciones registradas.`);
    } else if (saved) {
      toast.success("Obligación registrada.");
    }
    closeQueue();
  };

  const closeQueue = () => {
    scanToken.current++;
    setQueue([]);
    setQueueIndex(0);
    setQueueSaved(0);
    setScanning(false);
    setScanStage(null);
    setOpen(false);
    reset();
  };

  const handleDialogChange = (v: boolean) => {
    if (v) { setOpen(true); return; }
    if (inQueue) {
      const remaining = queue.length - queueIndex - 1;
      if (remaining > 0) {
        toast.info(`Se descartaron ${remaining} comprobante${remaining !== 1 ? "s" : ""} sin revisar.`);
      }
      closeQueue();
      return;
    }
    setOpen(false);
    reset();
  };

  const processFile = async (file: File) => {
    const token = ++scanToken.current;
    resetFields();
    setStep("form");
    setScanning(true);

    try {
      // El documento se procesa en el navegador: no se envía a ningún servidor
      const text = await readDocumentText(file, (p) => token === scanToken.current && setScanStage(p));
      if (token !== scanToken.current) return;
      const result = extractFields(text);

      const extractedEmisor = result.emisor ?? "";
      const extractedMonto  = result.monto != null ? montoToInput(result.monto) : "";
      const extractedFecha  = result.fecha_vencimiento ?? "";

      setEmisor(extractedEmisor);
      setMonto(extractedMonto);
      setFecha(extractedFecha);

      if (!result.emisor && !result.monto && !result.fecha_vencimiento) {
        toast.warning("No se pudieron extraer datos del documento. Completá los campos manualmente.");
        setStep("form");
      } else {
        const dup = result.monto != null && result.fecha_vencimiento
          ? findDuplicate(extractedEmisor, result.monto, extractedFecha)
          : null;
        if (dup) {
          setDupMatch(dup);
          setDupSource("ocr");
          setStep("duplicate");
        } else {
          toast.success("Datos extraídos. Verificá antes de guardar.");
          setStep("form");
        }
      }
    } catch (err) {
      if (token !== scanToken.current) return;
      toast.error(err instanceof Error ? err.message : "Error al procesar el archivo.");
    } finally {
      if (token === scanToken.current) {
        setScanning(false);
        setScanStage(null);
      }
    }
  };

  // ── Guardar ───────────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseMontoInput(monto);
    if (isNaN(montoNum) || montoNum <= 0) { toast.error("Ingresá un monto válido."); return; }
    if (!forceAdd) {
      const dup = findDuplicateByAmountAndDate(montoNum, fecha);
      if (dup) { setDupMatch(dup); setDupSource("manual"); setStep("duplicate"); return; }
    }
    setSaving(true);
    try {
      await addObligation({ data: { emisor, monto: montoNum, fecha_vencimiento: fecha } });
      await router.invalidate();
      if (inQueue) {
        advanceQueue(true);
      } else {
        setOpen(false);
        reset();
        toast.success("Obligación registrada.");
      }
    } catch {
      toast.error("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // ── Acciones de tabla ─────────────────────────────────────────────────────────

  const handleDelete = async (ob: Obligation) => {
    try {
      await deleteObligation({ data: { id_obligacion: ob.id_obligacion } });
      await router.invalidate();
      toast.success(`${ob.emisor} eliminada.`);
    } catch {
      toast.error("No se pudo eliminar.");
    }
  };

  const handleToggle = async (ob: Obligation) => {
    if (!ob.pagado) {
      // Marcar como pagada → pedir fecha de pago primero
      setFechaPago(todayStr);
      setPayingOb(ob);
      return;
    }
    // Desmarcar pago directamente
    try {
      await toggleObligation({ data: { id_obligacion: ob.id_obligacion, pagado: false, fecha_pago: null } });
      await router.invalidate();
      toast.success(`${ob.emisor} marcada como pendiente.`);
    } catch {
      toast.error("No se pudo actualizar.");
    }
  };

  const handleConfirmPago = async () => {
    if (!payingOb || !fechaPago) return;
    try {
      await toggleObligation({ data: { id_obligacion: payingOb.id_obligacion, pagado: true, fecha_pago: fechaPago } });
      await router.invalidate();
      toast.success(`${payingOb.emisor} marcada como pagada.`);
    } catch {
      toast.error("No se pudo actualizar.");
    } finally {
      setPayingOb(null);
    }
  };

  const pendientes     = obligations.filter((o) => !o.pagado);
  const totalPendiente = pendientes.reduce((s, o) => s + parseFloat(o.monto), 0);
  const pagadas        = obligations.filter((o) => o.pagado);
  const totalPagado    = pagadas.reduce((s, o) => s + parseFloat(o.monto), 0);

  return (
    <div className="space-y-6">

      {/* Input file oculto */}
      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5 text-sm text-muted-foreground">
          <p>
            {pendientes.length === 1
              ? "1 obligación pendiente"
              : `${pendientes.length} obligaciones pendientes`}{" "}
            ·{" "}
            <span className="font-medium text-foreground">
              ARS {totalPendiente.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
          <p>
            {pagadas.length === 1 ? "1 obligación pagada" : `${pagadas.length} obligaciones pagadas`}{" "}
            ·{" "}
            <span className="font-medium text-success">
              ARS {totalPagado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }} className="rounded-xl shadow-[var(--shadow-glow)]">
          <Plus className="mr-1 h-4 w-4" /> Nueva obligación
        </Button>
      </div>

      {/* Empty state */}
      {obligations.length === 0 && (
        <Card className="rounded-2xl border-dashed border-border p-10 text-center shadow-none">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No hay obligaciones registradas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Subí una factura o cargá manualmente tus vencimientos.
          </p>
          <Button className="mt-4 rounded-xl" onClick={() => { reset(); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nueva obligación
          </Button>
        </Card>
      )}

      {/* Tabla */}
      {obligations.length > 0 && (
        <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <div className="overflow-hidden rounded-xl border border-border">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Emisor</TableHead>
                  <TableHead className="text-center">Monto</TableHead>
                  <TableHead className="hidden text-center md:table-cell">Vencimiento</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="hidden text-center lg:table-cell">Fecha pago</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {obligations.map((ob) => {
                  const estado = computeEstado(ob.fecha_vencimiento, ob.pagado);
                  return (
                    <TableRow key={ob.id_obligacion}>
                      <TableCell className="whitespace-nowrap font-medium">{ob.emisor}</TableCell>
                      <TableCell className="whitespace-nowrap text-center font-semibold">{formatMonto(ob.monto)}</TableCell>
                      <TableCell className="hidden text-center text-muted-foreground md:table-cell">
                        {formatObligationDate(ob.fecha_vencimiento)}
                      </TableCell>
                      <TableCell className="text-center"><EstadoBadge estado={estado} /></TableCell>
                      <TableCell className="hidden text-center text-muted-foreground lg:table-cell">
                        {ob.fecha_pago ? formatObligationDate(ob.fecha_pago) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => handleToggle(ob)}
                            title={ob.pagado ? "Marcar como pendiente" : "Marcar como pagada"}
                            className={`transition ${ob.pagado ? "text-success hover:text-success/70" : "text-muted-foreground hover:text-success"}`}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ob)}
                            title="Eliminar"
                            className="text-destructive/70 transition hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="whitespace-nowrap text-center font-bold">
                    ARS {(totalPendiente + totalPagado).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="hidden md:table-cell" />
                  <TableCell />
                  <TableCell className="hidden lg:table-cell" />
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva obligación{queueLabel}</DialogTitle>
            <DialogDescription>
              {step === "choice"    ? "¿Cómo querés registrar la obligación?" :
             step === "duplicate" ? "Revisá antes de continuar." :
             "Verificá los datos y guardá."}
            </DialogDescription>
          </DialogHeader>

          {/* Paso 1: elegir método */}
          {step === "choice" && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                onClick={openManual}
                className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5 text-center transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <PenLine className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Carga manual</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Ingresá los datos vos mismo</div>
                </div>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5 text-center transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileSearch className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Subir comprobante</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Uno o varios · JPG, PNG o PDF · máx. 5 MB</div>
                </div>
              </button>
            </div>
          )}

          {/* Paso 2: duplicado detectado */}
          {step === "duplicate" && dupMatch && (
            <div className="mt-2 space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold">
                    {dupSource === "manual" ? "Posible duplicado detectado" : "Comprobante duplicado detectado"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ya existe una obligación de <span className="font-medium">{dupMatch.emisor}</span> por{" "}
                    <span className="font-medium">
                      ARS {parseFloat(dupMatch.monto).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>{" "}
                    con vencimiento el{" "}
                    <span className="font-medium">{formatObligationDate(dupMatch.fecha_vencimiento)}</span>.
                    {dupSource === "manual"
                      ? " Verificá si ya tenés esta obligación registrada antes de continuar."
                      : " Cargarlo de nuevo distorsionaría tu análisis financiero."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={inQueue ? () => advanceQueue(false) : reset}
                >
                  {queue.length > 1 ? "Omitir" : "Cancelar"}
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  onClick={() => { setDupMatch(null); setForceAdd(true); setStep("form"); }}
                >
                  Cargar de todas formas
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3: formulario (manual o pre-llenado por OCR) */}
          {step === "form" && (
            scanning ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Analizando documento…</p>
                <p className="text-center text-xs text-muted-foreground">
                  {scanStage ? PROGRESS_LABEL[scanStage] : "Extrayendo emisor, monto y fecha de vencimiento."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleAdd} className="mt-2 space-y-3">
                <div>
                  <Label>Emisor</Label>
                  <Input
                    className="mt-1.5 h-10 rounded-xl"
                    placeholder="Ej: EPEC, Ecogas, Visa..."
                    value={emisor}
                    onChange={(e) => setEmisor(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Monto (ARS)</Label>
                  <Input
                    className="mt-1.5 h-10 rounded-xl"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej: 24.580,50"
                    value={monto}
                    onChange={(e) => setMonto(normalizeMontoInput(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <Label>Fecha de vencimiento</Label>
                  <Input
                    className="mt-1.5 h-10 rounded-xl"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={inQueue ? () => advanceQueue(false) : () => setStep("choice")}
                  >
                    {queue.length > 1 ? "Omitir" : inQueue ? "Cancelar" : "Volver"}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 rounded-xl shadow-[var(--shadow-glow)]"
                    disabled={saving}
                  >
                    {saving ? "Guardando…" : "Guardar obligación"}
                  </Button>
                </div>
              </form>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: registrar fecha de pago */}
      <Dialog open={!!payingOb} onOpenChange={(v) => { if (!v) setPayingOb(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              {payingOb ? `${payingOb.emisor} — ARS ${parseFloat(payingOb.monto).toLocaleString("es-AR")}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div>
              <Label className="text-sm">Fecha en que se realizó el pago</Label>
              <Input
                type="date"
                className="mt-1.5 h-10 rounded-xl"
                value={fechaPago}
                max={todayStr}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-xl shadow-[var(--shadow-glow)]"
                onClick={handleConfirmPago}
                disabled={!fechaPago}
              >
                Confirmar pago
              </Button>
              <Button variant="ghost" className="rounded-xl" onClick={() => setPayingOb(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
