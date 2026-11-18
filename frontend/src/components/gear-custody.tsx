import { useState } from "react";
import type { Schema } from "../lib/api";
import { useAction } from "../lib/api";
import { Button, Dialog, Field, Message } from "./ui";

type Item = Schema<"GearItemView">;
type Holder = Schema<"GearHolder">;
type Officer = Schema<"GearOfficer">;

export function hasCustody(inventory?: Schema<"GearInventory">) {
  return (
    Array.isArray(inventory?.holders) && Array.isArray(inventory?.officers)
  );
}

function duplicateHolderNames(holders: Holder[]) {
  const owners = new Map<string, number>();
  const duplicates = new Set<string>();
  for (const holder of holders) {
    if (owners.has(holder.name) && owners.get(holder.name) !== holder.holder_id)
      duplicates.add(holder.name);
    owners.set(holder.name, holder.holder_id);
  }
  return duplicates;
}

function holderLabel(duplicates: Set<string>, holder?: Holder) {
  if (!holder) return "Unknown";
  const name =
    duplicates.has(holder.name) || holder.name === "Unknown"
      ? `${holder.name} · #${holder.holder_id}`
      : holder.name;
  return holder.kind === "borrower" ? `With borrower · ${name}` : name;
}

export function custodySummary(quantity: number, holders: Holder[]) {
  if (!quantity) return "No copies";
  const counts = new Map<string, number>();
  const duplicates = duplicateHolderNames(holders);
  for (const holder of holders) {
    const label = holderLabel(duplicates, holder);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  if (quantity > holders.length)
    counts.set("Unknown", quantity - holders.length);
  return [...counts]
    .map(([label, count]) => (quantity === 1 ? label : `${label} × ${count}`))
    .join(" · ");
}

export function CopyPicker({
  item,
  holders,
  name,
  pickup = false,
  onChange,
}: {
  item: Item;
  holders: Holder[];
  name: string;
  pickup?: boolean;
  onChange?: (copy: number) => void;
}) {
  const label = pickup ? `Copy for ${item.name}` : "Inventory copy";
  const byNumber = new Map(holders.map((h) => [h.copy_number, h]));
  const duplicates = duplicateHolderNames(holders);
  const initial = pickup && item.quantity > 1 ? "" : 1;
  const [number, setNumber] = useState<number | "">(initial);
  const change = (value: string) => {
    setNumber(value ? Number(value) : "");
    onChange?.(Number(value));
  };
  if (item.quantity > 100)
    return (
      <div>
        <Field
          label={label}
          name={name}
          type="number"
          min={1}
          max={item.quantity}
          required
          value={number}
          onChange={(e) => change(e.target.value)}
        />
        <small>
          {number && number >= 1 && number <= item.quantity
            ? holderLabel(duplicates, byNumber.get(number))
            : `Enter a copy number from 1 to ${item.quantity}.`}
        </small>
        {holders.length > 0 && (
          <details>
            <summary>Copies with a known holder</summary>
            <ul>
              {[...holders]
                .sort((a, b) => a.copy_number - b.copy_number)
                .map((holder) => (
                  <li key={holder.copy_number}>
                    Copy {holder.copy_number} ·{" "}
                    {holderLabel(duplicates, holder)}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>
    );
  return (
    <label>
      {label}
      <select
        name={name}
        required
        value={number}
        onChange={(e) => change(e.target.value)}
      >
        {initial === "" && <option value="">Choose a copy</option>}
        {Array.from({ length: item.quantity }, (_, index) => {
          const copy = index + 1;
          const holder = byNumber.get(copy);
          return (
            <option
              key={copy}
              value={copy}
              disabled={pickup && holder?.kind === "borrower"}
            >
              Copy {copy} · {holderLabel(duplicates, holder)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function OfficerOptions({ officers }: { officers: Officer[] }) {
  return (
    <>
      <option value="">Unknown</option>
      {officers.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
          {officers.some((other) => other.id !== o.id && other.name === o.name)
            ? ` · #${o.id}`
            : ""}
        </option>
      ))}
    </>
  );
}

export function CustodyDialog({
  item,
  holders,
  officers,
  close,
}: {
  item: Item;
  holders: Holder[];
  officers: Officer[];
  close: () => void;
}) {
  const [copy, setCopy] = useState(1);
  const action = useAction();
  const holder = holders.find((h) => h.copy_number === copy);
  const canEdit =
    Number.isInteger(copy) &&
    copy >= 1 &&
    copy <= item.quantity &&
    holder?.kind !== "borrower";
  return (
    <Dialog title={`Custody · ${item.name}`} onClose={close}>
      <form
        className="stack gear-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!canEdit) return;
          const selected = new FormData(event.currentTarget).get("officer");
          if (selected === null) return;
          await action
            .mutateAsync({
              method: "PUT",
              url: `/api/admin/gear/inventory/${item.id}/custody/${copy}`,
              body: {
                officer_id: selected ? Number(selected) : null,
                expected_revision: item.revision,
              },
            })
            .then(close)
            .catch(() => {});
        }}
      >
        <CopyPicker
          item={item}
          holders={holders}
          name="copy"
          onChange={setCopy}
        />
        {canEdit && (
          <label>
            Held by
            <select
              name="officer"
              key={`${copy}-${item.revision}`}
              defaultValue={holder?.holder_id ?? ""}
            >
              {holder && !officers.some((o) => o.id === holder.holder_id) && (
                <option value={holder.holder_id}>
                  {holder.name} · former officer
                </option>
              )}
              <OfficerOptions officers={officers} />
            </select>
          </label>
        )}
        {holder?.kind === "borrower" && (
          <p>{holder.name} has this copy. Record its return in Rentals.</p>
        )}
        <Message error={action.error} />
        <div className="actions">
          {canEdit && <Button disabled={action.isPending}>Save custody</Button>}
          <Button type="button" variant="secondary" onClick={close}>
            Close
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
