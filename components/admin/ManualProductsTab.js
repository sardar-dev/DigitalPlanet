import { FormInput, FormTextarea, FormSelect } from "../ui/FormInput";
import { PrimaryButton, SecondaryButton, LinkButton } from "../ui/Button";
import SectionHeading from "../ui/SectionHeading";
import DataTable from "./DataTable";

export default function ManualProductsTab({
  manualForm,
  setManualForm,
  saveManualProduct,
  manualMessage,
  manualProducts,
  editManualProduct,
  archiveManualProduct,
  resetManualForm,
}) {
  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <SectionHeading title={manualForm.id !== null ? "Edit product" : "Add a manual product"} />
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <FormInput
            label="Title"
            value={manualForm.title}
            onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
          />
          <FormTextarea
            label="Description (optional)"
            value={manualForm.description}
            onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
            rows={2}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormInput
              label="Sell price"
              value={manualForm.sell_price}
              onChange={(e) => setManualForm({ ...manualForm, sell_price: e.target.value })}
              type="number"
              step="0.01"
              className="font-mono"
            />
            <FormInput
              label="Your cost (admin-only)"
              value={manualForm.cost_price}
              onChange={(e) => setManualForm({ ...manualForm, cost_price: e.target.value })}
              type="number"
              step="0.01"
              className="font-mono"
            />
            <FormInput
              label="Stock"
              value={manualForm.available_stock}
              onChange={(e) => setManualForm({ ...manualForm, available_stock: e.target.value })}
              type="number"
              step="1"
              className="font-mono"
            />
          </div>
          <FormInput
            label="Estimated delivery"
            value={manualForm.delivery}
            onChange={(e) => setManualForm({ ...manualForm, delivery: e.target.value })}
            placeholder='e.g. "Within 1-6 hours"'
          />
          <FormSelect
            label="Activation info needed from customer"
            value={manualForm.activation_field}
            onChange={(e) => setManualForm({ ...manualForm, activation_field: e.target.value })}
            hint="Shown to the customer as the box's label/placeholder at checkout, so they know exactly what to provide for activation."
          >
            <option value="">None</option>
            <option value="email">Email</option>
            <option value="username">Username</option>
          </FormSelect>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={manualForm.selected}
              onChange={(e) => setManualForm({ ...manualForm, selected: e.target.checked })}
              className="h-4 w-4 accent-brand"
            />
            Active (shown on storefront)
          </label>
          <div className="flex gap-3">
            <PrimaryButton onClick={saveManualProduct}>
              {manualForm.id !== null ? "Save changes" : "Create product"}
            </PrimaryButton>
            {manualForm.id !== null && (
              <SecondaryButton onClick={resetManualForm}>Cancel edit</SecondaryButton>
            )}
          </div>
          {manualMessage && <p className="text-sm text-muted">{manualMessage}</p>}
        </div>
      </div>

      <div>
        <SectionHeading title="Your manual products" />
        <DataTable>
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-4">Stock</th>
              <th className="py-3 px-4">Sell price</th>
              <th className="py-3 px-4">Cost</th>
              <th className="py-3 px-4">Activation</th>
              <th className="py-3 px-4">Active</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {manualProducts.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="py-3 px-4 text-ink">{p.title}</td>
                <td className="py-3 px-4 font-mono text-muted">{p.available_stock}</td>
                <td className="py-3 px-4 font-mono text-ink">${Number(p.sell_price).toFixed(2)}</td>
                <td className="py-3 px-4 font-mono text-muted">${Number(p.cost_price).toFixed(2)}</td>
                <td className="py-3 px-4 text-muted">{p.activation_field || "—"}</td>
                <td className="py-3 px-4 text-ink">{p.selected ? "Yes" : "No"}</td>
                <td className="py-3 px-4 space-x-3 whitespace-nowrap">
                  <LinkButton onClick={() => editManualProduct(p)}>Edit</LinkButton>
                  {p.selected && (
                    <LinkButton onClick={() => archiveManualProduct(p.id)} className="text-danger">
                      Archive
                    </LinkButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}
