'use client';

interface Totals {
  subtotalNet: number;
  discountAmount: number;
  totalNet: number;
  totalVat: number;
  totalGross: number;
}

interface DiscountInfo {
  type: string;
  value: number;
  description: string;
}

interface SummaryProps {
  totals: Totals;
  discount: DiscountInfo;
  formatPrice: (price: number) => string;
}

export function Summary({ totals, discount, formatPrice }: SummaryProps) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-semibold text-slate-800 mb-6">💰 Summary</h2>
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-8 rounded-xl shadow-lg">
        <div className="flex justify-between mb-4 text-base">
          <span>Subtotal Net:</span>
          <span>{formatPrice(totals.subtotalNet)}</span>
        </div>
        
        {discount.type && discount.value > 0 && (
          <div className="flex justify-between mb-4 text-base">
            <span>
              Discount ({discount.type === 'percentage' ? `${discount.value}%` : 'Fixed'}):
            </span>
            <span>- {formatPrice(totals.discountAmount)}</span>
          </div>
        )}
        
        <div className="flex justify-between mb-4 text-base">
          <span>Total Net Price:</span>
          <span>{formatPrice(totals.totalNet)}</span>
        </div>
        
        <div className="flex justify-between mb-4 text-base">
          <span>VAT (19%):</span>
          <span>{formatPrice(totals.totalVat)}</span>
        </div>
        
        <div className="flex justify-between pt-4 mt-2 border-t-2 border-white/30 text-2xl font-bold">
          <span>Total Gross Price:</span>
          <span>{formatPrice(totals.totalGross)}</span>
        </div>
      </div>
    </div>
  );
}
