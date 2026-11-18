import { useState } from "react";
import { dateLabel, pacificDate, useAPI, useAction } from "../lib/api";
import type { Schema } from "../lib/api";
import { Button, Dialog, Field, Loading, Message, Panel, Pill } from "./ui";
import { CustodyDialog, custodySummary, hasCustody } from "./gear-custody";

type Item = Schema<"GearItemView">;
type Kind = Schema<"GearTypeView">;

const stockStatuses = {
  rentable: "Rentable",
  "non-rentable": "Not rentable",
  expired: "Loan expired",
  upcoming: "Loan starts later",
  archived: "Archived",
};

function stockStatus(item: Item, today: string): keyof typeof stockStatuses {
  if (item.archived) return "archived";
  if (item.loan_end && item.loan_end < today) return "expired";
  if (item.loan_start && item.loan_start > today) return "upcoming";
  return item.rentable ? "rentable" : "non-rentable";
}
function ItemEditor({
  item,
  types,
  close,
}: {
  item?: Item;
  types: Kind[];
  close: () => void;
}) {
  const action = useAction();
  const [ownership, setOwnership] = useState(item?.ownership || "club");
  return (
    <Dialog title={item ? "Edit equipment" : "Add equipment"} onClose={close}>
      <form
        className="stack gear-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const text = (key: string) => String(f.get(key) || "").trim();
          await action
            .mutateAsync({
              url: "/api/admin/gear/inventory" + (item ? "/" + item.id : ""),
              method: item ? "PUT" : "POST",
              body: {
                type_id: Number(f.get("type")),
                name: text("name"),
                description: text("description"),
                quantity: Number(f.get("quantity")),
                rentable: f.has("rentable"),
                archived: f.has("archived"),
                ownership,
                owner: text("owner"),
                loan_start: text("start") || null,
                loan_end: text("end") || null,
                ...(item ? { expected_revision: item.revision } : {}),
              },
            })
            .then(close)
            .catch(() => {});
        }}
      >
        <Field
          label="Model or item name"
          name="name"
          required
          maxLength={100}
          defaultValue={item?.name}
        />
        <label>
          Gear type
          <select name="type" defaultValue={item?.type_id} required>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={2000}
            defaultValue={item?.description}
          />
        </label>
        <Field
          label="Quantity owned or on loan"
          name="quantity"
          type="number"
          min={0}
          max={100000}
          required
          defaultValue={item?.quantity ?? 1}
        />
        <label>
          Ownership
          <select
            value={ownership}
            onChange={(e) => setOwnership(e.target.value as Item["ownership"])}
          >
            <option value="club">Club owned</option>
            <option value="officer">Officer owned</option>
          </select>
        </label>
        {ownership === "officer" && (
          <>
            <Field
              label="Officer lending this gear"
              name="owner"
              required
              maxLength={100}
              defaultValue={item?.owner}
            />
            <div className="gear-fields">
              <Field
                label="Loan start"
                type="date"
                name="start"
                required
                defaultValue={item?.loan_start || ""}
              />
              <Field
                label="Loan expiry"
                type="date"
                name="end"
                required
                defaultValue={item?.loan_end || ""}
              />
            </div>
          </>
        )}
        <label>
          <input
            name="rentable"
            type="checkbox"
            defaultChecked={item?.rentable}
          />{" "}
          Available for member rental
        </label>
        {item && (
          <label>
            <input
              name="archived"
              type="checkbox"
              defaultChecked={item.archived}
            />{" "}
            Archive item
          </label>
        )}
        <Message error={action.error} />
        <Button disabled={action.isPending}>Save equipment</Button>
      </form>
    </Dialog>
  );
}
function TypeEditor({ types, close }: { types: Kind[]; close: () => void }) {
  const [selected, setSelected] = useState<Kind>();
  const id = selected?.id;
  const [name, setName] = useState("");
  const action = useAction();
  return (
    <Dialog title="Manage gear types" onClose={close}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          await action
            .mutateAsync({
              url: "/api/admin/gear/types" + (id ? "/" + id : ""),
              method: id ? "PUT" : "POST",
              body: {
                name,
                ...(id
                  ? {
                      expected_revision: selected.revision,
                    }
                  : {}),
              },
            })
            .then(close)
            .catch(() => {});
        }}
      >
        <label>
          Gear type
          <select
            value={id ?? 0}
            onChange={(e) => {
              const n = Number(e.target.value);
              const kind = types.find((t) => t.id === n);
              setSelected(kind);
              setName(kind?.name || "");
            }}
          >
            <option value={0}>Add a new type</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Type name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Message error={action.error} />
        <Button disabled={action.isPending}>Save type</Button>
      </form>
    </Dialog>
  );
}
export function GearInventory() {
  const [custodyId, setCustodyId] = useState<number | null>(null);
  const query = useAPI("GearInventory", "/api/admin/gear/inventory", {
    poll: custodyId === null,
  });
  const [editing, setEditing] = useState<Item | "new" | "types" | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [holderFilter, setHolderFilter] = useState("");
  if (query.error) return <Message error={query.error} />;
  if (!query.data) return <Loading />;
  const { types, items, holders = [], officers = [] } = query.data;
  const showCustody = hasCustody(query.data);
  const byItem = new Map<number, typeof holders>();
  const people = new Map(officers.map((o) => [o.id, o.name]));
  for (const holder of holders) {
    people.set(holder.holder_id, holder.name);
    const group = byItem.get(holder.item_id) ?? [];
    group.push(holder);
    byItem.set(holder.item_id, group);
  }
  const custodyItem = items.find((item) => item.id === custodyId);
  const today = pacificDate();
  const typeNames = new Map(types.map((type) => [type.id, type.name]));
  const term = search.toLowerCase();
  const holderOptions = [...people].sort(
    (a, b) => a[1].localeCompare(b[1]) || a[0] - b[0],
  );
  const rows = items
    .filter((item) => {
      if (!showCustody || !holderFilter) return true;
      const known = byItem.get(item.id) ?? [];
      return holderFilter === "unknown"
        ? known.length < item.quantity
        : known.some((h) => h.holder_id === Number(holderFilter));
    })
    .map((item) => ({
      item,
      typeName: typeNames.get(item.type_id),
      custody: showCustody
        ? custodySummary(item.quantity, byItem.get(item.id) ?? [])
        : "",
      status: stockStatus(item, today),
    }))
    .filter(
      ({ item, typeName, status, custody }) =>
        [item.name, typeName, item.owner, custody]
          .join(" ")
          .toLowerCase()
          .includes(term) &&
        (filter === "all" ||
          filter === status ||
          (filter === "active" && !item.archived)),
    );
  return (
    <div className="stack">
      <div className="toolbar">
        <h2>Inventory</h2>
        <div className="actions">
          <Button variant="secondary" onClick={() => setEditing("types")}>
            Manage types
          </Button>
          <Button disabled={!types.length} onClick={() => setEditing("new")}>
            Add equipment
          </Button>
        </div>
      </div>
      <div
        className={
          showCustody ? "gear-filters gear-inventory-filters" : "gear-filters"
        }
      >
        <Field
          label="Search inventory"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="field">
          Show inventory
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="active">Active inventory</option>
            {Object.entries(stockStatuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="all">All inventory</option>
          </select>
        </label>
        {showCustody && (
          <label className="field">
            Held by
            <select
              value={holderFilter}
              onChange={(e) => setHolderFilter(e.target.value)}
            >
              <option value="">All holders</option>
              <option value="unknown">Unknown</option>
              {holderOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                  {holderOptions.some(
                    ([other, label]) => other !== id && label === name,
                  )
                    ? ` · #${id}`
                    : ""}
                </option>
              ))}
              {!!holderFilter &&
                holderFilter !== "unknown" &&
                !people.has(Number(holderFilter)) && (
                  <option value={holderFilter}>Previous holder</option>
                )}
            </select>
          </label>
        )}
      </div>
      {!rows.length && <Panel>No matching equipment.</Panel>}
      {rows.length > 0 && (
        <div className="table-wrapper">
          <table
            className="record-table gear-table"
            aria-label="Gear inventory"
          >
            <thead>
              <tr>
                <th scope="col">Equipment</th>
                <th scope="col">Quantity</th>
                <th scope="col">Ownership</th>
                {showCustody && <th scope="col">Current holder</th>}
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item: i, typeName, status, custody }) => (
                <tr key={i.id}>
                  <td data-label="Equipment">
                    <div>
                      <strong>{i.name}</strong>
                      <small>{typeName}</small>
                      {i.description && <small>{i.description}</small>}
                    </div>
                  </td>
                  <td data-label="Quantity">{i.quantity}</td>
                  <td data-label="Ownership">
                    <div>
                      {i.ownership === "club"
                        ? "Club owned"
                        : "Officer · " + i.owner}
                      {i.loan_start && i.loan_end && (
                        <small>
                          {dateLabel(i.loan_start, { dateStyle: "medium" })} –{" "}
                          {dateLabel(i.loan_end, { dateStyle: "medium" })}
                        </small>
                      )}
                    </div>
                  </td>
                  {showCustody && (
                    <td data-label="Current holder">
                      <span>{custody}</span>
                    </td>
                  )}
                  <td data-label="Status">
                    <div>
                      <Pill
                        tone={
                          status === "expired" || status === "upcoming"
                            ? "yellow"
                            : status === "rentable"
                              ? "green"
                              : "neutral"
                        }
                      >
                        {stockStatuses[status]}
                      </Pill>
                    </div>
                  </td>
                  <td data-label="Actions">
                    <div className="actions gear-row-actions">
                      {showCustody && !!i.quantity && (
                        <Button
                          variant="secondary"
                          className="small"
                          onClick={() => setCustodyId(i.id)}
                        >
                          Custody
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        className="small"
                        onClick={() => setEditing(i)}
                      >
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === "types" ? (
        <TypeEditor types={types} close={() => setEditing(null)} />
      ) : (
        editing && (
          <ItemEditor
            item={editing === "new" ? undefined : editing}
            types={types}
            close={() => setEditing(null)}
          />
        )
      )}
      {showCustody && custodyItem && (
        <CustodyDialog
          item={custodyItem}
          holders={byItem.get(custodyItem.id) ?? []}
          officers={officers}
          close={() => setCustodyId(null)}
        />
      )}
    </div>
  );
}
