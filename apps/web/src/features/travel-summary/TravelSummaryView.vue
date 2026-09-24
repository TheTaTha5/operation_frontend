<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/lib/api';
import { addDays, isYmd, localYmd, thaiLongDate } from '@/lib/date';
import { legacyUrl } from '@/lib/legacy';

import { loadDay } from './api';
import type { DayData } from './legacy/context';
import ManifestTable from './ManifestTable.vue';
import { buildTravelSummary, money, type VatFilter } from './model';
import TsChip from './TsChip.vue';

const route = useRoute();
const router = useRouter();

// Filters live in the URL so a reload, the back button or a shared link keep the same view.
const date = computed(() => (isYmd(route.query.date) ? route.query.date : localYmd()));
const routeF = computed(() => (typeof route.query.route === 'string' ? route.query.route : ''));
const vatF = computed<VatFilter>(() => (route.query.vat === 'vat' || route.query.vat === 'novat' ? route.query.vat : ''));
const onlyIssue = computed(() => route.query.issues === '1');

function setQuery(patch: Record<string, string | undefined>) {
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) if (typeof v === 'string' && v) q[k] = v;
  router.replace({ query: q });
}
const pickDate = (d: string) => setQuery({ date: d === localYmd() ? undefined : d, route: undefined });
const pickRoute = (id: string) => setQuery({ route: id === routeF.value ? undefined : id });
const pickVat = (v: VatFilter) => setQuery({ vat: v === vatF.value ? undefined : v });
const toggleIssues = () => setQuery({ issues: onlyIssue.value ? undefined : '1' });

const data = ref<DayData | null>(null);
const loading = ref(false);
const error = ref('');
let seq = 0;
async function load() {
  const my = ++seq;
  loading.value = true; error.value = '';
  try {
    const d = await loadDay(date.value);
    if (my === seq) data.value = d;
  } catch (e) {
    if (my !== seq) return;
    data.value = null;
    error.value = e instanceof ApiError && e.status === 401 ? 'signed-out' : e instanceof Error ? e.message : String(e);
  } finally {
    if (my === seq) loading.value = false;
  }
}
watch(date, load, { immediate: true });

const ts = computed(() => (data.value && data.value.date === date.value
  ? buildTravelSummary(data.value, { route: routeF.value, vat: vatF.value, onlyIssue: onlyIssue.value })
  : null));
const routeName = computed(() => ts.value?.routes.find((r) => r.id === routeF.value)?.name || 'ทุกเส้นทาง');
const pct = computed(() => (ts.value && ts.value.kpis.booked > 0 ? Math.round((ts.value.kpis.travelled / ts.value.kpis.booked) * 1000) / 10 : null));
</script>

