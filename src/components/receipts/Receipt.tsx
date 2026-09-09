import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export interface ReceiptData {
  shop_name: string;
  shop_phone?: string | null;
  shop_address?: string | null;
  receipt_number: string;
  created_at: string;
  payment_method: string;
  customer_name?: string | null;
  mpesa_reference?: string | null;
  items: { product_name: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
}

const PRINT_STYLES = (widthMm: number) => `
  @media print {
    body * { visibility: hidden; }
    #receipt-print-area, #receipt-print-area * { visibility: visible; }
    #receipt-print-area {
      position: absolute; left: 0; top: 0; width: ${widthMm}mm;
      font-family: 'SF Mono', Menlo, monospace; font-size: 10px; color: #000; background: #fff; padding: 2mm;
    }
    @page { margin: 2mm; size: ${widthMm}mm auto; }
  }
`;

export function ReceiptView({ data, compact = false }: { data: ReceiptData; compact?: boolean }) {
  return (
    <div className="bg-elevated rounded-xl p-4 font-mono text-[13px] space-y-1">
      <div className="text-center pb-2 border-b border-border-subtle">
        <p className="font-bold text-text">{data.shop_name}</p>
        {data.shop_address && <p className="text-[11px] text-text-muted">{data.shop_address}</p>}
        {data.shop_phone && <p className="text-[11px] text-text-muted">{data.shop_phone}</p>}
        <p className="text-[11px] text-text-muted mt-1">Receipt #{data.receipt_number}</p>
        <p className="text-[11px] text-text-muted">{new Date(data.created_at).toLocaleString('en-KE')}</p>
      </div>
      <div className="py-1 space-y-0.5">
        {data.items.map((item, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span className="text-text-secondary truncate">{item.product_name} ×{item.quantity}</span>
            <span className="text-text tabular-nums flex-shrink-0">{formatCurrency(item.total)}</span>
          </div>
        ))}
      </div>
      {data.discount > 0 && (
        <div className="flex justify-between text-text-secondary">
          <span>Discount</span>
          <span className="tabular-nums">-{formatCurrency(data.discount)}</span>
        </div>
      )}
      <div className="border-t border-border-subtle pt-1.5 flex justify-between font-bold text-text">
        <span>TOTAL</span>
        <span className="text-primary tabular-nums">{formatCurrency(data.total)}</span>
      </div>
      <div className="text-[11px] text-text-muted pt-1">
        <p>Paid via {data.payment_method}{data.mpesa_reference ? ` · ${data.mpesa_reference}` : ''}</p>
        {data.customer_name && <p>Customer: {data.customer_name}</p>}
      </div>
      {!compact && <p className="text-[11px] text-text-muted text-center pt-2 border-t border-border-subtle mt-1">Asante sana! Thank you.</p>}
    </div>
  );
}

export function PrintReceipt({ data }: { data: ReceiptData }) {
  const doPrint = (widthMm: 58 | 80) => {
    const win = window.open('', '_blank', 'width=420,height=600');
    if (!win) return;
    const rows = data.items.map(i =>
      `<tr><td>${i.product_name} ×${i.quantity}</td><td style="text-align:right">${formatCurrency(i.total)}</td></tr>`
    ).join('');
    win.document.write(`<!doctype html><html><head><title>${data.receipt_number}</title><style>${PRINT_STYLES(widthMm)}
      body { font-family: 'SF Mono', Menlo, monospace; font-size: 11px; margin: 0; color: #000; }
      table { width: 100%; border-collapse: collapse; }
      .c { text-align: center; } .b { font-weight: 700; }
      .hr { border-top: 1px dashed #000; margin: 4px 0; }
    </style></head><body>
      <div id="receipt-print-area">
        <p class="c b">${data.shop_name}</p>
        ${data.shop_address ? `<p class="c">${data.shop_address}</p>` : ''}
        ${data.shop_phone ? `<p class="c">${data.shop_phone}</p>` : ''}
        <p class="c">Receipt #${data.receipt_number}</p>
        <p class="c">${new Date(data.created_at).toLocaleString('en-KE')}</p>
        <div class="hr"></div>
        <table>${rows}</table>
        ${data.discount > 0 ? `<div class="hr"></div><table><tr><td>Discount</td><td style="text-align:right">-${formatCurrency(data.discount)}</td></tr></table>` : ''}
        <div class="hr"></div>
        <table><tr class="b"><td>TOTAL</td><td style="text-align:right">${formatCurrency(data.total)}</td></tr></table>
        <div class="hr"></div>
        <p>Paid via ${data.payment_method}${data.mpesa_reference ? ` · ${data.mpesa_reference}` : ''}</p>
        ${data.customer_name ? `<p>Customer: ${data.customer_name}</p>` : ''}
        <p class="c">Asante sana! Thank you.</p>
      </div>
      <script>window.onload = function(){ window.print(); }</script>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={() => doPrint(58)}>
        <Printer className="h-4 w-4" /> Print 58mm
      </Button>
      <Button variant="outline" onClick={() => doPrint(80)}>
        <Printer className="h-4 w-4" /> Print 80mm
      </Button>
    </div>
  );
}
