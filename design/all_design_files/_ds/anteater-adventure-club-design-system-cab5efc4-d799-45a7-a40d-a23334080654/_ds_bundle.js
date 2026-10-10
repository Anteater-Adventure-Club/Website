/* @ds-bundle: {"format":4,"namespace":"AnteaterAdventureClubDesignSystem_cab5ef","components":[{"name":"PreviousBoard","sourcePath":"components/board/PreviousBoard.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"GlassCard","sourcePath":"components/core/GlassCard.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"UpcomingCalendar","sourcePath":"components/events/UpcomingCalendar.jsx"},{"name":"BenefitItem","sourcePath":"components/membership/BenefitItem.jsx"},{"name":"PriceCard","sourcePath":"components/membership/PriceCard.jsx"},{"name":"Footer","sourcePath":"components/navigation/Footer.jsx"},{"name":"Header","sourcePath":"components/navigation/Header.jsx"},{"name":"Popup","sourcePath":"components/overlays/Popup.jsx"},{"name":"PolaroidCard","sourcePath":"components/polaroid/PolaroidCard.jsx"},{"name":"PolaroidGallery","sourcePath":"components/polaroid/PolaroidGallery.jsx"}],"sourceHashes":{"components/board/PreviousBoard.jsx":"27643623bc37","components/core/Button.jsx":"1a54415d6055","components/core/GlassCard.jsx":"e271aa0ded4a","components/core/Icon.jsx":"b7518c398f50","components/events/UpcomingCalendar.jsx":"1d91048ea4dd","components/membership/BenefitItem.jsx":"5542258c44f5","components/membership/PriceCard.jsx":"f4c3f0b01872","components/navigation/Footer.jsx":"71531c745e69","components/navigation/Header.jsx":"4931c65f2d44","components/overlays/Popup.jsx":"767204cf7f06","components/polaroid/PolaroidCard.jsx":"faaeb1517ded","components/polaroid/PolaroidGallery.jsx":"75b4d92ea374","ui_kits/website/about.jsx":"cbf9c01ee2d1","ui_kits/website/board.jsx":"9177fbc8eae4","ui_kits/website/data.js":"f3a92b99249c","ui_kits/website/events.jsx":"6e979050cde7","ui_kits/website/home.jsx":"beaf96d1c928","ui_kits/website/membership.jsx":"ce48b8351473","ui_kits/website/sponsors.jsx":"c1154d3b4c3a"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AnteaterAdventureClubDesignSystem_cab5ef = window.AnteaterAdventureClubDesignSystem_cab5ef || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/board/PreviousBoard.jsx
try { (() => {
const {
  useState
} = React;
/** Glass accordion revealing a grid of past officers' names + roles. */
function PreviousBoard({
  year,
  officers = [],
  defaultOpen = false,
  open: openProp,
  onToggle
}) {
  const [openState, setOpen] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : openState;
  const toggle = () => {
    onToggle ? onToggle(!open) : setOpen(!open);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "aac-prev-board"
  }, /*#__PURE__*/React.createElement("button", {
    className: "aac-prev-board__toggle",
    onClick: toggle,
    "aria-expanded": open
  }, /*#__PURE__*/React.createElement("h3", null, year, " Board"), /*#__PURE__*/React.createElement("h3", {
    className: "aac-prev-board__icon"
  }, open ? "-" : "+")), open && /*#__PURE__*/React.createElement("div", {
    className: "aac-prev-board__content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aac-prev-board__grid"
  }, officers.map(o => /*#__PURE__*/React.createElement("div", {
    key: o.id || o.name,
    className: "aac-prev-board__item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "aac-prev-board__name"
  }, o.name), /*#__PURE__*/React.createElement("span", {
    className: "aac-prev-board__role"
  }, o.role))))));
}
Object.assign(__ds_scope, { PreviousBoard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/board/PreviousBoard.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
/** Pill button. Variants map to .cta-button, .outline-button, .payment-button, .discord-button, .instagram-button in the site. */
function Button({
  variant = "cta",
  href,
  onClick,
  iconSrc,
  iconAlt = "",
  disabled,
  target,
  children,
  className = "",
  style
}) {
  const cls = "aac-button aac-button--" + variant + (className ? " " + className : "");
  const content = /*#__PURE__*/React.createElement(React.Fragment, null, iconSrc && /*#__PURE__*/React.createElement("img", {
    src: iconSrc,
    alt: iconAlt,
    width: 20,
    height: 20
  }), children);
  if (href) {
    return /*#__PURE__*/React.createElement("a", {
      href: href,
      target: target,
      rel: target === "_blank" ? "noopener noreferrer" : undefined,
      className: cls,
      style: style,
      onClick: onClick
    }, content);
  }
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: cls,
    style: style,
    onClick: onClick,
    disabled: disabled
  }, content);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/GlassCard.jsx
try { (() => {
/** Frosted translucent white panel used throughout membership & sponsors pages. */
function GlassCard({
  variant = "panel",
  as = "div",
  children,
  className = "",
  style
}) {
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, {
    className: "aac-glass" + (variant === "option" ? " aac-glass--option" : "") + (className ? " " + className : ""),
    style: style
  }, children);
}
Object.assign(__ds_scope, { GlassCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/GlassCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
const PATHS = {
  menu: [["path", {
    d: "M4 12h16"
  }], ["path", {
    d: "M4 18h16"
  }], ["path", {
    d: "M4 6h16"
  }]],
  x: [["path", {
    d: "M18 6 6 18"
  }], ["path", {
    d: "m6 6 12 12"
  }]]
};

/** Lucide glyphs used by the site (Menu, X). Geometry copied from lucide-react. */
function Icon({
  name,
  size = 24,
  strokeWidth = 2,
  className,
  onClick,
  style
}) {
  const parts = PATHS[name] || [];
  return /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className,
    onClick: onClick,
    style: style,
    "aria-hidden": "true"
  }, parts.map(([tag, attrs], i) => React.createElement(tag, {
    key: i,
    ...attrs
  })));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/events/UpcomingCalendar.jsx
try { (() => {
const {
  useState
} = React;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEGEND = [["regular", "Event"], ["weekly-meeting", "Weekly Meeting"], ["potlock-picnic", "Potluck Picnic"]];
function parseMonth(m) {
  if (m) {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1);
  }
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Month grid of bordered day tiles, color-coded by event type, with a detail panel for the clicked day. */
function UpcomingCalendar({
  events = [],
  initialMonth,
  today,
  status
}) {
  const [display, setDisplay] = useState(() => parseMonth(initialMonth));
  const [selected, setSelected] = useState(null);
  const t = today ? new Date(today) : new Date();
  const y = display.getFullYear(),
    m = display.getMonth();
  const monthName = display.toLocaleString("default", {
    month: "long"
  });
  const days = new Date(y, m + 1, 0).getDate();
  const eventFor = day => events.find(e => {
    const d = new Date(e.date);
    return d.getDate() === day && d.getMonth() === m && d.getFullYear() === y;
  });
  const shift = n => {
    setSelected(null);
    setDisplay(new Date(y, m + n, 1));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "aac-calendar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aac-calendar__header"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "aac-month-nav",
    onClick: () => shift(-1)
  }, "Prev"), /*#__PURE__*/React.createElement("span", null, monthName, " ", y), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "aac-month-nav",
    onClick: () => shift(1)
  }, "Next")), /*#__PURE__*/React.createElement("div", {
    className: "aac-calendar__legend",
    "aria-label": "Event type legend"
  }, LEGEND.map(([k, l]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "aac-legend-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "aac-legend-color event-" + k,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", null, l)))), status && /*#__PURE__*/React.createElement("p", {
    className: "aac-calendar__status"
  }, status), /*#__PURE__*/React.createElement("div", {
    className: "aac-calendar__weekdays"
  }, WEEKDAYS.map(d => /*#__PURE__*/React.createElement("div", {
    key: d
  }, d))), /*#__PURE__*/React.createElement("div", {
    className: "aac-calendar__grid"
  }, Array.from({
    length: days
  }, (_, i) => {
    const day = i + 1;
    const ev = eventFor(day);
    const isToday = day === t.getDate() && m === t.getMonth() && y === t.getFullYear();
    const cls = "aac-day" + (ev && ev.type ? " event-" + ev.type.replace(/\s+/g, "-") : "") + (isToday ? " today" : "");
    return /*#__PURE__*/React.createElement("div", {
      key: day,
      className: cls,
      onClick: () => setSelected(ev || null)
    }, /*#__PURE__*/React.createElement("span", null, day));
  })), selected && /*#__PURE__*/React.createElement("div", {
    className: "aac-event-details"
  }, /*#__PURE__*/React.createElement("h3", null, selected.name), /*#__PURE__*/React.createElement("p", {
    className: "aac-event-details__date"
  }, selected.date), /*#__PURE__*/React.createElement("p", {
    className: "aac-event-details__desc"
  }, selected.description), selected.signUpLink && /*#__PURE__*/React.createElement("a", {
    href: selected.signUpLink,
    target: "_blank"
  }, "Sign Up")));
}
Object.assign(__ds_scope, { UpcomingCalendar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/events/UpcomingCalendar.jsx", error: String((e && e.message) || e) }); }

// components/membership/BenefitItem.jsx
try { (() => {
/** Numbered glass row: forest circle number + Lazydog forest title + muted body. */
function BenefitItem({
  number,
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "aac-benefit"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aac-benefit__number"
  }, number), /*#__PURE__*/React.createElement("div", {
    className: "aac-benefit__content"
  }, /*#__PURE__*/React.createElement("h3", null, title), /*#__PURE__*/React.createElement("p", null, children)));
}
Object.assign(__ds_scope, { BenefitItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/membership/BenefitItem.jsx", error: String((e && e.message) || e) }); }

// components/membership/PriceCard.jsx
try { (() => {
/** Solid forest card with big Lazydog price. */
function PriceCard({
  price = "$25",
  period = "per quarter*",
  notes = ["*Can pay anytime during the quarter", "+ $5 non-student surcharge"],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "aac-price-card",
    style: style
  }, /*#__PURE__*/React.createElement("span", {
    className: "aac-price-card__number"
  }, price), /*#__PURE__*/React.createElement("span", {
    className: "aac-price-card__period"
  }, period), notes.map((n, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "aac-price-card__note"
  }, n)));
}
Object.assign(__ds_scope, { PriceCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/membership/PriceCard.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Footer.jsx
try { (() => {
/** Centered small-print footer with hairline top border. */
function Footer({
  year = 2026,
  tagline = "Making Nature Accessible!"
}) {
  return /*#__PURE__*/React.createElement("footer", {
    className: "aac-footer"
  }, /*#__PURE__*/React.createElement("p", null, "\xA9 ", year, " Anteater Adventure Club", " ", /*#__PURE__*/React.createElement("span", {
    className: "aac-footer__extra"
  }, "| ", tagline), " ", "\uD83C\uDF32"));
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Footer.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Header.jsx
try { (() => {
const {
  useState
} = React;
const DEFAULT_ITEMS = [{
  href: "/",
  label: "Home"
}, {
  href: "/about",
  label: "About"
}, {
  href: "/events",
  label: "Events"
}, {
  href: "/board",
  label: "Board"
}, {
  href: "/membership",
  label: "Membership"
}, {
  href: "/sponsors",
  label: "Sponsors"
}];

/** Fixed frosted-glass top bar with centered nav; collapses to a hamburger + forest drawer under 640px. */
function Header({
  items = DEFAULT_ITEMS,
  active = "/",
  onNavigate,
  isStatic = false,
  forceMobile = false
}) {
  const [open, setOpen] = useState(false);
  const go = (e, href) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
    setOpen(false);
  };
  const isActive = h => h === "/" ? active === "/" : active.startsWith(h);
  const cls = "aac-header" + (isStatic ? " aac-header--static" : "") + (forceMobile ? " aac-header--mobile" : "");
  return /*#__PURE__*/React.createElement("header", {
    className: cls
  }, /*#__PURE__*/React.createElement("div", {
    className: "aac-header__container"
  }, /*#__PURE__*/React.createElement("button", {
    className: "aac-hamburger",
    onClick: () => setOpen(!open),
    "aria-label": "Toggle menu",
    "aria-expanded": open
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: open ? "x" : "menu"
  })), /*#__PURE__*/React.createElement("nav", {
    className: "aac-desktop-nav"
  }, items.map(it => /*#__PURE__*/React.createElement("a", {
    key: it.href,
    href: it.href,
    className: isActive(it.href) ? "active" : "",
    onClick: e => go(e, it.href)
  }, it.label)))), /*#__PURE__*/React.createElement("div", {
    className: "aac-menu-overlay" + (open ? " open" : ""),
    onClick: () => setOpen(false)
  }, /*#__PURE__*/React.createElement("nav", {
    className: "aac-mobile-nav",
    onClick: e => e.stopPropagation()
  }, items.map(it => /*#__PURE__*/React.createElement("a", {
    key: it.href,
    href: it.href,
    className: isActive(it.href) ? "active" : "",
    onClick: e => go(e, it.href)
  }, it.label)))));
}
Object.assign(__ds_scope, { Header });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Header.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Popup.jsx
try { (() => {
const {
  useEffect,
  useRef
} = React;
function PopupItem({
  name,
  content
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, name), /*#__PURE__*/React.createElement("p", null, content));
}

/** Modal detail card for an event or officer. Officers get their own pastel background + title color. */
function Popup({
  datum,
  dataType = "event",
  onClose,
  instagramIconSrc,
  inline = false
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (inline) return;
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose && onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, inline]);
  const isOfficer = dataType === "officer";
  const bg = isOfficer ? "var(--officer-" + datum.id + "-bg, var(--white))" : undefined;
  const titleColor = isOfficer ? "var(--officer-" + datum.id + ", inherit)" : undefined;
  return /*#__PURE__*/React.createElement("div", {
    className: "aac-popup" + (inline ? " aac-popup--inline" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "aac-popup__content",
    ref: ref,
    style: bg ? {
      backgroundColor: bg
    } : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "aac-popup__header"
  }, /*#__PURE__*/React.createElement("h3", {
    style: titleColor ? {
      color: titleColor
    } : undefined
  }, datum.name), /*#__PURE__*/React.createElement("div", {
    className: "aac-popup__buttons"
  }, isOfficer && datum.instagram && instagramIconSrc && /*#__PURE__*/React.createElement("a", {
    href: datum.instagram,
    target: "_blank",
    rel: "noopener"
  }, /*#__PURE__*/React.createElement("img", {
    src: instagramIconSrc,
    alt: "Instagram Logo",
    className: "aac-popup__ig"
  })), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    className: "aac-popup__close",
    onClick: () => onClose && onClose()
  }))), /*#__PURE__*/React.createElement("div", {
    className: "aac-popup__body"
  }, isOfficer ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PopupItem, {
    name: "Role",
    content: datum.role
  }), /*#__PURE__*/React.createElement(PopupItem, {
    name: "Major",
    content: datum.major
  }), /*#__PURE__*/React.createElement(PopupItem, {
    name: "Why I joined AAC",
    content: datum.whyJoined
  }), /*#__PURE__*/React.createElement(PopupItem, {
    name: "My favorite AAC Memory...",
    content: datum.favoriteMemory
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PopupItem, {
    name: "Date",
    content: datum.date
  }), /*#__PURE__*/React.createElement(PopupItem, {
    name: "Event Info",
    content: datum.description
  }), datum.signUpLink && /*#__PURE__*/React.createElement("a", {
    href: datum.signUpLink,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "aac-signup-link"
  }, /*#__PURE__*/React.createElement("h3", null, "Click here to sign up!"))))));
}
Object.assign(__ds_scope, { Popup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Popup.jsx", error: String((e && e.message) || e) }); }

// components/polaroid/PolaroidCard.jsx
try { (() => {
/** White-framed photo with Lazydog title + caption below — the site's signature motif for events and officers. */
function PolaroidCard({
  name,
  subtitle,
  imageSrc,
  onClick,
  rotate = 0,
  width,
  style
}) {
  const s = {
    ...(rotate ? {
      transform: "rotate(" + rotate + "deg)"
    } : {}),
    ...(width ? {
      width
    } : {}),
    ...style
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "aac-polaroid",
    onClick: onClick,
    style: s
  }, /*#__PURE__*/React.createElement("img", {
    src: imageSrc,
    alt: name
  }), /*#__PURE__*/React.createElement("div", {
    className: "aac-polaroid__caption"
  }, /*#__PURE__*/React.createElement("h3", null, name), /*#__PURE__*/React.createElement("p", null, subtitle)));
}
Object.assign(__ds_scope, { PolaroidCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/polaroid/PolaroidCard.jsx", error: String((e && e.message) || e) }); }

// components/polaroid/PolaroidGallery.jsx
try { (() => {
const {
  useState
} = React;
/** Auto-fit grid of polaroids; clicking one opens the matching Popup. */
function PolaroidGallery({
  data = [],
  dataType = "event",
  instagramIconSrc,
  style
}) {
  const [activeItem, setActiveItem] = useState(null);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "aac-polaroid-gallery",
    style: style
  }, data.map(d => /*#__PURE__*/React.createElement(__ds_scope.PolaroidCard, {
    key: d.id,
    name: d.name,
    subtitle: dataType === "officer" ? d.role : d.date,
    imageSrc: d.imagePath,
    onClick: () => setActiveItem(d)
  }))), activeItem && /*#__PURE__*/React.createElement(__ds_scope.Popup, {
    key: activeItem.id,
    datum: activeItem,
    dataType: dataType,
    onClose: () => setActiveItem(null),
    instagramIconSrc: instagramIconSrc
  }));
}
Object.assign(__ds_scope, { PolaroidGallery });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/polaroid/PolaroidGallery.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/about.jsx
try { (() => {
const {
  Button,
  GlassCard,
  PolaroidCard,
  PolaroidGallery,
  UpcomingCalendar,
  PriceCard,
  BenefitItem,
  PreviousBoard
} = window.AnteaterAdventureClubDesignSystem_cab5ef;
const D = window.AAC_DATA;
function AboutScreen() {
  return /*#__PURE__*/React.createElement("div", {
    className: "about"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("h1", null, "Our Mission..."), /*#__PURE__*/React.createElement("h4", null, "Fostering a sense of community while making nature as accessible as possible!")), /*#__PURE__*/React.createElement("div", {
    className: "sections"
  }, D.about.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.title,
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-text"
  }, /*#__PURE__*/React.createElement("h2", null, s.title), /*#__PURE__*/React.createElement("h4", null, s.description)), /*#__PURE__*/React.createElement("div", {
    className: "section-images"
  }, s.images.map((im, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "section-image-" + i
  }, /*#__PURE__*/React.createElement(PolaroidCard, {
    name: im.name,
    subtitle: im.date,
    imageSrc: im.imagePath
  }))))))), /*#__PURE__*/React.createElement("div", {
    className: "socials"
  }, /*#__PURE__*/React.createElement("h2", null, "Join the Adventure!"), /*#__PURE__*/React.createElement("h4", null, "Our primary form of communication is our club Discord server, but we also promote all of our events on our club Instagram."), /*#__PURE__*/React.createElement("div", {
    className: "social-buttons"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "discord",
    href: "https://discord.com/invite/F7FqKQushk",
    target: "_blank",
    iconSrc: "../../assets/logos/discord.svg",
    iconAlt: "Discord Logo"
  }, "Join Discord"), /*#__PURE__*/React.createElement(Button, {
    variant: "instagram",
    href: "https://www.instagram.com/anteateradventureclub/",
    target: "_blank",
    iconSrc: "../../assets/logos/instagram_white.svg",
    iconAlt: "Instagram Logo"
  }, "Follow on Instagram"))));
}
window.AboutScreen = AboutScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/about.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/board.jsx
try { (() => {
const {
  Button,
  GlassCard,
  PolaroidCard,
  PolaroidGallery,
  UpcomingCalendar,
  PriceCard,
  BenefitItem,
  PreviousBoard
} = window.AnteaterAdventureClubDesignSystem_cab5ef;
const D = window.AAC_DATA;
function BoardScreen() {
  const [openYear, setOpenYear] = React.useState("");
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("h1", null, "Meet the Board!"), /*#__PURE__*/React.createElement("h4", null, "Click to learn more about each officer!")), /*#__PURE__*/React.createElement(PolaroidGallery, {
    data: D.officers,
    dataType: "officer",
    instagramIconSrc: "../../assets/logos/instagram.svg"
  }), D.previousBoards.map(b => /*#__PURE__*/React.createElement(PreviousBoard, {
    key: b.year,
    year: b.year,
    officers: b.officers,
    open: openYear === b.year,
    onToggle: o => setOpenYear(o ? b.year : "")
  })));
}
window.BoardScreen = BoardScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/board.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/data.js
try { (() => {
const IMG = "../../assets/images/";
window.AAC_DATA = {
  pastEvents: [{
    id: "seed-past-6",
    name: "Hot Tub Kickback (Camino del Sol Pool)",
    date: "October 25, 2025",
    description: "AAC hosted a chill pool and hot tub evening on Saturday at the Camino Del Sol community pool! We had a great time relaxing and socializing after a long week of studying.",
    imagePath: IMG + "events/25-26/camino_pool.jpg"
  }, {
    id: "seed-past-7",
    name: "Griffith Park/Observatory Day Trip",
    date: "November 2, 2025",
    description: "On Sunday, AAC took a trip to Griffith Park and the Observatory! We enjoyed the scenic views of LA from the park, and explored the exhibits at the observatory!",
    imagePath: IMG + "events/25-26/griffith_park.png"
  }, {
    id: "seed-past-8",
    name: "AAC x Astronomy Collab @ Turtle Rock",
    date: "November 5, 2025",
    description: "AAC collaborated with the Astro Club this Wednesday for a stargazing event at Turtle Rock! We enjoyed the scenic views of the night sky after a brief hike!",
    imagePath: IMG + "events/25-26/aac_astro_collab.jpg"
  }, {
    id: "seed-past-10",
    name: "OC Zoo and Irvine Regional Park Day Trip",
    date: "January 24, 2026",
    description: "This Saturday, AAC took a trip to the OC Zoo and Irvine Regional Park! We enjoyed the scenic views of the park and had a picnic in the afternoon!",
    imagePath: IMG + "events/25-26/oc_zoo.jpg"
  }, {
    id: "seed-past-3",
    name: "Balboa Island",
    date: "January 10, 2026",
    description: "On Saturday, we took a trip to the coast and visited Balboa Island & Pier! It was a scenic day at the beach, complete with a ferry ride across the water, and lunch at Ruby's Diner!",
    imagePath: IMG + "events/25-26/balboa_pier.jpg"
  }, {
    id: "seed-past-5",
    name: "Anteater Involvement Fair",
    date: "September 22, 2025",
    description: "Join us at the Anteater Involvement Fair to learn more about the club!",
    imagePath: IMG + "events/25-26/aldrich_park.jpg"
  }],
  upcomingEvents: [{
    id: "1",
    name: "Week General Meeting @7PM SSL 145",
    date: "February 9, 2026",
    description: "At tonight's meeting, we'll be going over some new information regarding the quarterly retreat; itinerary, camping details, packing list, etc. We highly recommend anyone who signed up to attend and see what activities we've got planned.",
    type: "weekly meeting"
  }, {
    id: "2",
    name: "Laguna Tide Pools + Heisler Park",
    date: "February 15, 2026",
    description: "This Sunday, we'll be exploring the tide pools in Laguna Beach which are brimming with unique marine life! These tide pools are only available to explore during low tide, making this weekend the perfect time to visit!\nJoin us for a relaxed afternoon of scenic exploration! After the tide pools, we'll finish the day by heading to nearby Heisler Park to enjoy its grassy overlooks and nearby cafés.",
    signUpLink: "#",
    type: "regular"
  }, {
    id: "3",
    name: "Potlock Picnic in Aldrich Park",
    date: "February 12, 2026",
    description: "Games, food, and sports in Aldrich Park!",
    type: "potlock picnic"
  }, {
    id: "4.1",
    name: "(DAY 1) Quaterly Retreat: Joshua Tree",
    date: "February 20, 2026",
    description: "Leave UCI and head to Joshua Tree for a weekend of camping, hiking, and stargazing!",
    type: "regular"
  }, {
    id: "4.2",
    name: "(DAY 2) Quaterly Retreat: Joshua Tree",
    date: "February 21, 2026",
    description: "Hikes and Josuha Tree exploration!",
    type: "regular"
  }, {
    id: "4.3",
    name: "(DAY 3) Quaterly Retreat: Joshua Tree",
    date: "February 22, 2026",
    description: "Head back to UCI.",
    type: "regular"
  }],
  officers: [{
    id: "thomas",
    name: "Thomas Lobaton",
    role: "President",
    major: "Urban Studies",
    whyJoined: "I joined AAC at first mostly because of the range of opportunities to get involved. The picnics, weekend events, general meetings, and retreats made it really easy to get to know people and find friends.",
    favoriteMemory: "One of my favorite memories was stargazing at one of our Joshua Tree retreats. It was pretty cool because I'd never really seen stars that clear before, not to mention how the campfire and music really set a rustic mood. Also, that time I fell in the river at Zion.",
    instagram: "https://www.instagram.com/tomthetrain67/",
    imagePath: IMG + "officers/thomas.jpg"
  }, {
    id: "gabe",
    name: "Gabe Dodge",
    role: "Fundraising Chair",
    major: "Computer Science",
    whyJoined: "Liam dragged me out to the Zion retreat with a bunch of our mutual friends and we all had a great time camping!",
    favoriteMemory: "Andrew walking straight into a pole and falling over. You just had to be there.",
    instagram: "https://www.instagram.com/gabe_dodge/",
    imagePath: IMG + "officers/gabe.jpg"
  }, {
    id: "parker",
    name: "Parker Woodbury",
    role: "Historian",
    major: "Aerospace Engineering",
    whyJoined: "I joined AAC because I heard they were camping at national parks, and they weren't charging crazy amounts of money.",
    favoriteMemory: "My favorite AAC Memory is spending hours off roading at death valley on the biggest dunes I have ever seen. Either that or watching the Minecraft movie with the whole club, I'm not sure.",
    instagram: "https://www.instagram.com/parker.woodbury/",
    imagePath: IMG + "officers/parker.jpg"
  }, {
    id: "lokesh",
    name: "Lokesh Sharma",
    role: "Webmaster",
    major: "Computer Science",
    whyJoined: "I joined AAC my freshman year to meet new people, go on hikes, and explore the LA/OC area!",
    favoriteMemory: "Our Spring '25 retreat to Zion National Park.",
    instagram: "https://www.instagram.com/lakeshoreee/",
    imagePath: IMG + "officers/lokesh.jpg"
  }, {
    id: "charlie",
    name: "Charlie Weinberger",
    role: "Webmaster",
    major: "Computer Science",
    whyJoined: "I joined AAC to meet new people outside of my major and to participate in fun outdoor events that get me to leave campus and explore SoCal (and beyond)!",
    favoriteMemory: "My favorite AAC memory is hiking Valencia Peak (1300ft elevation) on our F25 Central Coast retreat, and then coming back to our campsite to eat freshly-cooked ramen and sit around the campfire!",
    instagram: "https://www.instagram.com/charliebrown364/",
    imagePath: IMG + "officers/charlie.jpg"
  }, {
    id: "eric",
    name: "Eric Ostdiek",
    role: "Event Coordinator",
    major: "Computer Science",
    whyJoined: "I liked the people I met in the club and the activities I went to were fun. Also I'm a huge fan of camping so the retreats are awesome for me.",
    favoriteMemory: "Christmas party gingerbread house making was probably one of my favorites. A great demonstration of major problems, quick thinking, and creativity from everyone",
    instagram: "https://www.instagram.com/e.ostdiek/",
    imagePath: IMG + "officers/eric.jpg"
  }, {
    id: "liam",
    name: "Liam Harrington",
    role: "Visibility Team",
    major: "History & Education Sciences",
    whyJoined: "To go explore the US and meet new people.",
    favoriteMemory: "Getting stranded in the Amargosa Dunes in Nevada in the middle of the night.",
    instagram: "https://www.instagram.com/liamh_121/",
    imagePath: IMG + "officers/liam.jpg"
  }],
  previousBoards: [{
    year: "2024-2025",
    officers: [{
      name: "Aristani Rodriguez-Gonzalez",
      role: "President & Founder"
    }, {
      name: "Jason Zenarosa",
      role: "Vice President"
    }, {
      name: "Alexis Ibarra",
      role: "Secretary"
    }, {
      name: "Daron Kaloustian",
      role: "Treasurer"
    }, {
      name: "Sofia Barsan",
      role: "Outreach Coordinator & Club Advisor"
    }, {
      name: "Thomas Lobaton",
      role: "Fundraising Chair"
    }, {
      name: "Lokesh Sharma",
      role: "Webmaster"
    }, {
      name: "Charlie Weinberger",
      role: "Webmaster"
    }, {
      name: "Kristina Qu",
      role: "Visibility Team"
    }, {
      name: "Ryan Fenstermacher",
      role: "General Officer"
    }, {
      name: "Tristan Thanh Ly",
      role: "General Officer"
    }, {
      name: "Liam Harrington",
      role: "General Officer"
    }]
  }],
  about: [{
    title: "Hikes",
    description: "Explore weekly hikes across Orange County and Southern California — scenic trails, great company, and adventure starting right here at UCI",
    images: [{
      name: "Salt Creek Trail Hike @ Dana Point",
      date: "Winter 2024",
      imagePath: IMG + "events/24-25/unknown_hike.jpg"
    }, {
      name: "Laguna Tide Pools Hike",
      date: "Winter 2026",
      imagePath: IMG + "events/24-25/tide_pools.jpg"
    }]
  }, {
    title: "City Exploration",
    description: "Adventure isn't just limited to nature — join us on a city exploration, where we try new food, explore museums, and feel the rush of a new city",
    images: [{
      name: "LA Grand Central Market",
      date: "Winter 2025",
      imagePath: IMG + "events/24-25/la_city.jpg"
    }, {
      name: "San Diego Exploration",
      date: "Spring 2025",
      imagePath: IMG + "events/24-25/san_diego.JPG"
    }]
  }, {
    title: "Potluck Picnics",
    description: "Enjoy a nice day outside at our potluck picnics, featuring games, food, and sports, every week in Aldrich Park!",
    images: [{
      name: "Potluck Picnic",
      date: "Fall 2025 Week 1",
      imagePath: IMG + "events/25-26/picnic_f25w1.jpg"
    }, {
      name: "Potluck Picnic",
      date: "Fall 2025 Week 3",
      imagePath: IMG + "events/25-26/picnic_f25w3.jpeg"
    }]
  }, {
    title: "Quarterly Retreats",
    description: "Every quarter, the club goes on a weekend retreat, often the highlight of the quarter for many of our members. Past retreat locations include national parks like Sequoia and Death Valley, lakes like Lake Arrowhead, and more!",
    images: [{
      name: "Death Valley National Park",
      date: "Winter 2025 Retreat",
      imagePath: IMG + "events/24-25/death_valley.jpg"
    }, {
      name: "Sequoia & Kings Canyon National Parks",
      date: "Fall 2024 Retreat",
      imagePath: IMG + "events/24-25/sequoia.jpg"
    }]
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/data.js", error: String((e && e.message) || e) }); }

// ui_kits/website/events.jsx
try { (() => {
const {
  Button,
  GlassCard,
  PolaroidCard,
  PolaroidGallery,
  UpcomingCalendar,
  PriceCard,
  BenefitItem,
  PreviousBoard
} = window.AnteaterAdventureClubDesignSystem_cab5ef;
const D = window.AAC_DATA;
function EventsScreen() {
  return /*#__PURE__*/React.createElement("div", {
    className: "events-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "events-header"
  }, /*#__PURE__*/React.createElement("h1", null, "Stay up to date!"), /*#__PURE__*/React.createElement("h4", null, "Click on any date or past event to learn more!")), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Upcoming Events"), /*#__PURE__*/React.createElement("div", {
    className: "calendar-wrapper"
  }, /*#__PURE__*/React.createElement(UpcomingCalendar, {
    initialMonth: "2026-02",
    today: "February 12, 2026",
    events: D.upcomingEvents
  })), /*#__PURE__*/React.createElement("h2", {
    className: "section-title"
  }, "Past Events"), /*#__PURE__*/React.createElement(PolaroidGallery, {
    data: D.pastEvents,
    dataType: "event"
  }));
}
window.EventsScreen = EventsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/events.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/home.jsx
try { (() => {
const {
  Button,
  GlassCard,
  PolaroidCard,
  PolaroidGallery,
  UpcomingCalendar,
  PriceCard,
  BenefitItem,
  PreviousBoard
} = window.AnteaterAdventureClubDesignSystem_cab5ef;
const D = window.AAC_DATA;
function HomeScreen({
  go
}) {
  const cards = D.pastEvents;
  const [start, setStart] = React.useState(0);
  const [swapping, setSwapping] = React.useState(false);
  React.useEffect(() => {
    const iv = setInterval(() => {
      setSwapping(true);
      setTimeout(() => {
        setStart(p => (p + 2) % cards.length);
        setSwapping(false);
      }, 400);
    }, 9000);
    return () => clearInterval(iv);
  }, []);
  const pair = [cards[start % cards.length], cards[(start + 1) % cards.length]];
  return /*#__PURE__*/React.createElement("div", {
    className: "home"
  }, /*#__PURE__*/React.createElement("section", {
    className: "home-left"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "home-title"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w1"
  }, "Anteater"), " ", /*#__PURE__*/React.createElement("span", {
    className: "w2"
  }, "Adventure"), " ", /*#__PURE__*/React.createElement("span", {
    className: "w2"
  }, "Club")), /*#__PURE__*/React.createElement(Button, {
    variant: "cta",
    href: "#/events",
    onClick: e => {
      e.preventDefault();
      go("/events");
    }
  }, "Join the Adventure!")), /*#__PURE__*/React.createElement("section", {
    className: "home-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "polaroid-row" + (swapping ? " swapping" : "")
  }, pair.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    className: "home-polaroid"
  }, /*#__PURE__*/React.createElement(PolaroidCard, {
    name: c.name,
    subtitle: c.date,
    imageSrc: c.imagePath
  }))))));
}
window.HomeScreen = HomeScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/membership.jsx
try { (() => {
const {
  Button,
  GlassCard,
  PolaroidCard,
  PolaroidGallery,
  UpcomingCalendar,
  PriceCard,
  BenefitItem,
  PreviousBoard
} = window.AnteaterAdventureClubDesignSystem_cab5ef;
const D = window.AAC_DATA;
const BENEFITS = [["Access to the Quarterly Camping Retreat!", "Join us for our amazing quarterly retreats - often the highlight of the quarter!"], ["Priority Carpool Assignments", "While we usually have space, typically only 20% of attendees drive. Membership ensures you'll have a space!"], ["Access to Driver Reimbursements", "Amounts are TBD depending on end of quarter finances."], ["Voting Access on Club Decisions", "Any membership in the current academic year grants access to board elections for the following year, as well as voting rights for event and retreat details, such as our quarterly retreat location!"], ["Help Contribute to Club Events & Camping Gear", "Your membership helps us fund all of our awesome events and maintain camping gear that we loan to members."]];
function MembershipScreen() {
  return /*#__PURE__*/React.createElement("div", {
    className: "membership"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("h1", null, "AAC Membership")), /*#__PURE__*/React.createElement("div", {
    className: "pricing-main"
  }, /*#__PURE__*/React.createElement(GlassCard, {
    className: "free-activities",
    style: {
      backdropFilter: "blur(10px)"
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Weekly activities are completely free!!"), /*#__PURE__*/React.createElement("p", {
    className: "retreat-note"
  }, "Membership is ONLY necessary for the quarterly retreat")), /*#__PURE__*/React.createElement(PriceCard, null)), /*#__PURE__*/React.createElement("div", {
    className: "benefits-section"
  }, /*#__PURE__*/React.createElement("h2", null, "Why Pay for Membership?"), /*#__PURE__*/React.createElement("div", {
    className: "benefits-list"
  }, BENEFITS.map(([t, d], i) => /*#__PURE__*/React.createElement(BenefitItem, {
    key: i,
    number: i + 1,
    title: t
  }, d)))), /*#__PURE__*/React.createElement("div", {
    className: "payment-cta"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "payment",
    href: "https://tinyurl.com/AACW26Membership",
    target: "_blank"
  }, "Pay Membership Fee")));
}
window.MembershipScreen = MembershipScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/membership.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/sponsors.jsx
try { (() => {
const {
  Button,
  GlassCard,
  PolaroidCard,
  PolaroidGallery,
  UpcomingCalendar,
  PriceCard,
  BenefitItem,
  PreviousBoard
} = window.AnteaterAdventureClubDesignSystem_cab5ef;
const D = window.AAC_DATA;
const OPTIONS = [["Event Sponsorship", "Help fund transportation, permits, and logistics for day trips, picnics, and special events."], ["Product or Gear Support", "Provide snacks, hydration, or outdoor gear for events, giveaways, or member use."], ["Retreat Support", "Sponsor our quarterly retreats to help students participate in larger weekend outdoor experiences."], ["Custom Collaborations", "Interested in something unique? We're happy to discuss tailored partnerships that align with your goals."]];
function SponsorsScreen() {
  return /*#__PURE__*/React.createElement("div", {
    className: "sponsors-page"
  }, /*#__PURE__*/React.createElement("section", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("h1", null, "Partner With AAC"), /*#__PURE__*/React.createElement("p", {
    className: "hero-subtitle"
  }, "Anteater Adventure Club brings students together through hikes, city explorations, picnics, and quarterly retreats. Sponsorship helps us keep outdoor experiences accessible, inclusive, and memorable."), /*#__PURE__*/React.createElement("div", {
    className: "sponsors-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "cta",
    href: "mailto:anteateradventureclub@gmail.com?subject=Sponsorship%20Inquiry"
  }, "Email Us"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    href: "https://www.instagram.com/anteateradventureclub/",
    target: "_blank"
  }, "Message on Instagram"))), /*#__PURE__*/React.createElement(GlassCard, {
    as: "section",
    className: "sponsor-reasons"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("h2", null, "Why Sponsor Us")), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Active student community:"), " Connect with highly engaged UCI students who value adventure, wellness, and local exploration."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Brand visibility:"), " Sponsors can be highlighted through event shoutouts, social media, and club materials throughout the quarter."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Community impact:"), " Your support helps reduce participation barriers and makes outdoor activities more accessible for students."))), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("h2", null, "Ways to Partner")), /*#__PURE__*/React.createElement("div", {
    className: "options-grid"
  }, OPTIONS.map(([t, d]) => /*#__PURE__*/React.createElement(GlassCard, {
    key: t,
    as: "article",
    variant: "option"
  }, /*#__PURE__*/React.createElement("h3", null, t), /*#__PURE__*/React.createElement("p", null, d))))), /*#__PURE__*/React.createElement("div", {
    className: "sponsor-contact-container"
  }, /*#__PURE__*/React.createElement(GlassCard, {
    as: "section",
    className: "sponsor-contact"
  }, /*#__PURE__*/React.createElement("h2", null, "How to Contact Us"), /*#__PURE__*/React.createElement("p", null, "We'd love to learn about your organization and goals."), /*#__PURE__*/React.createElement("div", {
    className: "contact-list"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Email:"), " ", /*#__PURE__*/React.createElement("a", {
    href: "mailto:anteateradventureclub@gmail.com"
  }, "anteateradventureclub@gmail.com")), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Instagram:"), " ", /*#__PURE__*/React.createElement("a", {
    href: "https://www.instagram.com/anteateradventureclub/",
    target: "_blank"
  }, "@anteateradventureclub"))))));
}
window.SponsorsScreen = SponsorsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/sponsors.jsx", error: String((e && e.message) || e) }); }

__ds_ns.PreviousBoard = __ds_scope.PreviousBoard;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.GlassCard = __ds_scope.GlassCard;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.UpcomingCalendar = __ds_scope.UpcomingCalendar;

__ds_ns.BenefitItem = __ds_scope.BenefitItem;

__ds_ns.PriceCard = __ds_scope.PriceCard;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.Header = __ds_scope.Header;

__ds_ns.Popup = __ds_scope.Popup;

__ds_ns.PolaroidCard = __ds_scope.PolaroidCard;

__ds_ns.PolaroidGallery = __ds_scope.PolaroidGallery;

})();