<template>
  <div class="ts">
    <header class="head">
      <div>
        <div class="kick">
          ⚓ <b>LOVE ANDAMAN · OPERATIONS</b> <TsChip tone="g">
            DAILY MANIFEST
          </TsChip>
        </div>
        <h1>สรุปการเดินทางประจำวัน <em>MANIFEST</em></h1>
      </div>
      <div
        v-if="ts"
        class="docno"
      >
        {{ ts.docNo }}
      </div>
    </header>

    <div class="tools">
      <button
        class="btn"
        type="button"
        @click="pickDate(addDays(date, -1))"
      >
        ‹ วันก่อน
      </button>
      <button
        class="btn"
        type="button"
        @click="pickDate(localYmd())"
      >
        วันนี้
      </button>
      <button
        class="btn"
        type="button"
        @click="pickDate(addDays(date, 1))"
      >
        วันถัดไป ›
      </button>
      <input
        class="btn"
        type="date"
        :value="date"
        @change="(e) => { const v = (e.target as HTMLInputElement).value; if (isYmd(v)) pickDate(v) }"
      >
      <span class="muted">{{ thaiLongDate(date) }}</span>
      <span
        v-if="loading"
        class="muted"
      >· กำลังโหลด…</span>
    </div>

    <div class="notice">
      หน้านี้คือ Travel Summary เวอร์ชันใหม่ (ช่วงที่ 1 · ดูอย่างเดียว): ภาพรวมของวัน + Manifest ·
      การ<b>ตัดสินค่าปรับ</b>, <b>เงินหน้างาน / COT</b> และ<b>พิมพ์ PDF</b> ยังอยู่ที่
      <a :href="legacyUrl('travelsum')">หน้าเดิม</a>
    </div>

    <section
      v-if="error === 'signed-out'"
      class="card"
    >
      ยังไม่ได้เข้าสู่ระบบ · <a :href="legacyUrl('travelsum')">เข้าสู่ระบบที่หน้าเดิม</a>
    </section>
    <section
      v-else-if="error"
      class="card err"
    >
      โหลดข้อมูลไม่สำเร็จ: {{ error }}
      <button
        class="btn"
        type="button"
        @click="load"
      >
        ลองใหม่
      </button>
    </section>

    <template v-if="ts">
      <div class="pills">
        <span class="pl-label">เส้นทาง</span>
        <button
          type="button"
          class="pill"
          :class="{ on: !routeF }"
          @click="pickRoute('')"
        >
          ทุกเส้นทาง<i>{{ ts.routeTotal }} ใบ</i>
        </button>
        <button
          v-for="r in ts.routes"
          :key="r.id"
          type="button"
          class="pill"
          :class="{ on: r.id === routeF, empty: r.empty }"
          :style="{ borderColor: r.color, background: r.id === routeF ? r.color + '26' : r.color + '0f' }"
          @click="pickRoute(r.id)"
        >
          <span
            class="dot"
            :style="{ background: r.color }"
          />{{ r.name }}<i>{{ r.bookings }} ใบ · {{ r.pax }} คน</i>
        </button>
      </div>
      <div class="pills">
        <span class="pl-label">ภาษี</span>
        <button
          type="button"
          class="pill"
          :class="{ on: !vatF }"
          @click="pickVat('')"
        >
          ทั้งหมด<i>{{ ts.vat.all }} ใบ</i>
        </button>
        <button
          type="button"
          class="pill"
          :class="{ on: vatF === 'vat' }"
          title="Agent ที่คิด VAT · ยอดกลุ่มนี้ต้องออกใบกำกับภาษี"
          @click="pickVat('vat')"
        >
          มี VAT<i>{{ ts.vat.vat }} ใบ</i>
        </button>
        <button
          type="button"
          class="pill"
          :class="{ on: vatF === 'novat' }"
          title="Agent ที่ไม่คิด VAT และลูกค้า Walk-in"
          @click="pickVat('novat')"
        >
          ไม่มี VAT<i>{{ ts.vat.novat }} ใบ</i>
        </button>
        <TsChip
          v-if="ts.vat.gap.length"
          tone="a"
          :title="ts.vat.gap.join(' · ') + ' — ยังไม่ได้ตั้งโหมด VAT ในหน้า Agents จึงถูกนับเป็นไม่มี VAT ไปก่อน'"
        >
          ⚠ {{ ts.vat.gap.length }} agent ยังไม่ได้ตั้งโหมด
        </TsChip>
      </div>

      <div class="mbar">
        <div><span>วันปฏิบัติการ</span><b>{{ ts.date }}</b></div>
        <div><span>เส้นทาง</span><b>{{ routeName }} · {{ ts.routes.length }}</b></div>
        <div><span>Booking</span><b>{{ ts.kpis.bookings }}</b></div>
        <div><span>ผู้โดยสาร</span><b>{{ ts.kpis.travelled }} <small>/ {{ ts.kpis.booked }}</small></b></div>
        <div>
          <span>เอกสารแนบ</span><b>
            <TsChip
              v-if="ts.docs.verified"
              tone="g"
            >ตรวจแล้ว {{ ts.docs.verified }}</TsChip>
            <TsChip
              v-if="ts.docs.issue"
              tone="r"
            >มีปัญหา {{ ts.docs.issue }}</TsChip>
            <TsChip
              v-if="ts.docs.pending"
              tone="a"
            >รอตรวจ {{ ts.docs.pending }}</TsChip>
            <TsChip
              v-if="ts.docs.nofiles"
              tone="n"
            >ยังไม่แนบ {{ ts.docs.nofiles }}</TsChip>
          </b>
        </div>
        <div>
          <span>สถานะเอกสาร</span><b>
            <TsChip
              v-if="ts.kpis.pending"
              tone="a"
            >รอตัดสิน {{ ts.kpis.pending }} เคส</TsChip>
            <template v-else>ตรวจครบแล้ว</template>
          </b>
        </div>
      </div>

      <section class="sec">
        <div class="sech">
          <div>
            <h2><span class="sn">01</span>ภาพรวมของวัน</h2>
            <p class="muted">
              ยอดรวมทุกเส้นทางของวันนี้ · ตัวเลขทั้งหมดคิดจากผู้โดยสารที่เดินทางจริงหลังหักคนที่ไม่มา
            </p>
          </div>
          <TsChip tone="n">
            เก็บค่าปรับได้ {{ money(ts.kpis.charge) }}<template v-if="ts.kpis.postponed">
              · เลื่อนวัน {{ ts.kpis.postponed }} เคส
            </template>
          </TsChip>
        </div>
        <div class="kpis">
          <div class="kpi">
            <span>1 · booking ทั้งวัน</span><b>{{ ts.kpis.bookings }}<em>ใบ</em></b><small>{{ ts.kpis.booked }} คนที่จอง</small>
          </div>
          <div class="kpi lime">
            <span>2 · เดินทางจริง</span><b>{{ ts.kpis.travelled }}<em>คน</em></b>
            <small>{{ ts.kpis.booked - ts.kpis.travelled > 0 ? `หายไป ${ts.kpis.booked - ts.kpis.travelled} คน` : 'ครบทุกคน' }}</small>
          </div>
          <div class="kpi rose">
            <span>3 · No-show</span><b>{{ ts.kpis.noShow }}<em>คน</em></b><small>ไม่มาโดยไม่แจ้ง</small>
          </div>
          <div class="kpi amber">
            <span>4 · ยกเลิกหน้างาน</span><b>{{ ts.kpis.cxlOnSite }}<em>คน</em></b><small>CXL · แจ้งหน้างาน</small>
          </div>
          <div
            class="kpi"
            :class="ts.kpis.pending ? 'act' : 'lime'"
          >
            <span>5 · รอตัดสิน</span><b>{{ ts.kpis.pending }}<em>เคส</em></b>
            <small>{{ ts.kpis.pending ? 'ต้องตัดสินก่อนปิดวัน' : 'ตัดสินครบแล้ว' }}</small>
          </div>
          <div class="kpi">
            <span>6 · เงินหน้างาน</span><b>{{ money(ts.kpis.collectTarget) }}</b><small>{{ ts.kpis.collectCount }} ใบที่ต้องเก็บ</small>
          </div>
        </div>
        <p class="read">
          จอง <b>{{ ts.kpis.booked }}</b> → เดินทางจริง <b>{{ ts.kpis.travelled }}</b><template v-if="pct != null">
            (<b>{{ pct }}%</b>)
          </template>
          · เก็บค่าปรับได้ <b>{{ money(ts.kpis.charge) }}</b>
          · เงินที่ต้องเก็บหน้าท่า <b>{{ money(ts.kpis.collectTarget) }}</b> จาก <b>{{ ts.kpis.collectCount }}</b> ใบ
          <template v-if="ts.kpis.stillDue > 0">
            · ยังค้างอีก <b>{{ money(ts.kpis.stillDue) }}</b>
          </template><template v-else>
            · เก็บครบแล้ว
          </template>
          <template v-if="ts.kpis.siteSales > 0">
            · ขายเพิ่มหน้างาน <b>{{ money(ts.kpis.siteSales) }}</b> จาก <b>{{ ts.kpis.siteSaleCount }}</b> รายการ
          </template>
          <template v-if="ts.kpis.pending">
            · ยังมี <b>{{ ts.kpis.pending }}</b> เคสรอตัดสิน
          </template>
        </p>
      </section>

      <section class="sec">
        <div class="sech">
          <div>
            <h2><span class="sn">04</span>Manifest ประจำวัน</h2>
            <p class="muted">
              รายการทั้งหมดของวันเรียงตามเส้นทาง (Agency A-Z) · ช่อง <b>Total</b> คือยอด booking บวกของที่ขายเพิ่มหน้างาน ·
              ตัวเลข <b>ไปจริง/จอง</b> หมายถึงมีคนไม่ได้เดินทาง
            </p>
          </div>
          <button
            class="btn"
            :class="{ on: onlyIssue }"
            type="button"
            @click="toggleIssues"
          >
            {{ onlyIssue ? 'กำลังดูเฉพาะเคสมีปัญหา' : 'ดูเฉพาะเคสมีปัญหา' }}
          </button>
        </div>
        <ManifestTable
          :groups="ts.groups"
          :empty-text="onlyIssue ? 'ไม่มีเคสที่ต้องตัดสินในวันนี้' : 'ไม่มี booking ในวันนี้'"
        />
      </section>
    </template>
  </div>
