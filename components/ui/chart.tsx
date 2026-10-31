import React,{useId} from 'react';
import {ResponsiveContainer,ComposedChart,BarChart,Line,Area,Bar,Cell,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine} from 'recharts';
export interface ChartSeries {key:string;label:string;color?:string}
export interface ChartProps {
 data:Record<string,string|number|number[]>[];xKey:string;series:ChartSeries[];
 type?:'line'|'area'|'bar'|'horizontal-bar';ticks?:number[];locale?:string;unit?:string;
 band?:boolean;reference?:number;referenceLabel?:string;highlightIndex?:number;
}
const palette=['var(--ui-primary)','#00bdb4','var(--ui-fg)','var(--ui-fg-muted)'];
export default function Chart({data,xKey,series,type='line',ticks,locale='ru',unit='сум',band=false,reference,referenceLabel,highlightIndex}:ChartProps){
 const id='chart'+useId().replace(/[^a-zA-Z0-9]/g,'');
 const format=(value:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value);
 const short=(value:number)=>Math.abs(value)>=1000?`${format(value/1000)}k`:format(value);
 const horizontal=type==='horizontal-bar',bars=type==='bar'||horizontal,Container=bars?BarChart:ComposedChart;
 const values=data.flatMap(row=>series.map(item=>Number(row[item.key]))).filter(Number.isFinite);
 const low=Math.min(...values),high=Math.max(...values),padding=Math.max(Math.abs(high)*.015,(high-low)*.15,1);
 const domain:[number,number]|undefined=bars?undefined:ticks?.length?[ticks[0],ticks[ticks.length-1]]:values.length?[Math.floor(low-padding),Math.ceil(high+padding)]:[0,1];
 const numericAxis={axisLine:false,tickLine:false,tick:{fontSize:11,fill:'var(--ui-fg-muted)'},allowDecimals:unit!=='',tickFormatter:short};
 const name=(label:unknown)=>String(label).length>20?String(label).slice(0,19)+'…':String(label);
 return <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width:500,height:240}}>
  <Container data={data} layout={horizontal?'vertical':'horizontal'} margin={{top:14,right:horizontal?28:12,bottom:3,left:0}} accessibilityLayer>
   <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ui-primary)" stopOpacity={.2}/><stop offset="100%" stopColor="var(--ui-primary)" stopOpacity={.015}/></linearGradient></defs>
   <CartesianGrid stroke="var(--ui-border)" strokeDasharray="3 5" vertical={horizontal} horizontal={!horizontal}/>
   {horizontal?<><XAxis {...numericAxis} type="number"/><YAxis dataKey={xKey} type="category" width={124} tickFormatter={name} axisLine={false} tickLine={false} tick={{fontSize:11,fill:'var(--ui-fg-muted)'}} interval={0}/></>:<><XAxis dataKey={xKey} axisLine={false} tickLine={false} minTickGap={32} tickMargin={10} tick={{fontSize:11,fill:'var(--ui-fg-muted)'}}/><YAxis {...numericAxis} width={52} domain={domain} ticks={!bars&&ticks?.length?ticks:undefined} tickCount={4}/></>}
   {reference!==undefined&&<ReferenceLine {...(horizontal?{x:reference}:{y:reference})} stroke="var(--ui-fg-muted)" strokeDasharray="4 5" strokeOpacity={.6} label={referenceLabel?{value:referenceLabel,position:horizontal?'insideTopRight':'insideTopLeft',fontSize:10,fill:'var(--ui-fg-muted)'}:undefined}/>}
   <Tooltip wrapperStyle={{zIndex:5,maxWidth:'95%'}} content={({active,label,payload})=>{
    if(!active||!payload?.length)return null;
    const heading=payload[0]?.payload?.[xKey]??label;
    return <div className="price-chart-tooltip"><strong>{heading}</strong>{payload.map(entry=>{
     const value=entry.value,range=Array.isArray(value),price=Number(value),color=entry.color||'var(--ui-primary)';
     return <div key={String(entry.dataKey)}><span style={{background:color}}/><span className="tooltip-series">{entry.dataKey==='band'?(locale==='en'?'Price range':locale==='uz'?'Narx oralig‘i':'Диапазон цен'):entry.name}</span><b>{range?value.map(Number).map(format).join(' – '):format(price)} {unit}</b></div>;
    })}{reference!==undefined&&payload[0].value!==undefined&&!Array.isArray(payload[0].value)&&reference!==0&&<p className="tooltip-delta">{((Number(payload[0].value)/reference-1)*100).toFixed(1)}% · {referenceLabel}</p>}</div>;
   }} cursor={bars?{fill:'var(--ui-primary)',fillOpacity:.045}:{stroke:'var(--ui-fg-muted)',strokeDasharray:'3 4'}}/>
   {band&&!bars&&<Area dataKey="band" name="band" stroke="none" fill="var(--ui-primary)" fillOpacity={.065} isAnimationActive={false} activeDot={false} tooltipType="none"/>}
   {series.map((item,index)=>{
    const color=item.color||palette[index%4],common={dataKey:item.key,name:item.label,isAnimationActive:false};
    if(bars)return <Bar key={item.key} {...common} fill={color} radius={horizontal?[0,5,5,0]:[5,5,0,0]} maxBarSize={horizontal?17:24}>{data.map((_,row)=><Cell key={row} fill={row===highlightIndex?'#00bdb4':color} fillOpacity={highlightIndex===undefined||row===highlightIndex?1:.65}/>)}</Bar>;
    if(type==='area')return <Area key={item.key} {...common} type="linear" stroke={color} fill={`url(#${id})`} strokeWidth={2.5} dot={false} activeDot={{r:5,stroke:'var(--ui-bg)',strokeWidth:3}}/>;
    return <Line key={item.key} {...common} type="linear" stroke={color} strokeWidth={index===0?2.5:1.7} dot={false} activeDot={{r:4,stroke:'var(--ui-bg)',strokeWidth:2}}/>;
   })}
  </Container>
 </ResponsiveContainer>;
}
