import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Providers } from "./lib/context";
import { Guard, Layout, Workspace } from "./components/layout";
import { Home } from "./pages/home";
import { readHomeBootstrap } from "./lib/home-bootstrap";

const Board = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Board })),
);
const Events = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.Events })),
);
const NotFound = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.NotFound })),
);
const SignIn = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.SignIn })),
);
const Membership = lazy(() =>
  import("./pages/membership").then((m) => ({ default: m.Membership })),
);
const PrivacyPolicy = lazy(() =>
  import("./pages/legal").then((m) => ({ default: m.PrivacyPolicy })),
);
const TermsOfService = lazy(() =>
  import("./pages/legal").then((m) => ({ default: m.TermsOfService })),
);
import { Loading } from "./components/ui";
import { PageMetadata } from "./components/page-metadata";

const MyOverview = lazy(() =>
  import("./pages/members").then((m) => ({ default: m.MyOverview })),
);
const MyReimbursements = lazy(() =>
  import("./pages/members").then((m) => ({ default: m.MyReimbursements })),
);
const MySignups = lazy(() =>
  import("./pages/members").then((m) => ({ default: m.MySignups })),
);
const Profile = lazy(() =>
  import("./pages/members").then((m) => ({ default: m.Profile })),
);
const EventDetail = lazy(() =>
  import("./pages/event-detail").then((m) => ({ default: m.EventDetail })),
);

const AdminOverview = lazy(() =>
  import("./pages/admin-base").then((m) => ({ default: m.AdminOverview })),
);
const AdminEvents = lazy(() =>
  import("./pages/admin-base").then((m) => ({ default: m.AdminEvents })),
);
const Members = lazy(() =>
  import("./pages/admin-base").then((m) => ({ default: m.Members })),
);
const Settings = lazy(() =>
  import("./pages/admin-base").then((m) => ({ default: m.Settings })),
);
const EventEditor = lazy(() =>
  import("./pages/event-editor").then((m) => ({ default: m.EventEditor })),
);
const SeriesEditor = lazy(() =>
  import("./pages/event-editor").then((m) => ({ default: m.SeriesEditor })),
);
const SeriesDetail = lazy(() =>
  import("./pages/event-editor").then((m) => ({ default: m.SeriesDetail })),
);
const EventManagement = lazy(() =>
  import("./pages/event-management").then((m) => ({
    default: m.EventManagement,
  })),
);
const Reimbursements = lazy(() =>
  import("./pages/reimbursements").then((m) => ({ default: m.Reimbursements })),
);
const Officers = lazy(() =>
  import("./pages/officers").then((m) => ({ default: m.Officers })),
);
const CheckInPicker = lazy(() =>
  import("./pages/check-in").then((m) => ({ default: m.CheckInPicker })),
);
const FieldDesk = lazy(() =>
  import("./pages/check-in").then((m) => ({ default: m.FieldDesk })),
);
import "./styles.css";

const client = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true } },
});

const home = readHomeBootstrap(document);
if (home) client.setQueryData(["HomeView", "/api/home"], home);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <PageMetadata />
        <Providers>
          <Suspense
            fallback={
              <div className="page">
                <Loading />
              </div>
            }
          >
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="events" element={<Events />} />
                <Route path="events/:slug/:id" element={<EventDetail />} />
                <Route path="board" element={<Board />} />
                <Route path="membership" element={<Membership />} />
                <Route path="privacy" element={<PrivacyPolicy />} />
                <Route path="terms" element={<TermsOfService />} />
                <Route path="sign-in" element={<SignIn />} />
                <Route element={<Guard />}>
                  <Route element={<Workspace />}>
                    <Route path="my-aac" element={<MyOverview />} />
                    <Route path="my-aac/profile" element={<Profile />} />
                    <Route path="my-aac/signups" element={<MySignups />} />
                    <Route
                      path="my-aac/reimbursements"
                      element={<MyReimbursements />}
                    />
                  </Route>
                </Route>
                <Route element={<Guard officer />}>
                  <Route element={<Workspace admin />}>
                    <Route path="admin/overview" element={<AdminOverview />} />
                    <Route path="admin/events" element={<AdminEvents />} />
                    <Route path="admin/events/new" element={<EventEditor />} />
                    <Route
                      path="admin/events/:slug/:id"
                      element={<EventManagement />}
                    />
                    <Route
                      path="admin/events/:slug/:id/edit"
                      element={<EventEditor />}
                    />
                    <Route path="admin/series/:id" element={<SeriesDetail />} />
                    <Route
                      path="admin/series/:id/edit"
                      element={<SeriesEditor />}
                    />
                    <Route path="admin/check-in" element={<CheckInPicker />} />
                    <Route path="admin/members" element={<Members />} />
                    <Route
                      path="admin/reimbursements"
                      element={<Reimbursements />}
                    />
                    <Route path="admin/officers" element={<Officers />} />
                    <Route path="admin/settings" element={<Settings />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route element={<Guard officer />}>
                <Route
                  path="admin/events/:slug/:id/check-in"
                  element={<FieldDesk />}
                />
                <Route
                  path="admin/events/:slug/:id/seat"
                  element={<FieldDesk seat />}
                />
              </Route>
            </Routes>
          </Suspense>
        </Providers>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