</template>

<style scoped>
.ts {
  --ts-g: #0f6e56; --ts-g-bg: #dcf4e8; --ts-r: #b42318; --ts-r-bg: #fde4e1; --ts-a: #8a5a00; --ts-a-bg: #fbf0dd;
  --ts-n: #475467; --ts-n-bg: #eef1f4; --ts-e: #067647; --ts-e-bg: #e3f7ec; --ts-b: #175cd3; --ts-b-bg: #e3ecfb;
  --ts-p: #6b2fb3; --ts-p-bg: #efe6fb; --ts-head: #f6f8fa; --ts-cxl: #fff6f5;
}
@media (prefers-color-scheme: dark) {
  .ts {
    --ts-g: #6ee7b7; --ts-g-bg: #0f3b2e; --ts-r: #fca5a5; --ts-r-bg: #4a1c1c; --ts-a: #fcd34d; --ts-a-bg: #3f2e0a;
    --ts-n: #cbd5e1; --ts-n-bg: #263238; --ts-e: #86efac; --ts-e-bg: #10331f; --ts-b: #93c5fd; --ts-b-bg: #172a4a;
    --ts-p: #d8b4fe; --ts-p-bg: #2e1b47; --ts-head: #1c2a30; --ts-cxl: #2a1a1a;
  }
}
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.kick { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 8px; }
h1 { margin: 6px 0 0; font-size: 22px; } h1 em { font-style: normal; color: var(--muted); font-size: 14px; }
.docno { font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); }
.tools { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin: 14px 0 10px; }
.btn { padding: 6px 11px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);
  font: inherit; font-size: 12.5px; cursor: pointer; }
