import React from 'react';
import {createRoot,Root} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Chart from './ui/chart';
import NavHeader,{NavItem} from './ui/nav-header';
type Options={labels:string[];series:{name:string;values:number[]}[];yTicks:number[];type:'line'|'area'|'bar';locale:string;unit:string};
const roots=new WeakMap<HTMLElement,Root>();
const api={
 nav(element:HTMLElement,items:NavItem[],active:string,label:string) {
  let root=roots.get(element);if(!root){root=createRoot(element);roots.set(element,root);}
  flushSync(()=>root.render(<NavHeader items={items} active={active} label={label}/>));
 },
 line(element:HTMLElement,options:Options) {
  let root=roots.get(element);if(!root){root=createRoot(element);roots.set(element,root);}
  const data=options.labels.map((date,index)=>({date,...Object.fromEntries(options.series.map((series,key)=>['value'+key,series.values[index]]))}));
  element.setAttribute('role','img');element.setAttribute('aria-label',options.series.map(series=>series.name).join(', '));
  flushSync(()=>root.render(<Chart data={data} xKey="date" series={options.series.map((series,key)=>({key:'value'+key,label:series.name}))} type={options.type} ticks={options.yTicks} locale={options.locale} unit={options.unit}/>));
 },
 release(element:HTMLElement){roots.get(element)?.unmount();roots.delete(element);}
};
(window as unknown as {Charts:typeof api}).Charts=api;
