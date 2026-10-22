import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  clock,
  dateLabel,
  fromPacific,
  pacificInput,
  useAction,
} from "../lib/api";
import type { Schema } from "../lib/api";
import { Button, Dialog, Field, Message } from "./ui";

export function MembershipSignupSettings({
  quarter,
  onClose,
}: {
  quarter: Schema<"QuarterPrivate">;
  onClose: () => void;
}) {
  const form = useForm({
    defaultValues: {
      start: pacificInput(quarter.membership_pause_starts_at),
      end: pacificInput(quarter.membership_pause_ends_at),
      message:
        quarter.membership_pause_message ||
        "New membership signups are temporarily paused to give current members time to sign up for retreat.",
    },
  });
  const action = useAction();
  const [expectedRevision] = useState(quarter.revision);
  const [error, setError] = useState<Error | null>(null);
  const start = form.watch("start"),
    end = form.watch("end");
  return (
    <Dialog title={`Membership signups · ${quarter.name}`} onClose={onClose}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          try {
            await action.mutateAsync({
              url: `/api/admin/quarters/${quarter.id}/membership-signups`,
              method: "PUT",
              body: {
                membership_pause_starts_at: fromPacific(values.start),
                membership_pause_ends_at: fromPacific(values.end),
                membership_pause_message: values.message,
                expected_revision: expectedRevision,
              },
            });
            onClose();
          } catch (err) {
            setError(err as Error);
          }
        })}
      >
        <p>
          Schedule a pause on new membership submissions. Pending dues can still
          be approved. Leave both dates blank to keep submissions open.
        </p>
        <div className="form-grid">
          <Field
            label="Pause starts · Pacific"
            type="datetime-local"
            required={!!end}
            {...form.register("start")}
          />
          <Field
            label="Reopens · Pacific"
            type="datetime-local"
            required={!!start}
            {...form.register("end")}
          />
        </div>
        <label className="field">
          Message for new members
          <textarea
            required={!!start}
            maxLength={500}
            {...form.register("message")}
          />
        </label>
        {quarter.membership_pause_ends_at && (
          <p>
            Current schedule reopens{" "}
            {dateLabel(quarter.membership_pause_ends_at)},{" "}
            {clock(quarter.membership_pause_ends_at)} Pacific.
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            form.setValue("start", "");
            form.setValue("end", "");
          }}
        >
          Clear pause dates
        </Button>
        <Message error={error || action.error} />
        <div className="sticky-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>Save Membership Settings</Button>
        </div>
      </form>
    </Dialog>
  );
}
