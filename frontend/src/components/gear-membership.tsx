import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAPI } from "../lib/api";
import type { Schema } from "../lib/api";
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
  const membership = useAPI("MembershipView", `/api/me/memberships/${id}`, {
    enabled: !!id && !assign,
  });
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
  if (membership.error)
    return <Failure error={membership.error} retry={membership.refetch} />;
  if (!membership.data) return <Loading />;
  if (membership.data.status === "pending")
    return (
      <GearMembershipCard
        eyebrow="Payment submitted"
        title="Your dues are awaiting approval"
        link={{
          to: `/my-aac/membership?quarter=${id}`,
          label: "View membership status",
        }}
      >
        An officer is reviewing your payment for {catalog.quarter_name}. You can
        request gear once your dues are confirmed.
      </GearMembershipCard>
    );
  return (
    <GearMembershipCard
      eyebrow="Membership dues"
      title={`Pay dues for ${catalog.quarter_name}`}
      link={{
        to: `/membership?quarter=${id}`,
        label: "Go to Membership Signup",
      }}
    >
      Gear rental is a paid membership benefit. Submit your payment details for
      the pickup quarter to request club gear once an officer confirms your
      dues.
    </GearMembershipCard>
  );
}