.btn.on { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.muted { color: var(--muted); font-size: 12px; }
.notice { margin: 0 0 12px; padding: 9px 12px; border-radius: 8px; background: var(--ts-b-bg); color: var(--ts-b); font-size: 12.5px; }
.card { padding: 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); margin-bottom: 12px; }
.card.err { color: var(--ts-r); }
.pills { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 6px 0; }
.pl-label { font-size: 11px; font-weight: 700; color: var(--muted); margin-right: 4px; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--border); border-radius: 999px;
  background: var(--surface); color: var(--text); font: inherit; font-size: 12px; cursor: pointer; }
.pill i { font-style: normal; color: var(--muted); font-size: 10.5px; }
.pill.on { font-weight: 700; box-shadow: inset 0 0 0 1px currentColor; }
.pill.empty { opacity: 0.42; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.mbar { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; margin: 12px 0; border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden; background: var(--border); }
.mbar > div { padding: 8px 10px; background: var(--surface); }
.mbar span { display: block; font-size: 10.5px; color: var(--muted); } .mbar b { font-size: 13px; }
.mbar small { color: var(--muted); font-weight: 400; }
.sec { margin: 18px 0; }
.sech { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
h2 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px; }
.sn { font-family: ui-monospace, monospace; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--ts-n-bg); color: var(--ts-n); }
.sech p { margin: 4px 0 0; max-width: 760px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.kpi { padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.kpi span { display: block; font-size: 11px; color: var(--muted); }
.kpi b { display: block; font-size: 22px; margin: 2px 0; font-variant-numeric: tabular-nums; }
.kpi b em { font-style: normal; font-size: 11px; color: var(--muted); margin-left: 4px; }
.kpi small { color: var(--muted); font-size: 11px; }
.kpi.lime { border-top: 3px solid var(--ts-g); } .kpi.rose { border-top: 3px solid var(--ts-r); }
.kpi.amber { border-top: 3px solid var(--ts-a); } .kpi.act { border-top: 3px solid var(--ts-a); background: var(--ts-a-bg); }
.read { margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; background: var(--ts-head); font-size: 13px; line-height: 1.7; }
</style>
