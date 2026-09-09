import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Keyboard } from 'lucide-react';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

const REGION_ID = 'zyven-barcode-reader';

export function BarcodeScanner({ open, onClose, onDetected }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    if (!open || manualMode) return;

    const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
    scannerRef.current = scanner;
    setCameraError('');

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          stopScanner();
          onDetected(decodedText);
          onClose();
        },
        () => { /* per-frame decode errors: ignore */ }
      )
      .catch((err: unknown) => {
        setCameraError(
          err instanceof Error && /permission|NotAllowed/i.test(err.message)
            ? 'Camera permission denied. Enter the code manually.'
            : 'Camera unavailable on this device. Enter the code manually.'
        );
        setManualMode(true);
      });

    function stopScanner() {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    }

    return () => {
      stopScanner();
      scannerRef.current?.clear();
      scannerRef.current = null;
    };
  }, [open, manualMode, onDetected, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" /> Scan Barcode
          </DialogTitle>
          <DialogDescription>Point the camera at the product barcode</DialogDescription>
        </DialogHeader>

        {!manualMode ? (
          <>
            <div id={REGION_ID} className="rounded-xl overflow-hidden bg-black min-h-[220px]" />
            {cameraError && <p className="text-xs text-danger text-center">{cameraError}</p>}
            <button
              onClick={() => setManualMode(true)}
              className="flex items-center justify-center gap-2 text-xs text-text-muted hover:text-text transition-colors py-2"
            >
              <Keyboard className="h-3.5 w-3.5" /> Enter barcode manually
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <input
              autoFocus
              placeholder="Type or scan barcode..."
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualValue.trim()) {
                  onDetected(manualValue.trim());
                  onClose();
                }
              }}
              className="w-full h-12 px-4 rounded-xl border border-border-subtle bg-elevated text-base text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50"
            />
            <Button
              className="w-full"
              disabled={!manualValue.trim()}
              onClick={() => { if (manualValue.trim()) { onDetected(manualValue.trim()); onClose(); } }}
            >
              Look Up
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
