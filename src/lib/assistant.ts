// Duka Assistant — answers questions strictly from real shop data.
// Provider-independent: pure functions over fetched data; optionally LLM-polished if an API key exists.
// NEVER invents numbers: every answer is computed from actual queries.
import { supabase } from './supabase';

export interface AssistantContext {
  shopId: string;
  shopName: string;
}

async function fetchContext(ctx: AssistantContext) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(Date.now() - 7 * 86400000);

  const [todaySales, weekSales, lowStock, topDebtors, weekItems, expensesWeek] = await Promise.all([
    supabase.from('sales').select('total, payment_method').eq('shop_id', ctx.shopId).gte('created_at', todayStart.toISOString()),
    supabase.from('sales').select('id, total').eq('shop_id', ctx.shopId).gte('created_at', weekStart.toISOString()),
    supabase.from('products').select('name, current_stock, minimum_stock, buying_price, selling_price').eq('shop_id', ctx.shopId).eq('is_active', true).order('current_stock').limit(50),
    supabase.from('customers').select('full_name, phone, current_balance').eq('shop_id', ctx.shopId).gt('current_balance', 0).order('current_balance', { ascending: false }).limit(10),
    supabase.from('sale_items').select('product_name, quantity, total, cogs, sale_id, sales!inner(shop_id, created_at)').gte('created_at', weekStart.toISOString()),
    supabase.from('expenses').select('amount').eq('shop_id', ctx.shopId).gte('expense_date', weekStart.toISOString().split('T')[0]),
  ]);

  const sales7 = weekSales.data || [];
  const weekSaleIds = new Set(sales7.map(s => s.id));
  const items7 = (weekItems.data || []).filter((i: any) => weekSaleIds.has(i.sale_id));

  const sum = (rows: any[], key: string) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const todayRows = todaySales.data || [];

  const productAgg: Record<string, { name: string; units: number }> = {};
  for (const i of items7) {
    const key = i.product_name;
    productAgg[key] = productAgg[key] || { name: key, units: 0 };
    productAgg[key].units += i.quantity;
  }
  const fastest = Object.values(productAgg).sort((a, b) => b.units - a.units).slice(0, 5);

  const cogs7 = items7.reduce((s, i: any) => s + Number(i.cogs || 0), 0);
  const revenue7 = sum(sales7, 'total');
  const expenses7 = sum(expensesWeek.data || [], 'amount');

  return {
    today: {
      total: sum(todayRows, 'total'),
      count: todayRows.length,
      cash: sum(todayRows.filter(r => r.payment_method === 'CASH'), 'total'),
      mpesa: sum(todayRows.filter(r => r.payment_method === 'M-PESA'), 'total'),
      credit: sum(todayRows.filter(r => r.payment_method === 'CREDIT'), 'total'),
    },
    week: {
      revenue: revenue7,
      cogs: cogs7,
      grossProfit: revenue7 - cogs7,
      expenses: expenses7,
      netProfit: revenue7 - cogs7 - expenses7,
      count: sales7.length,
    },
    lowStock: (lowStock.data || []).filter((p: any) => p.current_stock <= p.minimum_stock),
    outOfStock: (lowStock.data || []).filter((p: any) => p.current_stock === 0),
    topDebtors: topDebtors.data || [],
    fastest,
  };
}

export async function askDuka(question: string, ctx: AssistantContext): Promise<string> {
  const q = question.toLowerCase();
  const d = await fetchContext(ctx);
  const fmt = (n: number) => `KSh ${n.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

  if (/how much.*sell.*today|today.*sales|sales.*today/.test(q)) {
    if (d.today.count === 0) return 'You have no recorded sales today yet. Once you make sales in the POS, I can summarise them here.';
    return `Today you sold ${fmt(d.today.total)} across ${d.today.count} transaction${d.today.count > 1 ? 's' : ''} — Cash ${fmt(d.today.cash)}, M-Pesa ${fmt(d.today.mpesa)}, Credit ${fmt(d.today.credit)}.`;
  }

  if (/owes|owe me|debt|debtor|credit/.test(q)) {
    if (d.topDebtors.length === 0) return 'No customers currently owe you anything. Your Daftari is clear.';
    const list = d.topDebtors.slice(0, 3).map(c => `${c.full_name} (${fmt(Number(c.current_balance))})`).join(', ');
    const total = d.topDebtors.reduce((s, c) => s + Number(c.current_balance), 0);
    return `Your biggest debtors: ${list}. Total outstanding across customers shown: ${fmt(total)}.`;
  }

  if (/fast|top|best.selling|selling fast|popular/.test(q)) {
    if (d.fastest.length === 0) return 'No sales recorded in the last 7 days yet, so I cannot rank products. Data appears after your first POS sales.';
    const list = d.fastest.map(p => `${p.name} (${p.units} units)`).join(', ');
    return `Fastest sellers in the last 7 days: ${list}.`;
  }

  if (/low stock|running out|restock|reorder/.test(q)) {
    const low = d.lowStock.slice(0, 5);
    if (low.length === 0) return 'Nothing is at or below its minimum stock level right now.';
    const oos = d.outOfStock.map((p: any) => `${p.name} (OUT)`).join(', ');
    const lowList = low.filter((p: any) => p.current_stock > 0).map((p: any) => `${p.name} (${p.current_stock} left)`).join(', ');
    return `Needs restocking: ${[oos, lowList].filter(Boolean).join('; ')}.`;
  }

  if (/profit.*week|week.*profit|this week/.test(q)) {
    if (d.week.count === 0) return 'No sales in the last 7 days, so there is no profit to report yet.';
    return `Last 7 days: revenue ${fmt(d.week.revenue)}, COGS ${fmt(d.week.cogs)}, gross profit ${fmt(d.week.grossProfit)}, expenses ${fmt(d.week.expenses)}, net profit ${fmt(d.week.netProfit)}.`;
  }

  if (/how many.*sold|units/.test(q)) {
    if (d.fastest.length === 0) return 'I have no sales data for the last 7 days, so I cannot answer that yet.';
    return `Units sold in the last 7 days (top items): ${d.fastest.map(p => `${p.name}: ${p.units}`).join(', ')}.`;
  }

  // Honest fallback — no invented answers
  return [
    'I can answer questions like:',
    '• "How much did I sell today?"',
    '• "Who owes me the most?"',
    '• "Which products are selling fastest?"',
    '• "Which products are low on stock?"',
    '• "What was my profit this week?"',
    '• "Which products should I restock?"',
  ].join('\n');
}
