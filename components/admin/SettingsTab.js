import { FormInput } from "../ui/FormInput";
import { PrimaryButton } from "../ui/Button";
import SectionHeading from "../ui/SectionHeading";

export default function SettingsTab({
  whatsappLink,
  setWhatsappLink,
  saveSettings,
  settingsMessage,
}) {
  return (
    <div className="max-w-md space-y-4">
      <SectionHeading title="Site settings" />
      <div className="space-y-3 rounded-xl border border-border bg-surface p-5 shadow-card">
        <FormInput
          label="WhatsApp channel link"
          value={whatsappLink}
          onChange={(e) => setWhatsappLink(e.target.value)}
          placeholder="https://chat.whatsapp.com/…"
          hint="Shown as a floating button on the storefront and customer pages once set. Leave empty to hide the button."
        />
        <PrimaryButton onClick={saveSettings}>Save</PrimaryButton>
        {settingsMessage && <p className="text-sm text-muted">{settingsMessage}</p>}
      </div>
    </div>
  );
}
