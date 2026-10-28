const member = {
  id: 2,
  name: "Alex Rivera",
  email: "alex@example.com",
  phone: "9495550100",
  approval_status: "approved",
  pronouns: "",
  discord: "",
  can_drive: false,
  student: false,
  driving_preferences: "",
  payout_method: "",
  payout_destination: "",
  payout_phone_suffix: "",
};
const quarter = {
  id: 1,
  name: "Fall adventures",
  starts_on: "2020-01-01",
  ends_on: "2099-12-31",
  state: "open",
  mpg: "25",
  budget: "100",
  driver_cap: "0",
  reimbursement_data_available: true,
};
const event = {
  id: 42,
  slug: "club-hike",
  name: "Crystal Cove coastal hike",
  quarter_id: 1,
  series_id: null,
  revision: 1,
  starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
  ends_at: new Date(Date.now() + 3 * 86400000 + 6 * 3600000).toISOString(),
  destination: "Crystal Cove State Park",
  state: "published",
  signups_enabled: true,
  kind: "regular",
  questions: [],
  packing: [],
  signup_count: 0,
  paid_riders: 0,
  offered_seats: 0,
  signup_counts_by_role: { own: 0, ride: 0, driver: 0 },
  signup_status: "open",
  signup_cap_total: null,
  signup_cap_ride: null,
  signup_cap_driver: null,
  signup_cap_own: null,
  photo_id: null,
  description:
    "A relaxed coastal hike with ocean views. Meet at the flagpoles for carpools.",
  completion: null,
  has_signups: false,
  miles: "10",
  gas_price: "4",
  rate: "0.16",
  rate_override: null,
};

