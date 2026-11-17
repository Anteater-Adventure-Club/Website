import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAPI } from "../lib/api";
import type { Schema } from "../lib/api";
import { quarterURL, useQuarter } from "../lib/context";
import { useMembershipPause } from "./membership-pause";
import { useRestrictions } from "./restrictions";
import { Panel, Loading, Failure } from "./ui";

export function GearMembershipCard({
  eyebrow,
  title,
  children,
  link,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  link?: { to: string; label: string };
}) {
  return (
    <Panel className="gear-membership-card">
      <span className="membership-eyebrow muted">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{children}</p>
      {link && (
        <Link className="button primary" to={link.to}>
          {link.label}
        </Link>
      )}
    </Panel>
  );
}

export function GearDuesCard({
  catalog,
  assign,
}: {
  catalog: Schema<"GearCatalog">;
  assign: boolean;
}) {
  const id = catalog.quarter_id;
  if (!id)
    return (
      <GearMembershipCard
        eyebrow="Rental dates"
        title="Choose a pickup date in a membership quarter"
      >
        No membership quarter covers the selected pickup date. Choose another
        date or contact an officer.
      </GearMembershipCard>
    );
  if (assign)
    return (
      <GearMembershipCard
        eyebrow="Membership dues"
        title="Paid membership required"
      >
        This member needs approved dues for {catalog.quarter_name} before you
        can assign gear.
      </GearMembershipCard>
    );
  return <MemberDuesCard id={id} name={catalog.quarter_name} />;
}

function MemberDuesCard({ id, name }: { id: number; name: string | null }) {
  const membership = useAPI("MembershipView", `/api/me/memberships/${id}`);
  const restrictions = useRestrictions();
  const { quarters, loading } = useQuarter();
  const quarter = quarters.find((q) => q.id === id);
  const paused = useMembershipPause(quarter);
  const statusLink = {
    to: quarterURL("/my-aac/membership", id),
    label: "View membership status",
  };
  if (membership.error)
    return <Failure error={membership.error} retry={membership.refetch} />;
  if (restrictions.error)
    return <Failure error={restrictions.error} retry={restrictions.refetch} />;
  if (!membership.data || restrictions.isPending || loading) return <Loading />;
  const pending = membership.data.status === "pending";
  if (restrictions.membershipRestricted)
    return (
      <GearMembershipCard
        eyebrow="Your membership"
        title={
          pending
            ? "Your payment submission is on hold"
            : "Membership signup is restricted"
        }
        link={statusLink}
      >
        {pending
          ? "An officer can confirm your dues after the membership restriction ends."
          : "View your membership status for details about the restriction on your account."}
      </GearMembershipCard>
    );
  if (pending)
    return (
      <GearMembershipCard
        eyebrow="Payment submitted"
        title="Your dues are awaiting approval"
        link={statusLink}
      >
        An officer will review your payment for {name}. You can request gear
        once your dues are confirmed.
      </GearMembershipCard>
    );
  if (quarter?.state !== "open" || paused)
    return (
      <GearMembershipCard
        eyebrow="Membership dues"
        title={
          paused
            ? "Membership signups are temporarily paused"
            : "Membership signup unavailable"
        }
        link={statusLink}
      >
        {paused && quarter?.membership_pause_message
          ? quarter.membership_pause_message
          : `Gear rental requires approved membership for ${name}. Choose another pickup date or contact an officer.`}
      </GearMembershipCard>
    );
  return (
    <GearMembershipCard
      eyebrow="Membership dues"
      title={`Pay dues for ${name}`}
      link={{
        to: quarterURL("/membership", id),
        label: "Go to Membership Signup",
      }}
    >
      Gear rental is a paid membership benefit. Submit your payment details for
      the pickup quarter to request club gear once an officer confirms your
      dues.
    </GearMembershipCard>
  );
}
