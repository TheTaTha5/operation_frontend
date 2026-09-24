// The legacy booking-detail icon set (bkV2DetailIcon in allotment_v2/js/booking.js), as a render
// function so the SVG children need no v-html.
import { defineComponent, h, type PropType, type VNode } from 'vue';

type El = [tag: string, attrs: Record<string, string>];
const P = (d: string): El => ['path', { d }];
const L = (x1: string, y1: string, x2: string, y2: string): El => ['line', { x1, y1, x2, y2 }];
const PL = (points: string): El => ['polyline', { points }];

const ICONS: Record<string, El[]> = {
  back: [P('M15 18l-6-6 6-6')],
  edit: [P('M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7'), P('M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z')],
  cancel: [['circle', { cx: '12', cy: '12', r: '10' }], L('4.93', '4.93', '19.07', '19.07')],
  check: [PL('20 6 9 17 4 12')],
  x: [L('18', '6', '6', '18'), L('6', '6', '18', '18')],
  clock: [['circle', { cx: '12', cy: '12', r: '10' }], PL('12 6 12 12 16 14')],
};

export type BkIconName = keyof typeof ICONS;

export default defineComponent({
  name: 'BkIcon',
  props: {
    name: { type: String as PropType<BkIconName>, required: true },
    size: { type: Number, default: 14 },
  },
  setup(props) {
    return (): VNode => h('svg', {
      width: props.size, height: props.size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: 'flex-shrink:0', 'aria-hidden': 'true',
    }, (ICONS[props.name] || []).map(([tag, attrs]) => h(tag, attrs)));
  },
});
