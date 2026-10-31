import React from 'react';
import { ResponsiveContainer, LineChart, AreaChart, BarChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export interface ChartSeries { key: string; label: string; color?: string }
export interface ChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: ChartSeries[];
  type?: 'line' | 'area' | 'bar';
  ticks?: number[];
  locale?: string;
  unit?: string;
}

// Adapted from the supplied component: Studio tokens, literal price segments,
// accessible labels, localized values and no repeated chart entrance animation.
export default function Chart({data,xKey,series,type='line',ticks,locale='ru',unit='сум'}:ChartProps) {
  const format=(value:number)=>new Intl.NumberFormat(locale).format(value);
  const Container=type==='bar'?BarChart:type==='area'?AreaChart:LineChart;
  const domain: [number,number] | undefined = type==='bar'?undefined:ticks?.length?[ticks[0],ticks[ticks.length-1]]:undefined;
  return <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width:500,height:210}}>
    <Container data={data} margin={{top:12,right:10,bottom:0,left:0}} accessibilityLayer>
      <CartesianGrid stroke="var(--ui-border)" vertical={false}/>
      <XAxis dataKey={xKey} axisLine={false} tickLine={false} minTickGap={28} tick={{fontSize:11,fill:'var(--ui-fg-muted)'}}/>
      <YAxis width={59} domain={domain} allowDecimals={unit!==''} ticks={type==='bar'?undefined:ticks?.length?ticks:undefined} tickFormatter={format} axisLine={false} tickLine={false} tick={{fontSize:11,fill:'var(--ui-fg-muted)'}}/>
      <Tooltip content={({active,label,payload})=>active&&payload?.length?<div className="price-chart-tooltip"><strong>{label}</strong>{payload.map(entry=><div key={String(entry.dataKey)}><span style={{background:entry.color}}/>{entry.name}<b>{format(Number(entry.value))} {unit}</b></div>)}</div>:null} cursor={type==='bar'?{fill:'var(--ui-bg-subtle)'}:{stroke:'var(--ui-fg-muted)',strokeDasharray:'3 4'}}/>
      {series.map((item,index)=> {
        const color=item.color || ['var(--ui-primary)','#00bdb4','var(--ui-fg)','var(--ui-fg-muted)'][index%4];
        const common={dataKey:item.key,name:item.label,isAnimationActive:false};
        return type==='bar'?<Bar key={item.key} {...common} fill={color} radius={[3,3,0,0]} maxBarSize={30}/>:type==='area'?<Area key={item.key} {...common} type="linear" stroke={color} fill={color} fillOpacity={.12} strokeWidth={2} dot={false}/>:<Line key={item.key} {...common} type="linear" stroke={color} strokeWidth={2} dot={false} activeDot={{r:4,stroke:'var(--ui-bg)',strokeWidth:2}}/>;
      })}
    </Container>
  </ResponsiveContainer>;
}
