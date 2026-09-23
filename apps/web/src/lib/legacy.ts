import { config } from "./config";

export type LegacyView = {
  /** The `data-view` of the legacy sidebar item. */
  view: string;
  label: string;
  section: string;
  adminOnly?: boolean;
};

/**
 * Every screen in the legacy sidebar (allotment_v2.html), in sidebar order. When a screen moves to
 * this app, delete it here and add a route instead. "Booking - Transfer / City Tour" is missing on
 * purpose: it shares data-view="booking" with plain Booking, so ?view= cannot pick it out yet.
 */
export const legacyViews: readonly LegacyView[] = [
  // Overview
  { view: "dashboard", label: "Dashboard", section: "Overview" },
  { view: "calendar", label: "Calendar", section: "Overview" },
  { view: "daily", label: "Daily Availability", section: "Overview" },
  { view: "actionboard", label: "Action Board", section: "Overview" },

  // Operations
  { view: "booking", label: "Booking", section: "Operations" },
  { view: "reconfirm", label: "Re-confirm", section: "Operations" },
  { view: "bookingflow", label: "Booking Flow", section: "Operations" },
  { view: "doccheck", label: "ตรวจเอกสาร", section: "Operations" },
  { view: "operation", label: "Boat Operation", section: "Operations" },
  { view: "fleetcal", label: "Fleet Calendar", section: "Operations" },
  { view: "insurance", label: "Insurance", section: "Operations" },
  { view: "vehicles", label: "Transfer Fleet", section: "Operations" },
  { view: "vanjobs", label: "ใบงานรถ (Van Jobs)", section: "Operations" },
  { view: "vancheckin", label: "เช็คอินรถ", section: "Operations" },
  { view: "piercheckin", label: "เช็คอินหน้าท่า", section: "Operations" },
  { view: "landcheckin", label: "เช็คอิน City tour", section: "Operations" },
  { view: "travelsum", label: "Travel Summary", section: "Operations" },
  { view: "dailyreport", label: "Daily Report", section: "Operations" },
  { view: "pickup-setup", label: "Pickup time setup", section: "Operations" },

  // Pier Office
  { view: "poj-panwa", label: "ใบงานเรือ (panwa)", section: "Pier Office" },
  { view: "po-panwa", label: "เบิก-คืนอุปกรณ์ (panwa)", section: "Pier Office" },
  { view: "poa-panwa", label: "ตารางการทำงาน (panwa)", section: "Pier Office" },
  { view: "pop-panwa", label: "เงินสดย่อย (panwa)", section: "Pier Office" },
  { view: "pok-panwa", label: "ตั๋วอุทยาน (panwa)", section: "Pier Office" },
  { view: "poj-tublamu", label: "ใบงานเรือ (tublamu)", section: "Pier Office" },
  { view: "po-tublamu", label: "เบิก-คืนอุปกรณ์ (tublamu)", section: "Pier Office" },
  { view: "poa-tublamu", label: "ตารางการทำงาน (tublamu)", section: "Pier Office" },
  { view: "pop-tublamu", label: "เงินสดย่อย (tublamu)", section: "Pier Office" },
  { view: "pok-tublamu", label: "ตั๋วอุทยาน (tublamu)", section: "Pier Office" },
  { view: "poj-ranong", label: "ใบงานเรือ (ranong)", section: "Pier Office" },
  { view: "po-ranong", label: "เบิก-คืนอุปกรณ์ (ranong)", section: "Pier Office" },
  { view: "poa-ranong", label: "ตารางการทำงาน (ranong)", section: "Pier Office" },
  { view: "pop-ranong", label: "เงินสดย่อย (ranong)", section: "Pier Office" },
  { view: "pok-ranong", label: "ตั๋วอุทยาน (ranong)", section: "Pier Office" },

  // Sales
  { view: "sales-board", label: "Sales Board", section: "Sales" },
  { view: "b2b-dash", label: "B2B Dashboard", section: "Sales" },
  { view: "agents", label: "Agent List", section: "Sales" },
  { view: "rate-types", label: "Rate Types", section: "Sales" },
  { view: "rate-admin", label: "Rate Expiry", section: "Sales" },
  { view: "contract-tmpl", label: "Contract Templates", section: "Sales" },
  { view: "b2c", label: "B2C Channels", section: "Sales" },
  { view: "staff", label: "Staff & Welfare", section: "Sales" },
  { view: "marketdata", label: "Demand", section: "Sales" },
  { view: "focdetail", label: "FOC Detail", section: "Sales" },
  { view: "pickupmap", label: "แผนที่จุดรับ", section: "Sales" },

  // Accounting & Finance
  { view: "accounting", label: "Accounting", section: "Accounting & Finance" },
  { view: "costing", label: "ต้นทุน & จุดคุ้มทุน", section: "Accounting & Finance" },
  { view: "trippl", label: "P&L รายทริป", section: "Accounting & Finance" },
  { view: "dailypfm", label: "Daily PFM", section: "Accounting & Finance" },
  { view: "vanbill", label: "วางบิลรถร่วม", section: "Accounting & Finance" },
  { view: "prpo", label: "PR/PO Dashboard", section: "Accounting & Finance" },

  // Admin
  { view: "devlog", label: "System Log", section: "Admin", adminOnly: true },

  // Fleet · At a glance
  { view: "fl-dashboard", label: "FL Dashboard", section: "Fleet · At a glance" },

  // Fleet · Today
  { view: "fl-boatstatus", label: "Boat Status", section: "Fleet · Today" },
  { view: "fl-dailyreport", label: "Daily Fleet Log", section: "Fleet · Today" },
  { view: "fl-incident", label: "Job Assignment", section: "Fleet · Today" },

  // Fleet · Work
  { view: "fl-projects", label: "Projects", section: "Fleet · Work" },
  { view: "fl-maintenance", label: "Maintenance", section: "Fleet · Work" },
  { view: "fl-inventory", label: "Inventory / Memo", section: "Fleet · Work" },
  { view: "fl-consumables", label: "เบิกของใช้ / น้ำมัน", section: "Fleet · Work" },

  // Fleet · Analytics
  { view: "fl-cost", label: "Cost Analytics", section: "Fleet · Analytics" },
  { view: "fl-insights", label: "Fleet Insights", section: "Fleet · Analytics" },
  { view: "fl-fuel", label: "Fuel · น้ำมัน", section: "Fleet · Analytics" },

  // Fleet · Registry
  { view: "fl-asset", label: "Company Asset", section: "Fleet · Registry" },

  // Report
  { view: "rep-ops", label: "Operations Report", section: "Report" },
  { view: "rep-fleet", label: "Fleet Report", section: "Report" },

  // Config
  { view: "settings", label: "Programs", section: "Config" },
  { view: "teammkt", label: "Team & Markets", section: "Config" },
  { view: "addonsvc", label: "Add-on Services", section: "Config" },
];

/** Link into the legacy app on one screen. `_laRestoreView` (js/01-auth-sync.js) reads `?view=`. */
export function legacyUrl(view?: string): string {
  if (!view) return config.legacyUrl;
  return `${config.legacyUrl}?view=${encodeURIComponent(view)}`;
}

/** Group views by sidebar section, keeping sidebar order. */
export function groupBySection(views: readonly LegacyView[]): [string, LegacyView[]][] {
  const groups = new Map<string, LegacyView[]>();
  for (const v of views) {
    const list = groups.get(v.section);
    if (list) list.push(v);
    else groups.set(v.section, [v]);
  }
  return [...groups];
}
