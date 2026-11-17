import { useState } from "react";
import { dateLabel, useAPI, useAction } from "../lib/api";
import type { Schema } from "../lib/api";
import { Button, Dialog, Field, Loading, Message, Panel } from "./ui";

type Item = Schema<"GearItemView">;
type Kind = Schema<"GearTypeView">;
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
  const query = useAPI("GearInventory", "/api/admin/gear/inventory");
  const [editing, setEditing] = useState<Item | "new" | "types" | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  if (query.error) return <Message error={query.error} />;
  if (!query.data) return <Loading />;
  const { types, items } = query.data;
  const rows = items.filter(
    (i) =>
      (
        i.name +
        " " +
        types.find((t) => t.id === i.type_id)?.name +
        " " +
        i.owner
      )
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "archived"
          ? i.archived
          : !i.archived &&
            (filter === "active" ||
              (filter === "rentable" ? i.rentable : !i.rentable)))),
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
      <div className="gear-fields">
        <Field
          label="Search inventory"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          Show inventory
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["active", "rentable", "non-rentable", "archived", "all"].map(
              (f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      {!rows.length && <Panel>No matching equipment.</Panel>}
      {rows.map((i) => (
        <Panel key={i.id}>
          <div className="toolbar">
            <div>
              <small>{types.find((t) => t.id === i.type_id)?.name}</small>
              <h3>{i.name}</h3>
            </div>
            <Button variant="quiet" onClick={() => setEditing(i)}>
              Edit
            </Button>
          </div>
          <p>
            {i.quantity} total ·{" "}
            {i.archived ? "Archived" : i.rentable ? "Rentable" : "Not rentable"}{" "}
            ·{" "}
            {i.ownership === "club" ? "Club owned" : "On loan from " + i.owner}
          </p>
          {i.description && <p>{i.description}</p>}
          {i.loan_start && i.loan_end && (
            <p>
              Loan period · {dateLabel(i.loan_start)} – {dateLabel(i.loan_end)}
            </p>
          )}
        </Panel>
      ))}
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
    </div>
  );
}
