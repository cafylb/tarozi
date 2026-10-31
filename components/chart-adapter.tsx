import React from 'react';
import {createRoot,Root} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Chart from './ui/chart';
import NavHeader,{NavItem} from './ui/nav-header';
import AssistantChat,{AssistantProps} from './ui/assistant-chat';
import StoreMap,{StoreMapProps} from './ui/store-map';
type Options={labels:string[];series:{name:string;values:number[]}[];yTicks:number[];type:'line'|'area'|'bar'|'horizontal-bar';locale:string;unit:string;band?:{min:number[];max:number[]};reference?:number;referenceLabel?:string;highlightIndex?:number};
const roots=new WeakMap<HTMLElement,Root>();
const api={
 map(element:HTMLElement,props:StoreMapProps) {
  let root=roots.get(element);if(!root){root=createRoot(element);roots.set(element,root);}
  flushSync(()=>root.render(<StoreMap {...props}/>));
 },
 assistant(element:HTMLElement,props:AssistantProps) {
  let root=roots.get(element);if(!root){root=createRoot(element);roots.set(element,root);}
  flushSync(()=>root.render(<AssistantChat {...props}/>));
 },
 nav(element:HTMLElement,items:NavItem[],active:string,label:string) {
  let root=roots.get(element);if(!root){root=createRoot(element);roots.set(element,root);}
  flushSync(()=>root.render(<NavHeader items={items} active={active} label={label}/>));
 },
 line(element:HTMLElement,options:Options) {
  let root=roots.get(element);if(!root){root=createRoot(element);roots.set(element,root);}
  const data=options.labels.map((date,index)=>({date,...Object.fromEntries(options.series.map((series,key)=>['value'+key,series.values[index]])),...(options.band?{band:[options.band.min[index],options.band.max[index]]}:{})}));
  element.setAttribute('role','img');element.setAttribute('aria-label',options.series.map(series=>series.name).join(', '));
  const animationKey=element.dataset.motionChart||options.series.map(series=>series.name).join('|')+':'+options.labels.join(',')+':'+options.type;
  flushSync(()=>root.render(<Chart data={data} xKey="date" series={options.series.map((series,key)=>({key:'value'+key,label:series.name}))} type={options.type} ticks={options.yTicks} locale={options.locale} unit={options.unit} band={!!options.band} reference={options.reference} referenceLabel={options.referenceLabel} highlightIndex={options.highlightIndex} animationKey={animationKey}/>));
 },
 release(element:HTMLElement){roots.get(element)?.unmount();roots.delete(element);}
};
(window as unknown as {Charts:typeof api}).Charts=api;
