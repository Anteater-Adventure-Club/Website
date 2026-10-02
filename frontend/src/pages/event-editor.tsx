import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  dateLabel,
  eventURL,
  fromPacific,
  pacificDate,
  pacificInput,
  request,
  useAction,
  useAPI,
} from "../lib/api";
import type { AdminEvent, Schema } from "../lib/api";
import { useQuarter } from "../lib/context";
import {
  Button,
  Dialog,
  Empty,
  Failure,
  Field,
  Loading,
  Message,
  PageHeading,
  Panel,
  Pill,
} from "../components/ui";
import {
  DeleteDraftButton,
  ImageUpload,
  SetupQuarter,
} from "../components/officer-forms";

type EditorValues = {
  name: string;
  kind: Schema<"EventWrite-Input">["kind"];
  destination: string;
  description: string;
  starts: string;
  ends: string;
  signups: boolean;
  opens: string;
  closes: string;
  arrival: string;
  departure: string;
  back: string;
  miles: string;
  gas: string;
  rate: string;
  packing: string;
};
type Recurrence = "none" | "weekly" | "alternating";

function Editor({
  initial,
  series,
}: {
  initial?: AdminEvent;
  series?: Schema<"SeriesView">;
}) {
  const { quarter, quarters } = useQuarter();
  const navigate = useNavigate();
  const definition = series?.definition;
  const source = definition?.event || initial;
  const qid = source?.quarter_id || quarter?.id;
  const selectedQuarter = quarters.find((q) => q.id === qid);
  const day =
    selectedQuarter && selectedQuarter.starts_on > pacificDate()
      ? selectedQuarter.starts_on
      : pacificDate();
  const form = useForm<EditorValues>({
    defaultValues: {
      name: source?.name || "",
      kind: source?.kind || "regular",
      destination: source?.destination || "",
      description: source?.description || "",
      starts: source ? pacificInput(source.starts_at) : `${day}T10:30`,
      ends: source ? pacificInput(source.ends_at) : `${day}T16:00`,
      signups: source?.signups_enabled ?? true,
      opens: pacificInput(source?.opens_at),
      closes: pacificInput(source?.closes_at),
      arrival: pacificInput(source?.arrival_at),
      departure: pacificInput(source?.departure_at),
      back: pacificInput(source?.return_at),
      miles: String(source?.miles || "0"),
      gas: String(source?.gas_price || "0"),
      rate:
        source?.rate_override === null || source?.rate_override === undefined
          ? ""
          : String(source.rate_override),
      packing: source?.packing?.join("\n") || "",
    },
  });
  const [tab, setTab] = useState("basics");
  const [recurrence, setRecurrence] = useState<Recurrence>(
    definition?.kind || "none",
  );
  const [until, setUntil] = useState(
    definition?.until || selectedQuarter?.ends_on || "",
  );
  const [weekA, setWeekA] = useState<number[]>(definition?.weekdays_a || [0]);
  const [weekB, setWeekB] = useState<number[]>(definition?.weekdays_b || []);
  const [excluded, setExcluded] = useState(
    definition?.excluded?.join("\n") || "",
  );
  const [effective, setEffective] = useState(pacificDate());
  const [questions, setQuestions] = useState<Schema<"Question">[]>(
    source?.questions || [],
  );
  const [photo, setPhoto] = useState(source?.photo_id);
  const [dates, setDates] = useState<
    { date: string; starts_at: string; ends_at: string }[]
  >([]);
  const [localError, setLocalError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [singleConfirmation, setSingleConfirmation] = useState<boolean | null>(
    null,
  );
  const draftSeries =
    !!series &&
    series.occurrences.every((e) => e.state === "draft" && !e.participated);
  const convertibleSeries =
    draftSeries && series!.occurrences.some((e) => !e.skipped);
  const action = useAction();
  const roster = useAPI(
    "Page_SignupPrivate_",
    `/api/admin/events/${initial?.id}/signups?limit=1`,
    { enabled: !!initial?.signups_enabled },
  );
  const frozenIds = new Set(
    roster.data?.total ? initial?.questions.map((q) => q.id) : [],
  );
  const enabled = form.watch("signups");
  function eventBody(values: EditorValues): Schema<"EventWrite-Input"> {
    if (!qid) throw new Error("Create a quarter before saving an event.");
    return {
      quarter_id: qid,
      name: values.name,
      kind: values.kind,
      destination: values.destination,
      description: values.description,
      starts_at: fromPacific(values.starts)!,
      ends_at: fromPacific(values.ends)!,
      signups_enabled: values.signups,
      opens_at: values.signups ? fromPacific(values.opens) : null,
      closes_at: values.signups ? fromPacific(values.closes) : null,
      arrival_at: values.signups ? fromPacific(values.arrival) : null,
      departure_at: values.signups ? fromPacific(values.departure) : null,
      return_at: values.signups ? fromPacific(values.back) : null,
      packing: values.packing
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      questions: values.signups ? questions : [],
      photo_id: photo || null,
      miles: values.signups ? values.miles : "0",
      gas_price: values.signups ? values.gas : "0",
      rate_override: values.signups && values.rate ? values.rate : null,
      expected_revision: initial?.revision,
    };
  }
  function seriesBody(values: EditorValues): Schema<"SeriesWrite-Input"> {
    const event = eventBody(values);
    return {
      event,
      kind: recurrence === "alternating" ? "alternating" : "weekly",
      starts_on: values.starts.slice(0, 10),
      until,
      start_time: values.starts.slice(11),
      end_time: values.ends.slice(11),
      weekdays_a: weekA,
      weekdays_b: recurrence === "alternating" ? weekB : [],
      excluded: excluded.split(/[\s,]+/).filter(Boolean),
      effective_from: series ? effective : null,
      expected_revision: series?.revision ?? initial?.revision,
      request_id: definition?.request_id || requestId,
    };
  }
  const [requestId] = useState(crypto.randomUUID());
  async function preview() {
    setLocalError(null);
    try {
      const body = seriesBody(form.getValues());
      const result = await request<{ items: typeof dates }>(
        "/api/admin/series/preview",
        "POST",
        body,
      );
      setDates(result.items);
    } catch (error) {
      setLocalError(error as Error);
    }
  }
  async function save(publish: boolean, confirmedSingle = false) {
    if (series && recurrence === "none" && !confirmedSingle) {
      setSingleConfirmation(publish);
      return;
    }
    setLocalError(null);
    action.reset();
    setSaving(true);
    try {
      const values = form.getValues();
      if (recurrence !== "none") {
        const result = await request<Schema<"SeriesView">>(
          series
            ? `/api/admin/series/${series.id}`
            : initial
              ? `/api/admin/events/${initial.id}/series`
              : "/api/admin/series",
          series ? "PUT" : "POST",
          seriesBody(values),
        );
        if (publish)
          await request(`/api/admin/series/${result.id}/publish`, "POST", {
            expected_revision: result.revision,
          });
        await action.mutateAsync({
          url: `/api/admin/series/${result.id}`,
          method: "GET",
        });
        navigate(`/admin/series/${result.id}`);
      } else {
        const result = await request<AdminEvent>(
          series
            ? `/api/admin/series/${series.id}/single`
            : `/api/admin/events${initial ? `/${initial.id}` : ""}`,
          initial ? "PUT" : "POST",
          series
            ? ({
                event: eventBody(values),
                expected_revision: series.revision,
              } satisfies Schema<"SeriesSingleWrite">)
            : eventBody(values),
        );
        if (publish && result.state === "draft")
          await request(`/api/admin/events/${result.id}/state`, "POST", {
            state: "published",
            expected_revision: result.revision,
          });
        await action.mutateAsync({
          url: `/api/admin/events/${result.id}`,
          method: "GET",
        });
        navigate(eventURL(result, true));
      }
    } catch (error) {
      setLocalError(error as Error);
    } finally {
      setSaving(false);
    }
  }
  function changeQuestion(id: string, value: Partial<Schema<"Question">>) {
    setQuestions((old) =>
      old.map((q) => (q.id === id ? { ...q, ...value } : q)),
    );
  }
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekControls = (
    label: string,
    values: number[],
    set: (values: number[]) => void,
  ) => (
    <fieldset>
      <legend>{label}</legend>
      <div className="weekday-buttons">
        {weekdays.map((name, i) => (
          <button
            type="button"
            key={name}
            aria-pressed={values.includes(i)}
            onClick={() =>
              set(
                values.includes(i)
                  ? values.filter((v) => v !== i)
                  : [...values, i].sort(),
              )
            }
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  );
  if (!selectedQuarter) return <SetupQuarter />;
  if (
    selectedQuarter.state !== "open" ||
    (initial && ["completed", "cancelled"].includes(initial.state))
  )
    return (
      <Empty title="This event is locked">
        Use the event’s Trips & Mileage or Recap tab for the fields that can
        still be edited.
      </Empty>
    );
  return (
    <>
      <Link className="text-link" to="/admin/events">
        <ArrowLeft size={16} />
        Events
      </Link>
      <PageHeading
        title={
          series
            ? "Edit recurring series"
            : initial
              ? "Edit event"
              : "New event"
        }
        subtitle={`${selectedQuarter.name} · All times are America/Los_Angeles.`}
      >
        {initial?.state === "draft" && (
          <DeleteDraftButton
            url={`/api/admin/events/${initial.id}`}
            revision={initial.revision}
            name={initial.name}
            quarterId={initial.quarter_id}
          />
        )}
        {draftSeries && (
          <DeleteDraftButton
            url={`/api/admin/series/${series!.id}`}
            revision={series!.revision}
            name={series!.definition.event.name}
            quarterId={series!.definition.event.quarter_id}
            count={series!.occurrences.length}
          />
        )}
      </PageHeading>
      <div className="tabs" role="tablist" aria-label="Event editor sections">
        <button
          role="tab"
          aria-selected={tab === "basics"}
          onClick={() => setTab("basics")}
        >
          Basics
        </button>
        <button
          role="tab"
          aria-selected={tab === "signups"}
          onClick={() => setTab("signups")}
        >
          Signups & Carpools
        </button>
      </div>
      <form onSubmit={form.handleSubmit(() => save(false))}>
        <div className="split-layout">
          <Panel>
            <div className={tab === "basics" ? "stack" : "hidden"}>
              <Field
                label="Event name"
                required
                maxLength={150}
                {...form.register("name")}
              />
              <label className="field">
                Event type
                <select
                  {...form.register("kind")}
                  onChange={(e) => {
                    form.setValue(
                      "kind",
                      e.target.value as EditorValues["kind"],
                    );
                    if (!source)
                      form.setValue(
                        "signups",
                        !["meeting", "picnic"].includes(e.target.value),
                      );
                  }}
                >
                  <option value="regular">Adventure / regular event</option>
                  <option value="meeting">Club meeting</option>
                  <option value="picnic">Potluck picnic</option>
                  <option value="retreat">
                    Retreat · paid membership required
                  </option>
                </select>
              </label>
              <Field
                label="Destination / meeting point"
                maxLength={200}
                {...form.register("destination")}
              />
              <div className="form-grid">
                <Field
                  label="Starts · Pacific"
                  type="datetime-local"
                  required
                  {...form.register("starts")}
                />
                <Field
                  label="Ends · Pacific"
                  type="datetime-local"
                  required
                  {...form.register("ends")}
                />
              </div>
              <label className="field">
                Description
                <textarea
                  maxLength={10000}
                  rows={5}
                  {...form.register("description")}
                />
              </label>
              <label className="field">
                What to bring<small>One item per line</small>
                <textarea maxLength={10000} {...form.register("packing")} />
              </label>
              <ImageUpload purpose="event" value={photo} onChange={setPhoto} />
              {photo && (
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => setPhoto(null)}
                >
                  Remove Photo from Event
                </Button>
              )}
              <label className="check-field">
                <input
                  type="checkbox"
                  {...form.register("signups")}
                  disabled={!!roster.data?.total}
                />
                Enable signups, carpools, check-in and driver trips
              </label>
              {!enabled && (
                <Message>
                  This event is open to attend without signing up. Operational
                  tabs are disabled.
                </Message>
              )}
            </div>
            <div className={tab === "signups" ? "stack" : "hidden"}>
              {enabled ? (
                <>
                  <h3>Signup window</h3>
                  <div className="form-grid">
                    <Field
                      label="Opens · Pacific"
                      type="datetime-local"
                      {...form.register("opens")}
                    />
                    <Field
                      label="Closes · Pacific"
                      type="datetime-local"
                      {...form.register("closes")}
                    />
                  </div>
                  <small className="muted">
                    Blank opening means immediately on publication; blank
                    closing means event start.
                  </small>
                  <h3>Transportation</h3>
                  <div className="form-grid">
                    <Field
                      label="Arrive / meet · Pacific"
                      type="datetime-local"
                      {...form.register("arrival")}
                    />
                    <Field
                      label="Depart · Pacific"
                      type="datetime-local"
                      {...form.register("departure")}
                    />
                    <Field
                      label="Return · Pacific"
                      type="datetime-local"
                      {...form.register("back")}
                    />
                  </div>
                  <h3>Trips & Mileage</h3>
                  <div className="form-grid">
                    <Field
                      label="Round-trip miles"
                      type="number"
                      min={0}
                      step=".01"
                      {...form.register("miles")}
                    />
                    <Field
                      label="Gas price ($/gal)"
                      type="number"
                      min={0}
                      step=".001"
                      {...form.register("gas")}
                    />
                    <Field
                      label="Rate override ($/mi)"
                      type="number"
                      min={0}
                      step=".000001"
                      {...form.register("rate")}
                      hint={`Optional. Otherwise gas price ÷ ${selectedQuarter && "quarter MPG"}.`}
                    />
                  </div>
                  <h3>Custom questions</h3>
                  <p className="muted">
                    Contact details, ride situation, car and offered seats are
                    built in.
                  </p>
                  {roster.data?.total ? (
                    <Message>
                      Existing questions are frozen after the first signup. New
                      questions must be optional.
                    </Message>
                  ) : null}
                  {questions.map((question) => (
                    <Panel className="question-editor" key={question.id}>
                      <Field
                        label="Question"
                        value={question.label}
                        maxLength={200}
                        required
                        disabled={frozenIds.has(question.id)}
                        onChange={(e) =>
                          changeQuestion(question.id, { label: e.target.value })
                        }
                      />
                      <label className="field">
                        Answer type
                        <select
                          value={question.kind || "text"}
                          disabled={frozenIds.has(question.id)}
                          onChange={(e) =>
                            changeQuestion(question.id, {
                              kind: e.target
                                .value as Schema<"Question">["kind"],
                              options:
                                e.target.value === "choice"
                                  ? ["Option 1", "Option 2"]
                                  : [],
                            })
                          }
                        >
                          <option value="text">Short text</option>
                          <option value="long">Long text</option>
                          <option value="choice">Multiple choice</option>
                          <option value="yes-no">Yes / No</option>
                        </select>
                      </label>
                      {question.kind === "choice" && (
                        <label className="field">
                          Choices · one per line
                          <textarea
                            disabled={frozenIds.has(question.id)}
                            value={question.options?.join("\n") || ""}
                            onChange={(e) =>
                              changeQuestion(question.id, {
                                options: e.target.value.split("\n"),
                              })
                            }
                          />
                        </label>
                      )}
                      <div className="toolbar">
                        <label className="check-field">
                          <input
                            type="checkbox"
                            checked={question.required || false}
                            disabled={
                              frozenIds.has(question.id) || !!roster.data?.total
                            }
                            onChange={(e) =>
                              changeQuestion(question.id, {
                                required: e.target.checked,
                              })
                            }
                          />
                          Required
                        </label>
                        <Button
                          type="button"
                          variant="quiet"
                          aria-label={`Remove question ${question.label}`}
                          disabled={frozenIds.has(question.id)}
                          onClick={() =>
                            setQuestions((old) =>
                              old.filter((q) => q.id !== question.id),
                            )
                          }
                        >
                          <Trash2 size={16} />
                          Remove
                        </Button>
                      </div>
                    </Panel>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setQuestions((old) => [
                        ...old,
                        {
                          id: crypto.randomUUID(),
                          label: "",
                          kind: "text",
                          required: false,
                          options: [],
                        },
                      ])
                    }
                  >
                    <Plus size={16} />
                    Add Question
                  </Button>
                </>
              ) : (
                <Empty title="No signups needed">
                  Enable signups in Basics to configure rides, custom questions,
                  and trip mileage.
                </Empty>
              )}
            </div>
          </Panel>
          <aside className="stack">
            <Panel>
              <h3>Repeats</h3>
              <label className="field">
                Schedule
                <select
                  value={recurrence}
                  disabled={
                    !!initial &&
                    (!!initial.series_id || initial.state !== "draft")
                  }
                  onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                >
                  <option
                    value="none"
                    disabled={!!series && !convertibleSeries}
                  >
                    One event · can span multiple days
                  </option>
                  <option value="weekly">Every week</option>
                  <option value="alternating">Alternating A / B weeks</option>
                </select>
              </label>
              {initial?.series_id && (
                <p>
                  Changes apply only to this date.{" "}
                  <Link to={`/admin/series/${initial.series_id}/edit`}>
                    Edit the recurring schedule
                  </Link>{" "}
                  to change repeats.
                </p>
              )}
              {series && !convertibleSeries && (
                <p className="muted">
                  Published or participating dates keep their history. Only an
                  unused draft series can become one event.
                </p>
              )}
              {recurrence !== "none" && (
                <div className="stack section">
                  <Field
                    label="Repeat through · inclusive"
                    type="date"
                    required
                    min={form.watch("starts").slice(0, 10)}
                    max={selectedQuarter.ends_on}
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                  />
                  {weekControls(
                    recurrence === "alternating" ? "Week A" : "Weekdays",
                    weekA,
                    setWeekA,
                  )}
                  {recurrence === "alternating" && (
                    <>
                      {weekControls("Week B", weekB, setWeekB)}
                      <small>
                        Week A is the Monday-containing week of the first date.
                        Leave B empty to repeat every other week.
                      </small>
                    </>
                  )}
                  {series && (
                    <Field
                      label="Apply from · future dates only"
                      type="date"
                      min={pacificDate()}
                      value={effective}
                      onChange={(e) => setEffective(e.target.value)}
                    />
                  )}
                  <label className="field">
                    Skip dates<small>YYYY-MM-DD, one per line</small>
                    <textarea
                      value={excluded}
                      onChange={(e) => setExcluded(e.target.value)}
                      rows={3}
                    />
                  </label>
                  <Button type="button" variant="secondary" onClick={preview}>
                    Preview Dates
                  </Button>
                  {dates.length > 0 && (
                    <div className="scroll-list">
                      <h4>{dates.length} occurrences</h4>
                      {dates.map((date) => (
                        <p className="preview-date" key={date.date}>
                          {dateLabel(date.starts_at)}{" "}
                          <small>
                            {pacificInput(date.starts_at).slice(11)}
                          </small>
                        </p>
                      ))}
                    </div>
                  )}
                  {series && (
                    <Message>
                      Past, closed, and individually overridden dates stay
                      unchanged. Participating future dates must be edited
                      individually.
                    </Message>
                  )}
                </div>
              )}
            </Panel>
            <Panel>
              <h3>{source ? "Save your changes" : "Ready for adventure?"}</h3>
              <p className="muted">
                A draft stays private. Publish to put the event on the club
                calendar.
              </p>
              <Message error={localError || action.error} />
              <div className="stack">
                <Button disabled={saving}>
                  {saving ? "Saving…" : source ? "Save Changes" : "Save Draft"}
                </Button>
                {(!initial || initial.state === "draft") && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => {
                      void form.trigger().then((valid) => {
                        if (valid) return save(true);
                      });
                    }}
                  >
                    Save & Publish
                  </Button>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </form>
      {singleConfirmation !== null && (
        <Dialog
          title="Make this a single event?"
          onClose={() => setSingleConfirmation(null)}
        >
          <p>
            Keep the first active draft as one event and permanently delete the
            other draft dates in this series.
          </p>
          <Message error={localError} />
          <div className="form-actions">
            <Button
              type="button"
              variant="quiet"
              onClick={() => setSingleConfirmation(null)}
            >
              Keep Recurring
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                void save(singleConfirmation, true);
              }}
            >
              Make Single Event
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function EventEditor() {
  const { id } = useParams();
  const event = useAPI("EventPrivate", `/api/admin/events/${id}`, {
    enabled: !!id,
  });
  if (!id) return <Editor />;
  if (event.isPending) return <Loading />;
  if (event.error) return <Failure error={event.error} retry={event.refetch} />;
  return <Editor key={event.data.id} initial={event.data} />;
}

export function SeriesEditor() {
  const { id } = useParams();
  const query = useAPI("SeriesView", `/api/admin/series/${id}`);
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  return <Editor key={query.data.id} series={query.data} />;
}

export function SeriesDetail() {
  const { id } = useParams();
  const query = useAPI("SeriesView", `/api/admin/series/${id}`);
  const { quarters } = useQuarter();
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  const series = query.data;
  const quarter = quarters.find(
    (q) => q.id === series.definition.event.quarter_id,
  );
  const deletable =
    quarter?.state === "open" &&
    series.occurrences.every((e) => e.state === "draft" && !e.participated);
  return (
    <>
      <Link className="text-link" to="/admin/events">
        <ArrowLeft size={16} />
        Events
      </Link>
      <PageHeading
        title={query.data.definition.event.name}
        subtitle="One series, individual adventures."
      >
        <Link className="button secondary" to={`/admin/series/${id}/edit`}>
          Edit This & Future Dates
        </Link>
        {deletable && (
          <DeleteDraftButton
            url={`/api/admin/series/${id}`}
            revision={series.revision}
            name={series.definition.event.name}
            quarterId={series.definition.event.quarter_id}
            count={series.occurrences.length}
          />
        )}
      </PageHeading>
      <div className="stack">
        {query.data.occurrences.map((e) => (
          <Panel className="record-card" key={e.id}>
            <div>
              <div className="actions">
                <Pill>{e.skipped ? "Skipped" : e.state}</Pill>
                {e.exception && <Pill tone="orange">Individual exception</Pill>}
                {e.participated && <Pill>Has participants</Pill>}
              </div>
              <h3>{e.name}</h3>
              <p>
                {dateLabel(e.starts_at)} · {e.destination}
              </p>
            </div>
            <Link className="button primary" to={eventURL(e, true)}>
              Manage This Date
            </Link>
          </Panel>
        ))}
      </div>
    </>
  );
}
