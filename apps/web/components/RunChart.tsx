'use client';
import * as Slider from '@radix-ui/react-slider';
import { BarChart, HeatmapChart, LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fmt, label, shortId, unitText } from '../lib/format';
import type { Frame, RunRecord } from '../lib/runs';

echarts.use([LineChart, BarChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, AriaComponent, CanvasRenderer]);

export const STAINS = ['hema', 'eosin', 'chlorophyll', 'cobalt'] as const;
const css = (name: string) => typeof window === 'undefined' ? '#000' : getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
export const runName = (run: RunRecord, index: number, total: number) => total > 1 ? `Run ${shortId(run.id)}` : '';

function useEChart(option: echarts.EChartsCoreOption | null) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, undefined, { renderer: 'canvas', devicePixelRatio: Math.min(window.devicePixelRatio, 2) });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); c.dispose(); chart.current = null; };
  }, []);
  useEffect(() => { if (option) chart.current?.setOption(option, true); }, [option]);
  return ref;
}

const base = () => ({
  animationDuration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500,
  textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: css('ink-soft') },
  aria: { enabled: true },
  tooltip: { trigger: 'axis', confine: true, valueFormatter: (v: unknown) => typeof v === 'number' ? fmt(v) : String(v) },
  grid: { left: 12, right: 16, top: 44, bottom: 80, containLabel: true },
});
const axisName = (name: string, unit?: string) => `${label(name)}${unitText(unit) ? ` (${unitText(unit)})` : ''}`;

/** Line chart of time series. One run shows every column; several runs share one chosen column. */
function SeriesChart({ runs }: { runs: RunRecord[] }) {
  const first = runs[0].result!.series![0];
  const columns = first.columns.slice(1);
  const [column, setColumn] = useState(columns[0]);
  const compare = runs.length > 1;
  const option = useMemo(() => {
    const lines = compare
      ? runs.map((r, i) => {
        const s = r.result!.series![0]; const ci = s.columns.indexOf(column);
        return { name: runName(r, i, runs.length), type: 'line', showSymbol: false, lineStyle: { width: 3 }, color: css(STAINS[i % 4]), data: s.data.map((row) => [row[0], row[ci]]) };
      })
      : columns.map((c, i) => ({ name: label(c), type: 'line', showSymbol: false, lineStyle: { width: 3 }, color: css(STAINS[i % 4]), data: first.data.map((row) => [row[0], row[i + 1]]) }));
    const yUnits = new Set(compare ? [first.units[first.columns.indexOf(column)]] : first.units.slice(1));
    return {
      ...base(),
      legend: { type: 'scroll', bottom: 0, left: 0, right: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 6 },
      xAxis: { type: 'value', name: axisName(first.columns[0], first.units[0]), nameLocation: 'middle', nameGap: 30, axisLabel: { hideOverlap: true }, splitLine: { show: false } },
      yAxis: { type: 'value', name: yUnits.size === 1 ? unitText([...yUnits][0]) : 'mixed units, see legend', nameTextStyle: { width: 220, overflow: 'break', lineHeight: 16 }, splitLine: { lineStyle: { color: css('line') } } },
      series: lines,
    };
  }, [runs, column, compare, columns, first]);
  const ref = useEChart(option);
  return (
    <div className="stack snug">
      {compare && columns.length > 1 && (
        <div className="segmented" role="radiogroup" aria-label="Quantity to compare">
          {columns.map((c) => <label key={c}><input type="radio" name="compare-col" checked={c === column} onChange={() => setColumn(c)} /><span>{label(c)}</span></label>)}
        </div>
      )}
      <div ref={ref} className="chart" role="img" aria-label={`${compare ? label(column) : columns.map((c) => label(c)).join(', ')} over ${label(first.columns[0])}`} />
    </div>
  );
}

