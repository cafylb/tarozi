import React,{useEffect,useRef,useState} from 'react';
import L from 'leaflet';

export type MapStore={id:string;name:string;lat:number;lng:number};
export type StoreMapProps={stores:MapStore[];selected?:string;picker?:boolean;language:string;marker:string};
export default function StoreMap({stores,selected,picker=false,language,marker:markerHtml}:StoreMapProps){
 const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),markers=useRef(new Map<string,L.Marker>());
 const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!host.current)return;
  const instance=L.map(host.current,{scrollWheelZoom:false}).setView([41.326,69.295],12);map.current=instance;
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'}).addTo(instance);
  tiles.on('tileerror',()=>setFailed(true));
  let pin:L.CircleMarker|undefined;
  if(picker)instance.on('click',event=>{pin?.remove();pin=L.circleMarker(event.latlng,{radius:8,color:'#1460ff',fillOpacity:1}).addTo(instance);document.dispatchEvent(new CustomEvent('tarozi:location',{detail:{lat:event.latlng.lat,lng:event.latlng.lng}}));});
  const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(host.current);
  return()=>{observer.disconnect();instance.remove();map.current=null;markers.current.clear();};
 },[picker,retry]);
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  markers.current.forEach(marker=>marker.remove());markers.current.clear();
  const html=markerHtml;
  stores.forEach(store=>{const marker=L.marker([store.lat,store.lng],{title:store.name,icon:L.divIcon({className:'store-map-pin',html,iconSize:[34,34],iconAnchor:[17,17]})}).addTo(instance);const name=document.createElement('span');name.textContent=store.name;marker.bindTooltip(name);marker.on('click',()=>document.dispatchEvent(new CustomEvent('tarozi:store',{detail:{id:store.id}})));markers.current.set(store.id,marker);});
  if(stores.length&&!picker)instance.fitBounds(L.latLngBounds(stores.map(store=>[store.lat,store.lng])),{padding:[45,45],maxZoom:13});
 },[stores,picker,retry,markerHtml]);
 useEffect(()=>{const marker=selected?markers.current.get(selected):null;if(marker){map.current?.setView(marker.getLatLng(),14,{animate:false});marker.openTooltip();}},[selected,stores,retry]);
 const copy=language==='en'?['Map unavailable','Retry']:language==='uz'?['Xarita yuklanmadi','Qayta urinish']:['Карта не загрузилась','Повторить'];
 return <div className="store-map-wrap"><div ref={host} className="store-map" aria-label={language==='en'?'Map of Tashkent':language==='uz'?'Toshkent xaritasi':'Карта Ташкента'}/>{failed&&<div className="map-error">{copy[0]} <button onClick={()=>{setFailed(false);setRetry(value=>value+1);}}>{copy[1]}</button></div>}</div>;
}
