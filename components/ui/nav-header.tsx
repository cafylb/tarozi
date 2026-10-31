"use client";
import React, {useLayoutEffect,useRef,useState} from 'react';
import {motion,useReducedMotion} from 'framer-motion';

export interface NavItem {id:string;label:string;count?:number}
export default function NavHeader({items,active,label}:{items:NavItem[];active:string;label:string}) {
  const container=useRef<HTMLUListElement>(null);
  const [position,setPosition]=useState({left:0,width:0,opacity:0});
  const [highlighted,setHighlighted]=useState(active);
  const reduced=useReducedMotion();
  function point(element:HTMLElement|null) {
    if(element){const tab=element.closest<HTMLElement>('.header-tab')||element;setPosition({left:tab.offsetLeft,width:tab.offsetWidth,opacity:1});setHighlighted(tab.querySelector('button')?.dataset.view || '');}
    else {setPosition(previous=>({...previous,opacity:0}));setHighlighted('');}
  }
  const restore=()=>point(container.current?.querySelector<HTMLElement>('[aria-current="page"]')||null);
  useLayoutEffect(()=>{
    restore();
    const observer=new ResizeObserver(restore);
    if(container.current)observer.observe(container.current);
    return ()=>observer.disconnect();
  },[active,items.map(item=>item.label+item.count).join('|')]);
  return <ul ref={container} className="header-pill" aria-label={label} onMouseLeave={restore} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))restore();}}>
    <motion.li aria-hidden="true" className="header-cursor" initial={false} animate={{transform:`translateX(${position.left}px)`,width:position.width,opacity:position.opacity}} transition={{duration:reduced?0:.18,ease:[.23,1,.32,1]}}/>
    {items.map(item=><li key={item.id} className="header-tab"><button type="button" data-action="view" data-view={item.id} data-highlighted={highlighted===item.id?'true':undefined} aria-current={active===item.id?'page':undefined} onMouseEnter={event=>{if(matchMedia('(hover: hover) and (pointer: fine)').matches)point(event.currentTarget.parentElement);}} onFocus={event=>point(event.currentTarget.parentElement)}>{item.label}{item.count!==undefined&&<span className="header-count">{item.count}</span>}</button></li>)}
  </ul>;
}