/** Stepped heatmap of a spatial frame, scrubbed by time. */
function FrameChart({ run }: { run: RunRecord }) {
  const frames = run.result!.frames!.filter((f): f is Frame & { concentration: number[][] } => !!f.concentration);
  const [index, setIndex] = useState(frames.length - 1);
  const max = useMemo(() => Math.max(...frames.flatMap((f) => f.concentration.flat())), [frames]);
  const frame = frames[Math.min(index, frames.length - 1)];
  const option = useMemo(() => {
    const n = frame.concentration.length;
    const data = frame.concentration.flatMap((row, y) => row.map((v, x) => [x, y, v]));
    const paper = css('paper'), hema = css('hema');
    const steps = 6;
    return {
      ...base(), tooltip: { confine: true, formatter: (p: { value: number[] }) => `${fmt(p.value[2])} ${unitText(frame.unit)}` },
      grid: { left: 20, right: 20, top: 10, bottom: 70 },
      xAxis: { type: 'category', data: Array.from({ length: n }, (_, i) => i), show: false },
      yAxis: { type: 'category', data: Array.from({ length: n }, (_, i) => i), show: false },
      visualMap: {
        type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 8, itemWidth: 18, itemHeight: 12, showLabel: false,
        pieces: Array.from({ length: steps }, (_, i) => ({ min: (max * i) / steps, max: (max * (i + 1)) / steps, color: echarts.color.lerp(i / (steps - 1), [paper, hema]) })),
        formatter: (a: number, b: number) => `${fmt(a)} to ${fmt(b)}`,
      },
      series: [{ type: 'heatmap', data, progressive: 0 }],
    };
  }, [frame, max]);
  const ref = useEChart(option);
  return (
    <div className="stack snug">
      <div ref={ref} className="chart" role="img" aria-label={`Concentration on a ${frame.concentration.length} by ${frame.concentration.length} grid at ${fmt(frame.time_min)} minutes`} />
      <p className="faint">Concentration: {fmt(0)} to {fmt(max)} {unitText(frame.unit)}. Darker cells have higher concentrations.</p>
      <div className="row">
        <span className="faint num" style={{ minWidth: '8.5rem' }}>Time {fmt(frame.time_min)} min</span>
        <Slider.Root className="slider" style={{ flex: 1 }} min={0} max={frames.length - 1} step={1} value={[index]} onValueChange={([v]) => setIndex(v)}>
          <Slider.Track className="slider-track"><Slider.Range className="slider-range" /></Slider.Track>
          <Slider.Thumb className="slider-thumb" aria-label="Time step" aria-valuetext={`${fmt(frame.time_min)} minutes`} />
        </Slider.Root>
      </div>
    </div>
  );
}

/** Grouped bars when a run reports several scalars in one unit, such as genotype counts. */
function ScalarBars({ runs }: { runs: RunRecord[] }) {
  const keys = Object.keys(runs[0].result!.scalars);
  const unit = runs[0].result!.units?.[keys[0]];
  const option = useMemo(() => ({
    ...base(), tooltip: { trigger: 'axis', confine: true }, legend: runs.length > 1 ? { type: 'scroll', bottom: 0, left: 0, right: 0 } : undefined,
    xAxis: { type: 'category', data: keys.map((k) => label(k)), axisLabel: { width: 90, overflow: 'break', interval: 0, lineHeight: 16 } },
    yAxis: { type: 'value', name: unitText(unit), splitLine: { lineStyle: { color: css('line') } } },
    series: runs.map((r, i) => ({ name: runName(r, i, runs.length) || 'Result', type: 'bar', barMaxWidth: 46, itemStyle: { borderRadius: [8, 8, 0, 0], color: css(STAINS[i % 4]) }, data: keys.map((k) => r.result!.scalars[k]) })),
  }), [runs, keys, unit]);
  const ref = useEChart(option);
  return <div ref={ref} className="chart" role="img" aria-label={`${keys.map((k) => label(k)).join(', ')} for ${runs.length} run${runs.length > 1 ? 's' : ''}`} />;
}

/** Picks the visual that matches the artifact family the run actually produced. Returns null when there is nothing to plot. */
export function RunChart({ runs, fallback = null }: { runs: RunRecord[]; fallback?: ReactNode }) {
  const done = runs.filter((r) => r.status === 'completed' && r.result);
  if (!done.length) return fallback;
  const r = done[0].result!;
  if (r.series?.length && done.every((d) => d.result!.series?.length)) return <SeriesChart key={done.map((d) => d.id).join()} runs={done} />;
  if (r.frames?.[0]?.concentration) return <FrameChart key={done[0].id} run={done[0]} />;
  const units = Object.keys(r.scalars).map((k) => r.units?.[k]);
  if ((units.length > 1 || done.length > 1) && new Set(units).size === 1) return <ScalarBars runs={done} />;
  return fallback;
}
