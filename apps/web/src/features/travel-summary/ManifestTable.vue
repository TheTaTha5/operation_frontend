<script setup lang="ts">
import { dayShortTh } from './legacy/checkin';
import { money, moneyDec, type RouteGroup } from './model';
import TsChip from './TsChip.vue';

defineProps<{ groups: RouteGroup[]; emptyText: string }>();

const PAX = ['ad', 'chd', 'inf', 'foc'] as const;
const ADDON_SRC: Record<string, string> = { bk: 'จองมาแต่แรก', ex: 'ขายเพิ่มหน้างาน', up: 'อัปเกรดหน้างาน', pier: 'สั่งหน้าท่า' };
</script>

<template>
  <div class="scroll">
    <table class="man">
      <thead>
        <tr>
          <th>Voucher</th><th>Agency</th><th>Customer (lead)</th>
          <th
            v-for="k in PAX"
            :key="k"
            class="c px"
          >
            {{ k.toUpperCase() }}
          </th>
          <th class="c">
            Actual<br>/ Booked
          </th>
          <th>Pickup point · Room</th><th>Drop-off</th><th>Add-on · Upsell</th><th>Van · Boat</th><th>Pay</th>
          <th class="r">
            Total<br><span class="sub">จำนวน × Net</span>
          </th>
          <th>Cancel · Charge</th><th class="c">
            Status
          </th>
        </tr>
      </thead>
      <tbody v-if="!groups.length">
        <tr>
          <td
            colspan="16"
            class="empty"
          >
            {{ emptyText }}
          </td>
        </tr>
      </tbody>
      <tbody
        v-for="g in groups"
        :key="g.routeId"
      >
        <tr class="grp">
          <td colspan="16">
            <span
              class="grp-name"
              :style="{ color: g.color }"
            ><i
              class="dot"
              :style="{ background: g.color }"
            />{{ g.name }}</span>
            <span
              v-if="g.depTime"
              class="tel"
            > · {{ g.depTime }}</span>
            <span class="grp-sum tel">
              {{ g.bookings }} booking · จอง {{ g.booked }} → เดินทางจริง {{ g.travelled }}
              <template v-if="g.booked - g.travelled > 0"> · หาย {{ g.booked - g.travelled }}</template>
              <b
                v-if="g.cancelled"
                class="rose"
              > · ยกเลิกทั้งใบ {{ g.cancelled }} ใบ</b>
              <b
                v-if="g.moved"
                class="purple"
              > · เลื่อนวันไปแล้ว {{ g.moved }} ใบ</b>
            </span>
          </td>
        </tr>
        <tr
          v-for="row in g.rows"
          :key="row.key"
          :class="{ cxl: row.kind !== 'live', moved: row.kind === 'moved' }"
        >
          <td><span class="vch">{{ row.voucher }}</span></td>
          <td>
            <span
              v-if="row.agency.b2c"
              class="b2c"
              title="Love Andaman · ขายเอง (B2C)"
            >LOVE andaman</span>
            <span
              v-else
              class="ag"
              :style="{ background: row.agency.color, color: row.agency.ink }"
              :title="row.agency.name"
            >{{ row.agency.name }}</span>
          </td>
          <td>
            <div class="lead">
              {{ row.lead }}
            </div>
            <div class="tel">
              {{ row.phone }}
            </div>
          </td>
          <td
            v-for="k in PAX"
            :key="k"
            class="c px"
            :class="{ zero: !row.pax[k].booked || row.kind !== 'live', lost: row.kind === 'live' && row.pax[k].booked && row.pax[k].left !== row.pax[k].booked }"
            :title="row.kind === 'live' && row.pax[k].left !== row.pax[k].booked ? `จอง ${row.pax[k].booked} → ไปจริง ${row.pax[k].left}` : undefined"
          >
            <template v-if="!row.pax[k].booked">
              ·
            </template>
            <template v-else-if="row.kind !== 'live' || row.pax[k].left === row.pax[k].booked">
              {{ row.pax[k].booked }}
            </template>
            <template v-else>
              {{ row.pax[k].left }}<em>/{{ row.pax[k].booked }}</em>
            </template>
          </td>
          <td class="c mono strong">
            <span :class="{ rose: row.kind !== 'live' }">{{ row.travelled }}</span> / {{ row.booked }}
          </td>
          <td class="w168">
            <div v-if="row.ovnBack">
              <span
                class="ovn"
                title="ขากลับค้างคืน · ขึ้นเรือที่ท่าเกาะ ไม่มีรถไปรับ · ไม่คิดเงินซ้ำ"
              >↩ OVN ขากลับ</span>
              <div
                v-if="row.ovnOut"
                class="tel"
              >
                ไปเมื่อ {{ dayShortTh(row.ovnOut) }}
              </div>
            </div>
            <template v-if="row.pickup">
              {{ row.pickup }}<span
                v-if="row.room"
                class="room"
              >ห้อง {{ row.room }}</span>
            </template>
            <TsChip
              v-else
              tone="n"
              title="ใบนี้ไม่มีจุดรับ · ลูกค้ามาเองที่ท่า"
            >
              No pickup
            </TsChip>
          </td>
          <td class="w150">
            <template v-if="row.dropoff">
              <div class="sbk">
                {{ row.dropoff.t }}
              </div>
              <TsChip :tone="row.dropoff.cls as 'g'">
                {{ row.dropoff.tag }}
              </TsChip>
            </template>
            <span
              v-else
              class="faint"
            >จุดเดิม</span>
          </td>
          <td class="w190">
            <span
              v-if="!row.addons.length"
              class="faint"
            >—</span>
            <span
              v-for="(a, i) in row.addons"
              :key="i"
              class="ao"
              :class="['ao-' + a.src, { due: a.done === false }]"
              :title="ADDON_SRC[a.src] + (a.note ? ' · ' + a.note : '')"
            >{{ a.t }}<template v-if="a.qty && a.qty > 1"> ×{{ a.qty }}</template><b v-if="a.amt"> +{{ moneyDec(a.amt) }}</b></span>
          </td>
          <td>
            <TsChip
              v-if="row.van"
              tone="n"
              :muted="row.van.noBoard"
              :title="row.van.noBoard ? 'ไม่ได้ขึ้นรถ' : undefined"
            >
              🚐 {{ row.van.name }}
            </TsChip>
            <TsChip
              v-else-if="row.kind === 'live'"
              tone="p"
            >
              มาเอง
            </TsChip>
            <TsChip
              v-if="row.boat"
              tone="g"
              :muted="row.boat.noBoard"
              :title="row.boat.noBoard ? 'ไม่ได้ขึ้นเรือ' : undefined"
            >
              🚤 {{ row.boat.name }}
            </TsChip>
            <TsChip
              v-else-if="row.kind === 'live'"
              tone="r"
            >
              ยังไม่จัดเรือ
            </TsChip>
            <span
              v-if="row.kind !== 'live' && !row.van && !row.boat"
              class="faint"
            >—</span>
          </td>
          <td class="pay">
            <span
              v-if="row.kind === 'moved'"
              class="faint small"
            >ยอดเงินไปอยู่กับวันใหม่แล้ว</span>
            <template
              v-for="(p, i) in row.pay"
              :key="i"
            >
              <TsChip
                v-if="p.kind === 'chip'"
                :tone="p.tone"
                :title="p.title"
              >
                {{ p.text }}
              </TsChip>
              <span
                v-else-if="p.kind === 'methods'"
                class="methods"
              >
                <TsChip
                  v-for="m in p.items"
                  :key="m.label"
                  :tone="m.tone"
                  :title="m.slips ? `${m.label} · มีสลิปแล้ว ${m.slips} ไฟล์` : undefined"
                ><template v-if="m.slips">📎 </template>{{ m.label }}</TsChip>
              </span>
              <span
                v-else
                class="pl"
                :class="['pl-' + p.kind, { strike: p.strike }]"
                :title="p.title"
              >{{ p.text }}</span>
            </template>
          </td>
          <td class="r mono strong">
            <span
              v-if="!row.total"
              class="faint"
            >—</span>
            <template v-else>
              {{ money(row.total.all) }}
              <span
                v-if="row.total.site"
                class="totb"
              >{{ money(row.total.base) }}<em>+{{ money(row.total.site) }}</em></span>
              <span
                class="net"
                :title="row.total.net ? `ยอด Net ${money(row.total.net.tot)}${row.total.net.promo ? ` · โปร: ${row.total.net.promo}${row.total.net.promoSold ? ' (ล็อกไว้ตอนขาย)' : ''}` : ' ตาม Rate Type'}` : 'ไม่มีเรตใน Rate Type'"
              >({{ row.total.net ? row.total.net.txt : '—' }})</span>
              <span
                v-if="row.total.net && row.total.net.promo"
                class="net promo"
                :title="row.total.net.promo"
              > PROMO</span>
            </template>
          </td>
          <td class="w170">
            <template v-if="row.moved">
              <TsChip tone="p">
                เลื่อนวันแล้ว
              </TsChip>
              <div
                v-if="row.moved.why"
                class="tel"
              >
                {{ row.moved.why }}
              </div>
            </template>
            <span
              v-else-if="row.cxl.empty"
              class="faint"
            >—</span>
            <template v-else>
              <TsChip
                v-for="(ch, i) in row.cxl.chips"
                :key="i"
                :tone="ch.tone"
              >
                {{ ch.text }}
              </TsChip>
              <div
                v-for="(l, i) in row.cxl.lines"
                :key="'l' + i"
                class="tel"
              >
                {{ l }}
              </div>
            </template>
          </td>
          <td class="c">
            <TsChip :tone="row.status.tone">
              {{ row.status.text }}
            </TsChip>
            <div
              v-if="row.status.sub"
              class="tel"
            >
              {{ row.status.sub }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.man { width: 100%; border-collapse: collapse; font-size: 12px; }
th { position: sticky; top: 0; padding: 7px 8px; text-align: left; font-size: 10.5px; font-weight: 700; color: var(--muted);
  background: var(--ts-head); border-bottom: 1px solid var(--border); white-space: nowrap; }
td { padding: 7px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
.c { text-align: center; } .r { text-align: right; }
.sub { font-weight: 400; font-size: 9.5px; }
.mono { font-variant-numeric: tabular-nums; } .strong { font-weight: 800; }
.grp td { background: var(--ts-head); padding: 7px 11px; }
.grp-name { display: inline-flex; align-items: center; gap: 7px; font-weight: 700; font-size: 12px; }
.grp-sum { float: right; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.vch { font-weight: 700; font-family: ui-monospace, monospace; font-size: 11.5px; }
.ag { display: inline-block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 3px 7px; border-radius: 6px; font-weight: 700; font-size: 11px; }
.b2c { display: inline-block; padding: 3px 7px; border: 1px solid var(--border); border-radius: 6px; background: #fff;
  color: #03205a; font-weight: 800; font-size: 10.5px; }
.lead { font-weight: 600; } .tel { color: var(--muted); font-size: 10.5px; }
.px { width: 34px; } .px em { font-style: normal; color: var(--muted); font-size: 10px; }
.px.zero { color: var(--muted); } .px.lost { color: var(--ts-r); font-weight: 800; }
.room { margin-left: 5px; color: var(--muted); font-size: 10.5px; }
.ovn { display: inline-block; padding: 2px 7px; border-radius: 999px; background: #ede7fb; color: #5b289a; font-weight: 800; font-size: 10.5px; }
.sbk { font-size: 11.5px; }
.ao { display: inline-block; margin: 1px 3px 1px 0; padding: 2px 6px; border-radius: 5px; font-size: 10.5px; border: 1px solid transparent; }
.ao-bk { background: var(--ts-n-bg); } .ao-ex { background: var(--ts-e-bg); } .ao-up { background: var(--ts-b-bg); } .ao-pier { background: var(--ts-a-bg); }
.ao.due { border-style: dashed; border-color: var(--ts-a); }
.pay { min-width: 170px; }
.methods { display: block; }
.pl { display: block; font-size: 11px; }
.pl-due { font-weight: 800; color: var(--ts-a); } .pl-ok { font-weight: 700; color: var(--ts-g); }
.pl-warn { color: var(--ts-a); font-weight: 700; } .pl-note, .pl-note2 { color: var(--muted); font-size: 10.5px; }
.strike { opacity: 0.55; text-decoration: line-through; }
.totb { display: block; font-weight: 400; font-size: 10.5px; color: var(--muted); } .totb em { font-style: normal; color: var(--ts-e); }
.net { display: block; font-weight: 400; font-size: 10px; color: var(--muted); } .net.promo { display: inline; color: #9a5410; font-weight: 700; }
.faint { color: var(--muted); } .small { font-size: 10.5px; }
.rose { color: var(--ts-r); } .purple { color: var(--ts-p); }
tr.cxl td { background: var(--ts-cxl); } tr.cxl .lead, tr.cxl .vch { text-decoration: line-through; text-decoration-color: var(--ts-r); }
tr.moved td { opacity: 0.7; }
.empty { padding: 24px; text-align: center; color: var(--muted); }
.w150 { max-width: 150px; } .w168 { max-width: 168px; } .w170 { max-width: 170px; } .w190 { max-width: 190px; }
</style>
