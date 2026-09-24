import { createRouter, createWebHistory } from "vue-router";

import HomeView from "@/views/HomeView.vue";

export const routes = [
  { path: "/", name: "home", component: HomeView },
  { path: "/health", name: "health", component: () => import("@/views/HealthView.vue") },
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
