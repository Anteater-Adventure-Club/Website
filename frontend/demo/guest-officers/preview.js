(() => {
  const params = new URLSearchParams(location.search);
  const role =
    params.get("guestDemo") ||
    sessionStorage.getItem("aac-demo-role") ||
    "expired";
  sessionStorage.setItem("aac-demo-role", role);
  if (!sessionStorage.getItem("aac-demo-session"))
    sessionStorage.setItem("aac-demo-session", crypto.randomUUID());
  const original = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = new URL(
      input instanceof Request ? input.url : input,
      location.href,
    );
    if (
      url.origin === location.origin &&
      (url.pathname.startsWith("/api/") || url.pathname === "/demo/control")
    ) {
      const headers = new Headers(
        init.headers || (input instanceof Request ? input.headers : undefined),
      );
      headers.set("x-demo-role", role);
      headers.set("x-demo-session", sessionStorage.getItem("aac-demo-session"));
      return original(input, { ...init, headers });
    }
    return original(input, init);
  };
  addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent =
      "#demo-bar{position:relative;z-index:40;display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 20px;background:#173d34;color:#fff;font:13px/1.5 system-ui}#demo-bar a{color:#fff;text-decoration:underline}#demo-bar span{flex:1}#demo-bar button{background:#fff;color:#173d34;border:0;border-radius:5px;padding:5px 10px;font:inherit;cursor:pointer}";
    document.head.append(style);
    const bar = document.createElement("aside");
    bar.id = "demo-bar";
    bar.setAttribute("aria-label", "Local demo controls");
    const labels = {
      events: "Events & Recaps",
      participation: "Check-in & Carpools",
      members: "Members & Dues",
      reimbursements: "Reimbursements",
      board: "Board Profiles",
      combined: "Events + Participation",
      full: "Full officer",
      expired: "Expired Guest",
      payments: "Reimbursements · Finalized quarter",
    };
    const back = document.createElement("a");
    back.href = "/demo";
    back.textContent = "← Demo guide";
    bar.append(back);
    const text = document.createElement("span");
    text.textContent = `${labels[role] || role} · Sample data · Edits stay in this tab`;
    bar.append(text);
    const control = (label, action, reload) => {
      const button = document.createElement("button");
      button.textContent = label;
      button.onclick = async () => {
        await fetch("/demo/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (reload) location.reload();
        else window.dispatchEvent(new Event("focus"));
      };
      bar.append(button);
    };
    if (!["full", "expired"].includes(role))
      control("Expire in 10s", "countdown", false);
    if (["reimbursements", "payments"].includes(role))
      control("Toggle finalized quarter", "payments", true);
    control("Reset preview", "reset", true);
    document.body.prepend(bar);
  });
})();
