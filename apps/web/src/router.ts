import { createRouter, createWebHistory } from "vue-router";

import HomeView from "@/views/HomeView.vue";

export const routes = [
  { path: "/", name: "home", component: HomeView },
  { path: "/login", name: "login", component: () => import("@/views/LoginView.vue") },
  { path: "/health", name: "health", component: () => import("@/views/HealthView.vue") },
  { path: "/bookings", name: "bookings", component: () => import("@/features/bookings/BookingsView.vue") },
  { path: "/bookings/trips", name: "booking-trips", component: () => import("@/features/bookings/ByTripView.vue") },
  { path: "/bookings/:id", name: "booking", component: () => import("@/features/bookings/BookingDetailView.vue") },
  { path: "/calendar", name: "calendar", component: () => import("@/features/calendar/CalendarView.vue") },
  { path: "/agents", name: "agents", component: () => import("@/features/agents/AgentsView.vue") },
  { path: "/agents/:id", name: "agent", component: () => import("@/features/agents/AgentsView.vue") },
  {
    path: "/travel-summary",
    name: "travel-summary",
    component: () => import("@/features/travel-summary/TravelSummaryView.vue"),
  },
  { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("@/views/NotFoundView.vue") },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
