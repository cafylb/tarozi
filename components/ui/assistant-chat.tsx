import React,{useEffect,useRef,useState} from 'react';

type Offer={productId:string;productName:string;supplierId:string;supplierName:string;market:string;quantity:number;unit:string;price:number;delivery:number;total:number};
type Message={role:'user'|'assistant';text:string;offers?:Offer[];mode?:string;error?:boolean};
const copy={
 ru:{title:'Помощник Tarozi',subtitle:'Предложения и ответы о сервисе',open:'Открыть помощника',close:'Закрыть чат',welcome:'Что закупаем сегодня?',intro:'Сравню предложения из демо-каталога и посчитаю стоимость с доставкой.',prompts:['Сахар 50 кг','Где дешевле рис 25 кг?','Как работает Tarozi?'],placeholder:'Товар, количество или вопрос…',send:'Отправить',thinking:'Сравниваю предложения…',demo:'Демо-каталог · цены не являются актуальными',catalog:'Поиск по каталогу · ИИ не подключён',ai:'Gemini · демо-каталог',offline:'Не удалось получить ответ. Попробуйте ещё раз.',quota:'ИИ временно недоступен. Ниже — поиск по каталогу.',delivery:'Доставка',total:'С доставкой',each:'сум',view:'Выбрать предложение',minimum:'Указанное количество меньше минимальной партии. Увеличьте его.',retry:'Повторить',notice:'Поиск по демо-данным. Для свободных ИИ-ответов нужен Gemini.'},
 en:{title:'Tarozi Assistant',subtitle:'Offers and answers about Tarozi',open:'Open assistant',close:'Close chat',welcome:'What are we buying today?',intro:'I compare demo-catalog offers and calculate totals including delivery.',prompts:['Sugar 50 kg','Cheapest rice 25 kg?','How does Tarozi work?'],placeholder:'Product, quantity or question…',send:'Send',thinking:'Comparing offers…',demo:'Demo catalog · prices are illustrative',catalog:'Catalog search · AI not connected',ai:'Gemini · demo catalog',offline:'Unable to get a reply. Please try again.',quota:'AI is temporarily unavailable. Showing catalog search.',delivery:'Delivery',total:'With delivery',each:'UZS',view:'Select offer',minimum:'This quantity is below the minimum order. Please increase it.',retry:'Try again',notice:'Search uses demo data. Gemini is required for free-form AI answers.'},
 uz:{title:'Tarozi yordamchisi',subtitle:'Takliflar va xizmat haqida javoblar',open:'Yordamchini ochish',close:'Chatni yopish',welcome:'Bugun nima xarid qilamiz?',intro:'Demo-katalog takliflarini taqqoslayman va yetkazish bilan jami narxni hisoblayman.',prompts:['Shakar 50 kg','25 kg guruch qayerda arzon?','Tarozi qanday ishlaydi?'],placeholder:'Mahsulot, miqdor yoki savol…',send:'Yuborish',thinking:'Takliflar taqqoslanmoqda…',demo:'Demo-katalog · narxlar namunaviy',catalog:'Katalog qidiruvi · AI ulanmagan',ai:'Gemini · demo-katalog',offline:'Javob olib bo‘lmadi. Qayta urinib ko‘ring.',quota:'AI vaqtincha mavjud emas. Katalog qidiruvi ko‘rsatilmoqda.',delivery:'Yetkazish',total:'Yetkazish bilan',each:'so‘m',view:'Taklifni tanlash',minimum:'Miqdor eng kam buyurtmadan kichik. Miqdorni oshiring.',retry:'Qayta urinish',notice:'Qidiruv demo ma’lumotlardan foydalanadi. Erkin AI javoblari uchun Gemini kerak.'}
};
export interface AssistantProps {language:'ru'|'en'|'uz';names:Record<string,string>}
export default function AssistantChat({language,names}:AssistantProps) {
 const t=copy[language]||copy.ru;
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState('catalog'),[messages,setMessages]=useState<Message[]>([]);
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLTextAreaElement>(null),bottom=useRef<HTMLDivElement>(null),controller=useRef<AbortController|null>(null),lastQuery=useRef('');
 const number=(value:number)=>new Intl.NumberFormat(language).format(value);
 useEffect(()=>{const abort=new AbortController();fetch('/api/assistant',{signal:abort.signal}).then(response=>response.json()).then(data=>setMode(data.mode==='ai'?'ai':'catalog')).catch(()=>{});return()=>{abort.abort();controller.current?.abort();};},[]);
 useEffect(()=>{if(open&&!dialog.current?.open){dialog.current?.showModal();input.current?.focus();}else if(!open&&dialog.current?.open)dialog.current.close();},[open]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'end',behavior:'instant'});},[messages,busy,open]);
 async function send(value:string) {
  const message=value.trim();if(!message||busy)return;
  lastQuery.current=message;const history=messages.filter(item=>!item.error).slice(-6).map(item=>({role:item.role,text:item.text}));
  setMessages(previous=>[...previous,{role:'user',text:message}]);setDraft('');setBusy(true);controller.current=new AbortController();
  const timer=setTimeout(()=>controller.current?.abort(),30000);
  try{
   const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,language,history}),signal:controller.current.signal});
   if(!response.ok)throw new Error('REQUEST_FAILED');
   const data=await response.json();setMode(data.mode==='ai'?'ai':'catalog');
   const text=[data.notice?t.quota:'',data.answer||t.notice,data.quantityIssue?t.minimum:''].filter(Boolean).join('\n\n');
   setMessages(previous=>[...previous,{role:'assistant',text,offers:Array.isArray(data.offers)?data.offers:[],mode:data.mode}]);
  }catch{setMessages(previous=>[...previous,{role:'assistant',text:t.offline,error:true}]);}
  finally{clearTimeout(timer);setBusy(false);input.current?.focus();}
 }
 function choose(offer:Offer){document.dispatchEvent(new CustomEvent('tarozi:offer',{detail:{productId:offer.productId,supplierId:offer.supplierId,quantity:offer.quantity}}));setOpen(false);}
 return <>
  <button type="button" className="assistant-launcher" aria-label={t.open} aria-haspopup="dialog" onClick={()=>setOpen(true)}><span className="assistant-mark" aria-hidden="true">✦</span><span>Tarozi<span className="assistant-launcher-sub">{language==='ru'?'Помощник':language==='uz'?'Yordamchi':'Assistant'}</span></span><span aria-hidden="true">↗</span></button>
  <dialog ref={dialog} className="assistant-dialog" aria-labelledby="assistant-title" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setOpen(false);}}}>
   <div className="assistant-panel">
    <header className="assistant-heading"><span className="assistant-mark" aria-hidden="true">✦</span><div><h2 id="assistant-title">{t.title}</h2><p>{t.subtitle}</p></div><button type="button" className="icon-btn" aria-label={t.close} onClick={()=>setOpen(false)}>×</button></header>
    <div className="assistant-messages" aria-live="polite" aria-relevant="additions text" role="log">
     {!messages.length&&<section className="assistant-welcome"><p className="assistant-kicker">TAROZI / ASSISTANT</p><h3>{t.welcome}</h3><p>{t.intro}</p><div className="assistant-prompts">{t.prompts.map(prompt=><button type="button" key={prompt} onClick={()=>send(prompt)}>{prompt}<span aria-hidden="true">↗</span></button>)}</div></section>}
     {messages.map((message,index)=><article key={index} className={`assistant-message ${message.role}`}><div className="assistant-message-text">{message.text}</div>{message.offers?.map((offer,offerIndex)=><section className="assistant-offer" key={`${offer.productId}-${offer.supplierId}`}><div className="assistant-offer-top"><span>{names[offer.productId]||offer.productName}</span><span className="num">{offer.quantity} {offer.unit==='кг'?'kg':language==='ru'?'л':'l'}</span></div><h3>{offer.supplierName}</h3><p>{offer.market} · {number(offer.price)} {t.each} / {offer.unit==='кг'?'kg':language==='ru'?'л':'l'}</p><div className="assistant-offer-cost"><span>{t.delivery}</span><span className="num">{number(offer.delivery)} {t.each}</span></div><div className="assistant-offer-total"><span>{t.total}</span><strong className="num">{number(offer.total)} {t.each}</strong></div><button type="button" onClick={()=>choose(offer)}>{t.view}<span aria-hidden="true">↗</span></button>{offerIndex===0&&<span className="sr-only">{t.total}</span>}</section>)}{message.error&&<button type="button" className="text-button" onClick={()=>send(lastQuery.current)} disabled={busy}>{t.retry}</button>}</article>)}
     {busy&&<p className="assistant-thinking" role="status"><span/>{t.thinking}</p>}<div ref={bottom}/>
    </div>
    <form className="assistant-compose" onSubmit={event=>{event.preventDefault();send(draft);}}><label className="sr-only" htmlFor="assistant-input">{t.placeholder}</label><textarea ref={input} id="assistant-input" value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send(draft);}}} placeholder={t.placeholder} maxLength={2000} rows={2} enterKeyHint="send"/><button type="submit" aria-label={t.send} disabled={!draft.trim()||busy}>↑</button></form>
    <footer className="assistant-status"><span>{mode==='ai'?t.ai:t.catalog}</span><small>{t.demo}</small></footer>
   </div>
  </dialog>
 </>;
}