const permissions = [
  "events",
  "participation",
  "members",
  "reimbursements",
  "board",
];
export function createState(role) {
  const now = Date.now();
  return {
    permissions:
      role === "payments"
        ? ["reimbursements"]
        : role === "combined"
          ? ["events", "participation"]
          : permissions.includes(role)
            ? [role]
            : [],
    full: role === "full",
    expiry: new Date(now + 7 * 86400000).toISOString(),
    closed: role === "payments",
    event: { ...structuredClone(event), departure_at: event.starts_at },
    recap: {
      title: "A morning on the coast",
      caption: "Fresh air, good company.",
      text: "Our members explored the bluffs above Crystal Cove and stopped for a picnic overlooking the Pacific.",
      image_id: null,
      homepage: false,
    },
    board: [
      {
        id: 1,
        term_id: 1,
        name: "Morgan Chen",
        role: "Adventure Coordinator",
        major: "Environmental Science",
        bio: "Always looking for the next trail to explore.",
        memory: "Sunrise at the summit.",
        instagram: "",
        photo_id: null,
        palette: "green",
        position: 0,
        member_id: 1,
        visible: true,
        revision: 1,
        site_access: false,
      },
    ],
    signups: [
      {
        id: 1,
        member_id: 2,
        event_id: 42,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: "ride",
        vehicle_id: null,
        vehicle: null,
        seats: null,
        answers: {},
        notes: "",
        cancelled: false,
        checked_in_at: null,
        joined_at: new Date(now).toISOString(),
        attendance_status: "registered",
        extended_until: null,
        released: false,
        paid: true,
        revision: 1,
        card: null,
        assigned_car: null,
        estimated_trip: null,
        driver_signup_id: null,
        editable: true,
        event: null,
      },
    ],
    drivers: [
      {
        member_id: 2,
        name: member.name,
        email: member.email,
        payout_method: "Venmo",
        payout_destination: "@demo-alex",
        payout_phone_suffix: "0100",
        membership_approved: true,
        eligible: true,
        eligible_override: null,
        eligibility_reason: "Approved member",
        nominal: "16",
        eligible_cost: "16",
        capped: "16",
        allocated: "16",
        payout_id: 1,
        paid_on: null,
        reference: "",
        trips: [],
      },
    ],
    grants: [
      {
        member_id: 3,
        name: "Jordan Lee",
        email: "jordan@example.com",
        permissions: ["participation"],
        expires_at: new Date(now + 3 * 86400000).toISOString(),
        active: true,
      },
      {
        member_id: 4,
        name: "Sam Patel",
        email: "sam@example.com",
        permissions: ["events", "board"],
        expires_at: new Date(now - 86400000).toISOString(),
        active: false,
      },
    ].map((g) => ({
      ...g,
      granted_by: 1,
      updated_by: 1,
      granted_at: new Date(now - 7 * 86400000).toISOString(),
      updated_at: new Date(now).toISOString(),
      revision: 1,
    })),
  };
}
export function respond(state, path, method, input = {}) {
  let json;
  if (path === "/api/site-settings")
    return {
      status: 200,
      body: {
        venmo: "",
        zelle: "",
        zelle_name: "",
        cash: "Pay an officer",
        discord: "",
      },
    };
  if (path === "/api/session")
    json = {
      member: {
        ...member,
        ...(state.full ? { id: 1, name: "Morgan Chen" } : {}),
      },
      officer: state.full,
      oauth_available: true,
      profile_complete: true,
      officer_access: {
        kind: state.full
          ? "full"
          : state.permissions.length &&
              new Date(state.expiry).getTime() > Date.now()
            ? "guest"
            : "none",
        permissions: state.permissions,
        expires_at: state.full ? null : state.expiry,
      },
      server_time: new Date().toISOString(),
    };
  else if (path === "/api/quarters" || path === "/api/admin/quarters")
    json = {
      items: [{ ...quarter, state: state.closed ? "finalized" : "open" }],
      total: 1,
    };
  else if (path === "/api/admin/events")
    json = {
      items: [
        state.event,
        { ...event, id: 43, name: "Sunset trail walk", series_id: null },
        { ...event, id: 44, name: "Weekend trail walk", series_id: null },
      ],
      total: 3,
    };
  else if (/^\/api\/admin\/events\/\d+$/.test(path)) json = state.event;
  else if (
    path.endsWith("/signups") ||
    path.endsWith("/trips") ||
    path.endsWith("/check-in-log")
  )
    json = {
      items: path.endsWith("/signups") ? state.signups : [],
      total: path.endsWith("/signups") ? state.signups.length : 0,
    };
  else if (path.endsWith("/recap"))
    json = {
      event_id: 42,
      draft: state.recap,
      published: null,
      completion: null,
      has_signups: false,
      revision: 0,
    };
  else if (path === "/api/admin/board/terms")
    json = {
      items: [
        {
          id: 1,
          label: "Current board",
          start_year: 2026,
          current: true,
          revision: 1,
        },
      ],
    };
  else if (path === "/api/admin/board/terms/1")
    json = {
      term: {
        id: 1,
        label: "Current board",
        start_year: 2026,
        current: true,
        revision: 1,
      },
      entries: state.board,
    };
  else if (path === "/api/admin/officers")
    json = {
      items: [
        {
          member_id: 1,
          name: "Morgan Chen",
          email: "morgan@example.com",
          granted_at: "2026-01-01T00:00:00Z",
        },
      ],
    };
  else if (path === "/api/admin/member-lookup" || path === "/api/admin/members")
    json = {
      items: [
        {
          member,
          membership: null,
          bans: [],
          application_submitted_at: null,
        },
      ],
      total: 1,
      quarter_id: 1,
    };
  else if (path === "/api/admin/members/2")
    json = {
      member,
      membership: null,
      bans: [],
      memberships: [],
      signups: [],
      officer: false,
    };
  else if (path === "/api/admin/members/2/application")
    json = { status: "approved", previous_applications: [] };
  else if (path === "/api/admin/quarters/1/reimbursements")
    json = {
      quarter_id: 1,
      state: state.closed ? "finalized" : "open",
      reimbursement_data_available: true,
      budget: "100",
      driver_cap: "0",
      coverage: "1",
      totals: { nominal: "16", allocated: "16", pending: "16", paid: "0" },
      drivers: state.drivers,
      events: [{ ...state.event, trip_count: 1, cost: "16.00" }],
    };
  else if (path === "/api/me/overview")
    json = { quarter_id: 1, membership: null, next_event: null, signups: [] };
  else if (path === "/api/me/restrictions") json = { items: [] };
  else if (path.startsWith("/api/me/memberships/"))
    json = { status: "general" };
  else if (path.startsWith("/api/admin/guest-officers")) {
    if (method === "POST" || method === "PUT") {
      const body = input;

      const grant = {
        ...body,
        member_id: body.member_id || Number(path.split("/").pop()),
        name:
          state.grants.find(
            (g) => g.member_id === Number(path.split("/").pop()),
          )?.name || member.name,
        email:
          state.grants.find(
            (g) => g.member_id === Number(path.split("/").pop()),
          )?.email || member.email,
        revision:
          (state.grants.find(
            (g) => g.member_id === Number(path.split("/").pop()),
          )?.revision || 0) + 1,
        granted_by: 1,
        updated_by: 1,
        granted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active: true,
      };
      state.grants = [
        ...state.grants.filter((g) => g.member_id !== grant.member_id),
        grant,
      ];
      json = grant;
    } else if (method === "DELETE") {
      state.grants = state.grants.filter(
        (g) => g.member_id !== Number(path.split("/").pop()),
      );
      json = { ok: true };
    } else json = { items: state.grants };
  }

  if (path.endsWith("/check-in"))
    json = {
      event: state.event,
      revision: 1,
      server_time: new Date().toISOString(),
      signups: state.signups,
      counts: {
        ride: { registered: 1, arrived: 0 },
        driver: { registered: 0, arrived: 0 },
        own: { registered: 0, arrived: 0 },
      },
      next_cards: { ride: 1, driver: 1, own: 1 },
      inventory: { ride: 0, driver: 0, own: 0 },
      cards: [],
      extension_chips: [],
    };
  if (path.endsWith("/questions"))
    json = { questions: [], totals: {}, items: [] };
  if (path.endsWith("/vehicles")) json = { items: [] };
  if (method !== "GET" && !path.startsWith("/api/admin/guest-officers")) {
    if (path === "/api/admin/events/42" && method === "PUT")
      json = Object.assign(state.event, input, {
        revision: state.event.revision + 1,
      });
    else if (path === "/api/admin/events/42/recap" && method === "PUT") {
      Object.assign(state.recap, input);
      json = { event_id: 42, draft: state.recap, published: null, revision: 1 };
    } else if (
      /^\/api\/admin\/board\/entries\/\d+$/.test(path) &&
      method === "PUT"
    ) {
      json = Object.assign(state.board[0], input, {
        revision: state.board[0].revision + 1,
      });
    } else if (path === "/api/admin/events/42/mileage") {
      json = Object.assign(state.event, input);
    } else
      return {
        status: 501,
        body: {
          detail: {
            message:
              "This action is outside the local preview. Try Guest access management, event editing, recaps, board profile editing, or mileage.",
          },
        },
      };
  }
  return json === undefined
    ? {
        status: 404,
        body: {
          detail: {
            message: "This screen is outside the local Guest access preview.",
          },
        },
      }
    : { status: 200, body: json };
}
