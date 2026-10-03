import { FormInput } from "../ui/FormInput";
import { SecondaryButton } from "../ui/Button";
import DataTable from "./DataTable";

export default function ProductsTab({
  productSearch,
  setProductSearch,
  sortAvailableFirst,
  setSortAvailableFirst,
  visibleProducts,
  updateProduct,
}) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3 justify-between">
        <FormInput
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Search products…"
          className="min-w-[200px] flex-1 max-w-sm"
          aria-label="Search products"
        />
        <SecondaryButton onClick={() => setSortAvailableFirst((s) => !s)} className="whitespace-nowrap text-sm">
          {sortAvailableFirst ? "Sorted: in-stock first ✓" : "Sort: in-stock first"}
        </SecondaryButton>
      </div>
      <DataTable>
        <thead>
          <tr className="text-left text-muted border-b border-border">
            <th className="py-3 px-4">Product</th>
            <th className="py-3 px-4">Real stock</th>
            <th className="py-3 px-4">Shown as</th>
            <th className="py-3 px-4">DigiTrust price</th>
            <th className="py-3 px-4">Your price</th>
            <th className="py-3 px-4">Show on site</th>
          </tr>
        </thead>
        <tbody>
          {visibleProducts.map((p) => (
            <tr
              key={p.id}
              className={`border-b border-border last:border-0 ${
                p.available_stock === 0 ? "opacity-50" : ""
              }`}
            >
              <td className="py-3 px-4 text-ink">{p.title}</td>
              <td className="py-3 px-4 font-mono text-muted">{p.real_stock}</td>
              <td className="py-3 px-4 font-mono text-ink">{p.available_stock}</td>
              <td className="py-3 px-4 font-mono text-muted">${Number(p.cost_price).toFixed(2)}</td>
              <td className="py-3 px-4">
                <input
                  type="number"
                  step="0.01"
                  defaultValue={p.sell_price}
                  onBlur={(e) => updateProduct(p.id, { sell_price: Number(e.target.value) })}
                  className="w-24 rounded-md border border-border px-2 py-1 font-mono text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </td>
              <td className="py-3 px-4">
                <input
                  type="checkbox"
                  checked={p.selected}
                  onChange={(e) => updateProduct(p.id, { selected: e.target.checked })}
                  className="h-4 w-4 accent-brand"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
