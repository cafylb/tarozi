import React from 'react';
import * as Select from '@radix-ui/react-select';
import {CaretDown,Check,GlobeSimple,SlidersHorizontal} from '@phosphor-icons/react';

export interface MenuSelectProps {id:string;value:string;label:string;kind:'language'|'sort';options:{value:string;label:string}[];container:HTMLElement|null}
export default function MenuSelect({id,value,label,kind,options,container}:MenuSelectProps){
 return <Select.Root value={value} onValueChange={next=>queueMicrotask(()=>document.dispatchEvent(new CustomEvent('tarozi:select',{detail:{id,value:next}})))}>
  <Select.Trigger id={id} aria-label={label} className={'studio-select-trigger '+kind}>
   {kind==='sort'?<SlidersHorizontal size={16} aria-hidden="true"/>:<GlobeSimple size={16} aria-hidden="true"/>}
   <Select.Value/><Select.Icon className="studio-select-caret"><CaretDown size={13}/></Select.Icon>
  </Select.Trigger>
  <Select.Portal container={container}>
   <Select.Content className="studio-select-content" position="popper" align="end" sideOffset={8} collisionPadding={12}>
    <Select.Viewport>{options.map(option=><Select.Item className="studio-select-option" value={option.value} key={option.value}><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check size={15} weight="bold"/></Select.ItemIndicator></Select.Item>)}</Select.Viewport>
   </Select.Content>
  </Select.Portal>
 </Select.Root>;
}
