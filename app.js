import {DEFAULT_TRAILER,shipmentFromSheets,validatePlan,makeStages,planKey,locationText} from './model.js';
import {CargoScene,cargoColor,cargoInk} from './scene.js';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=n=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:1}).format(n);
const iconPaths={upload:'M12 16V3m-4 4 4-4 4 4M4 14v6h16v-6',download:'M12 3v13m-4-4 4 4 4-4M4 17v4h16v-4',truck:'M2 6h12v11H2zm12 4h4l4 4v3h-8M7 17a2 2 0 1 1-4 0m17 0a2 2 0 1 1-4 0',layers:'m3 7 9-5 9 5-9 5Zm0 5 9 5 9-5M3 17l9 5 9-5','arrow-right':'M4 12h16m-6-6 6 6-6 6','arrow-left':'M20 12H4m6-6-6 6 6 6',focus:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8',plus:'M5 12h14M12 5v14',minus:'M5 12h14',close:'m6 6 12 12M6 18 18 6',hand:'M7 12V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v9c0 4-3 7-7 7h-1c-2 0-4-1-5-3l-4-6c-1-2 1-4 3-2l2 2',check:'m5 12 4 4L20 5',pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-7-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4',info:'M12 11v6M12 7v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',box:'m3 7 9-5 9 5v10l-9 5-9-5Zm0 0 9 5 9-5m-9 5v10',rotate:'M3 10a9 9 0 1 1 2 8M3 3v7h7'};
const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name]||iconPaths.box}"/></svg>`;
function hydrateIcons(root=document){for(const el of root.querySelectorAll('[data-icon]'))el.innerHTML=svg(el.dataset.icon);}
hydrateIcons();
$('previous-button').setAttribute('aria-label','Back');
$('next-button').setAttribute('aria-label','Next');
let shipment,stages=[],scene=null,mode='overview',navigation='item',stageIndex=0,itemIndex=0,selectedId=null,completed=new Set(),showFuture=true,finished=false;
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function safeGet(key){try{return localStorage.getItem(key);}catch{return null;}}
function safeSet(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
function saveProgress(){if(!shipment)return;const saved=safeSet(planKey(shipment),JSON.stringify([...completed]));if(!saved)toast('Progress cannot be saved on this device.');}
function currentStage(){return stages[stageIndex];}
function currentItem(){return currentStage()?.items[itemIndex];}
function openDialog(id){const dialog=$(id);if(!dialog.open)dialog.showModal();}
function closeDialog(id){$(id).close();}
function setShipment(data,{persist=true}={}){
 validatePlan(data.items,data.placements,data.trailer);
 shipment=data;stages=makeStages(data.items,data.placements);mode='overview';navigation='item';stageIndex=0;itemIndex=0;selectedId=null;finished=false;showFuture=true;
 $('confirm-button').disabled=false;
 const saved=safeGet(planKey(data));try{const ids=new Set(data.items.map(i=>i.id));completed=new Set((JSON.parse(saved||'[]')).filter(id=>ids.has(id)));}catch{completed=new Set();}
 if(persist)safeSet('load-guide-last-shipment',JSON.stringify(data));
 document.title=`${data.name} · Load Guide`;
 try{if(!scene)scene=new CargoScene($('scene'),pickItem);scene.load(data);$('scene-error').hidden=true;}catch(error){console.warn('WebGL unavailable',error.message);$('scene').replaceChildren();$('scene-error').hidden=false;scene=null;}
 update();
}
function itemDetails(item,overview=false,layoutClass=''){
 const upper=shipment.items.find(i=>i.id===item.upper),placed=shipment.placements.find(p=>p.id===item.id);
 const base=placed?.base&&shipment.items.find(i=>i.id===placed.base);
 const bound={...item,placement:placed},color=cargoColor(item);
 let stack='';
 if(base)stack=`<div class="stack-detail"><span data-icon="layers"></span><span>On <strong style="--partner-color:${cargoColor(base)}" class="partner-label">${escape(base.label)}</strong> · ${format(item.weight)} / ${format(base.maxAbove)} kg above · ${format(base.height+item.height)} mm combined</span></div>`;
 else if(upper)stack=`<div class="stack-detail"><span data-icon="layers"></span><span><strong style="--partner-color:${cargoColor(upper)}" class="partner-label">${escape(upper.label)}</strong> above · ${format(item.weight+upper.weight)} kg combined · ${format(item.maxAbove)} kg upper limit</span></div>`;
 return `<article class="item-details ${layoutClass}" style="--cargo-color:${color}" data-cargo-id="${escape(item.id)}"><div class="item-heading"><div class="item-badge" style="background:${color};color:${cargoInk(item)}">${String(item.number).padStart(2,'0')}</div><div><h2>${escape(item.label)}${completed.has(item.id)?'<span class="item-loaded" aria-label="Loaded">✓</span>':''}</h2><p class="item-product">${escape(item.name)}</p></div></div><div class="item-facts"><span class="item-dimensions">${format(item.length)} × ${format(item.width)} × ${format(item.height)} mm</span><strong>${format(item.weight)} kg</strong><span>${item.pallets} EUR ${item.pallets===1?'pallet':'pallets'}</span><span>Upright · no rotation</span></div><div class="location"><span data-icon="pin"></span>${escape(locationText(bound,shipment.trailer))}</div>${stack}</article>`;
}
function overviewContent(){
 const mass=shipment.items.reduce((s,i)=>s+i.weight,0),pallets=shipment.items.reduce((s,i)=>s+i.pallets,0);
 const roster=`<div class="cargo-roster" aria-label="Cargo items">${shipment.items.map(i=>`<button class="cargo-chip ${selectedId===i.id?'active':''}" data-cargo="${escape(i.id)}" style="--cargo-color:${cargoColor(i)}" aria-expanded="${selectedId===i.id}" aria-label="${escape(i.label)}: ${escape(i.name)}"><span class="mini-badge" style="background:${cargoColor(i)};color:${cargoInk(i)}">${String(i.number).padStart(2,'0')}</span><span><strong>${escape(i.label)} ${completed.has(i.id)?'✓':''}</strong><small>${escape(i.name)}</small></span></button>${selectedId===i.id?itemDetails(i,true,'inline-item-details'):''}`).join('')}</div>`;
 return `<div class="overview-body"><div class="load-totals"><span><strong>${shipment.items.length}</strong> items</span><span><strong>${pallets}</strong> EUR pallets</span><span><strong>${format(mass)}</strong> kg</span></div>${roster}${selectedId?itemDetails(shipment.items.find(i=>i.id===selectedId),true,'mobile-item-details'):''}</div>`;
}
function stageContent(){
 const stage=currentStage(),item=currentItem();
 const switcher=`<div class="stage-controls"><div class="mode-switch" role="group" aria-label="Instruction detail"><button data-mode="item" class="${navigation==='item'?'active':''}" aria-pressed="${navigation==='item'}">By item</button><button data-mode="row" class="${navigation==='row'?'active':''}" aria-pressed="${navigation==='row'}">By row</button></div><span class="stage-counter">${escape(stage.title)} · ${navigation==='item'?`${itemIndex+1}/${stage.items.length}`:`${stage.items.length} items`}</span></div>`;
 const list=navigation==='row'?`<div class="row-item-list" aria-label="Items in this row">${stage.items.map((i,n)=>`<button class="row-item ${i.id===item.id?'active':''} ${completed.has(i.id)?'done':''}" data-item-index="${n}" style="--cargo-color:${cargoColor(i)}"><span class="mini-badge" style="background:${cargoColor(i)};color:${cargoInk(i)}">${String(i.number).padStart(2,'0')}</span><span class="row-item-copy"><strong>${escape(i.label)}</strong><small>${format(i.weight)} kg${i.placement.base?' · upper':''}</small></span><span class="row-item-status">${completed.has(i.id)?'✓':''}</span></button>`).join('')}</div>`:'';
 return `${switcher}${list}${itemDetails(item)}`;
}
function completeContent(){
 return `<div class="load-complete"><span class="item-loaded">✓</span><strong>${shipment.items.length} / ${shipment.items.length} loaded</strong><button id="complete-overview" class="button subtle">${svg('layers')}Overview</button></div>`;
}
function update({focus=false}={}){
 if(!shipment)return;
 const stage=currentStage(),item=currentItem(),overview=mode==='overview';
 document.querySelector('.app-shell').dataset.loadingMode=overview?'overview':'guide';
 $('overview-button').setAttribute('aria-pressed',String(overview));
 $('row-list').innerHTML=stages.map((s,index)=>{
  const done=s.items.every(i=>completed.has(i.id)),count=s.items.filter(i=>completed.has(i.id)).length;
  return `<button class="row-button ${!overview&&index===stageIndex?'active':''} ${done?'done':''}" data-stage="${index}" ${!overview&&index===stageIndex?'aria-current="step"':''}><span class="row-index">${done?'✓':String(index+1).padStart(2,'0')}</span><span><strong>${escape(s.title)}</strong><small>${s.items.length} ${s.items.length===1?'item':'items'}${count?` · ${count} loaded`:''}</small></span><span class="row-status">${!overview&&index===stageIndex?'•':''}</span></button>`;
 }).join('');
 $('instructions').innerHTML=finished?completeContent():overview?overviewContent():stageContent();hydrateIcons($('instructions'));
 const announced=overview?shipment.items.find(i=>i.id===selectedId):item;
 $('step-announcement').textContent=finished?`${shipment.items.length} of ${shipment.items.length} loaded`:announced?`${overview?'':stage.title+', '}${announced.label}, ${announced.name}, ${format(announced.weight)} kilograms`:'';
 $('progress-number').textContent=`${completed.size} of ${shipment.items.length}`;
 $('progress-track').innerHTML=shipment.items.map(i=>`<i class="${completed.has(i.id)?'done':''}"></i>`).join('');
 $('progress-track').setAttribute('aria-valuemax',shipment.items.length);$('progress-track').setAttribute('aria-valuenow',completed.size);
 $('reset-progress').hidden=completed.size===0;
 $('previous-button').hidden=overview||finished;$('next-button').hidden=overview||finished;
 $('previous-button').disabled=stageIndex===0&&(navigation==='row'||itemIndex===0);
 $('next-button').disabled=stageIndex===stages.length-1&&(navigation==='row'||itemIndex===stage.items.length-1);
 const hasPending=completed.size<shipment.items.length;
 $('confirm-button').innerHTML=overview?`<span>${hasPending&&completed.size?'Continue loading':hasPending?'Start loading':'Review sequence'}</span>${svg('arrow-right')}`:finished?`<span>Back to overview</span>${svg('layers')}`:`<span>${navigation==='row'?'Row loaded & next':'Loaded & next'}</span>${svg('check')}`;
 $('stage-badge').innerHTML=`<span class="badge-dot"></span>${overview?'Complete load':finished?'All items confirmed':`${escape(stage.title)} · ${navigation==='item'?escape(item.label):`${stage.items.length} items`}`}`;
 $('stage-badge').hidden=overview;
 document.querySelector('.scene-legend').hidden=overview;
 $('legend-current').textContent=overview?'Item colours':'Outlined: current';$('loaded-legend').hidden=overview;$('upcoming-legend').hidden=overview;$('show-future').hidden=overview||finished;
 $('show-future').textContent=showFuture?'Hide upcoming':'Show upcoming';$('show-future').setAttribute('aria-pressed',String(showFuture));
 const currentIds=overview?(selectedId?[selectedId]:[]):navigation==='item'?[item.id]:stage.items.map(i=>i.id);
 scene?.update({overview:overview||finished,currentIds,completed,showFuture,stage});
 if(focus)scene?.fit(overview||finished?null:stage);
 if(!$('scene-error').hidden)renderFallback();
 bindPanel();
 if(focus&&!overview){
  const active=$('row-list').querySelector('[aria-current="step"]'),rail=active?.closest('.row-nav');
  if(active&&rail&&rail.scrollWidth>rail.clientWidth)rail.scrollTo({left:Math.max(0,active.offsetLeft-rail.offsetLeft-rail.clientWidth/2+active.offsetWidth/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
}
function revealSelectedCard(){
 const selected=document.querySelector('.cargo-chip.active'),roster=selected?.closest('.cargo-roster');
 if(selected&&roster&&roster.scrollWidth>roster.clientWidth)roster.scrollLeft=selected.offsetLeft-roster.offsetLeft-roster.clientWidth/2+selected.offsetWidth/2;
 if(!selected||!matchMedia('(min-width:621px)').matches)return;
 const details=selected.nextElementSibling,panel=selected.closest('.instruction-panel');
 if(!details?.classList.contains('inline-item-details')||!panel)return;
 const cardRect=selected.getBoundingClientRect(),detailRect=details.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
 if(cardRect.top<panelRect.top+10||detailRect.bottom>panelRect.bottom-10)panel.scrollTop+=cardRect.top-panelRect.top-12;
}
function bindPanel(){
 for(const b of document.querySelectorAll('[data-cargo]'))b.addEventListener('click',()=>{
  const id=b.dataset.cargo;pickItem(id);
  [...document.querySelectorAll('[data-cargo]')].find(card=>card.dataset.cargo===id)?.focus({preventScroll:true});
 });
 revealSelectedCard();
 $('complete-overview')?.addEventListener('click',showOverview);
 for(const b of document.querySelectorAll('.mode-switch button[data-mode]'))b.addEventListener('click',()=>{navigation=b.dataset.mode;update();});
 for(const b of document.querySelectorAll('[data-item-index]'))b.addEventListener('click',()=>{itemIndex=Number(b.dataset.itemIndex);update();});
 $('item-previous')?.addEventListener('click',()=>{itemIndex=Math.max(0,itemIndex-1);update();});
 $('item-next')?.addEventListener('click',()=>{itemIndex=Math.min(currentStage().items.length-1,itemIndex+1);update();});
}
function renderFallback(){
 const rows=Math.ceil(shipment.trailer.length/1200),cells=[];
 for(let r=0;r<rows;r++)for(let lane=0;lane<3;lane++){
  const p=shipment.placements.filter(p=>!p.base).find(p=>{const i=shipment.items.find(i=>i.id===p.id);return p.x<(r+1)*1200&&p.x+i.length>r*1200&&p.y<(lane+1)*800&&p.y+i.width>lane*800;});
  const item=p&&shipment.items.find(i=>i.id===p.id);cells.push(`<button data-pick="${p?escape(p.id):''}" class="${currentStage()?.items.some(i=>i.id===p?.id)&&mode!=='overview'?'active':''}" ${p?'':'disabled'}>${r+1}${['L','C','R'][lane]}${item?` · ${item.number}`:''}</button>`);
 }
 $('fallback-map').innerHTML=`<div class="fallback-grid">${cells.join('')}</div>`;
 $('fallback-map').querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>pickItem(b.dataset.pick)));
}
function pickItem(id){
 if(mode==='overview'){selectedId=selectedId===id?null:id;finished=false;update();return;}
 for(let s=0;s<stages.length;s++){const index=stages[s].items.findIndex(i=>i.id===id);if(index>=0){stageIndex=s;itemIndex=index;finished=false;update();break;}}
}
function showOverview(){mode='overview';selectedId=null;finished=false;update({focus:true});}
function begin(){
 mode='guide';selectedId=null;finished=false;
 const next=stages.flatMap((s,si)=>s.items.map((i,ii)=>({i,si,ii}))).find(x=>!completed.has(x.i.id));
 stageIndex=next?.si||0;itemIndex=next?.ii||0;update({focus:true});
}
function navigate(direction){
 if(mode==='overview'||finished)return;
 if(navigation==='row'){stageIndex=Math.max(0,Math.min(stages.length-1,stageIndex+direction));itemIndex=0;}
 else{itemIndex+=direction;if(itemIndex<0){if(stageIndex>0){stageIndex--;itemIndex=stages[stageIndex].items.length-1;}else itemIndex=0;}else if(itemIndex>=currentStage().items.length){if(stageIndex<stages.length-1){stageIndex++;itemIndex=0;}else itemIndex=currentStage().items.length-1;}}
 update({focus:true});
}
function confirm(){
 if(mode==='overview'){begin();return;}if(finished){showOverview();return;}
 const targets=navigation==='row'?currentStage().items:[currentItem()];targets.forEach(i=>completed.add(i.id));saveProgress();
 if(completed.size===shipment.items.length){finished=true;update({focus:true});toast('Every item confirmed. Loading sequence complete.');return;}
 const atEnd=stageIndex===stages.length-1&&(navigation==='row'||itemIndex===currentStage().items.length-1);
 if(atEnd){begin();toast('Returning to the next unconfirmed item.');}else navigate(1);
}
async function importFile(file){
 if(!file)return;
 $('upload-status').hidden=false;$('upload-status').textContent='Reading and checking your shipment…';
 try{
  if(file.size>8*1024*1024)throw new Error('Choose a file smaller than 8 MB.');
  if(!/\.(xlsx|csv)$/i.test(file.name))throw new Error('Choose an .xlsx workbook or a .csv file.');
  if(!window.XLSX)throw new Error('The Excel reader has not finished loading. Try again in a moment.');
  const buffer=await file.arrayBuffer();
  const workbook=window.XLSX.read(buffer,{type:'array',cellDates:false,sheetRows:600,cellHTML:false,cellFormula:false,bookVBA:false});
  const sheets=workbook.SheetNames.slice(0,25).map(name=>({name,rows:window.XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:null,blankrows:true,raw:true})}));
  const data=shipmentFromSheets(sheets,file.name);setShipment(data);closeDialog('upload-dialog');toast(`Opened ${data.items.length} items · ${data.generated?'suggested layout':'workbook plan'}`);
 }catch(error){$('upload-status').textContent=error.message||'This file could not be read. Try the example workbook.';}
 finally{$('shipment-file').value='';}
}
async function loadExample(){const response=await fetch('./example.json');if(!response.ok)throw new Error('The example shipment could not be loaded.');setShipment(await response.json());}
$('upload-button').addEventListener('click',()=>{$('upload-status').hidden=true;openDialog('upload-dialog');});
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('shipment-file').addEventListener('change',e=>importFile(e.target.files[0]));
$('dropzone').addEventListener('dragover',e=>{e.preventDefault();$('dropzone').classList.add('dragging');});
$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('dragging'));
$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('dragging');importFile(e.dataTransfer.files[0]);});
$('example-button').addEventListener('click',async()=>{try{await loadExample();closeDialog('upload-dialog');toast('Example shipment opened.');}catch(e){$('upload-status').hidden=false;$('upload-status').textContent=e.message;}});
$('overview-button').addEventListener('click',showOverview);
$('row-list').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(!b)return;mode='guide';finished=false;stageIndex=Number(b.dataset.stage);itemIndex=0;selectedId=null;update({focus:true});});
$('confirm-button').addEventListener('click',confirm);
$('previous-button').addEventListener('click',()=>navigate(-1));$('next-button').addEventListener('click',()=>navigate(1));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('selected',a===b);a.setAttribute('aria-pressed',String(a===b));});scene?.setView(b.dataset.view,mode==='overview'||finished?null:currentStage());}));
$('focus-button').addEventListener('click',()=>scene?.fit(mode==='overview'||finished?null:currentStage()));
$('zoom-in').addEventListener('click',()=>scene?.zoom(.8));$('zoom-out').addEventListener('click',()=>scene?.zoom(1.25));
$('show-future').addEventListener('click',()=>{showFuture=!showFuture;update();});
$('reset-progress').addEventListener('click',()=>openDialog('reset-dialog'));
$('reset-confirm').addEventListener('click',()=>{completed.clear();saveProgress();finished=false;closeDialog('reset-dialog');update();toast('Loading progress cleared.');});
$('scene').addEventListener('scene-lost',()=>{$('scene-error').hidden=false;renderFallback();});
matchMedia('(min-width:621px)').addEventListener('change',revealSelectedCard);
document.addEventListener('keydown',e=>{
 if(document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 if(e.key==='ArrowRight'){e.preventDefault();navigate(1);}else if(e.key==='ArrowLeft'){e.preventDefault();navigate(-1);}else if(e.key==='Enter'&&!['BUTTON','A'].includes(document.activeElement?.tagName)){e.preventDefault();confirm();}
});
try{
 let restored=false;const previous=safeGet('load-guide-last-shipment');
 if(previous){try{setShipment(JSON.parse(previous),{persist:false});restored=true;}catch{}}
 if(!restored)await loadExample();
}catch(error){$('scene').innerHTML=`<div class="scene-loading">${escape(error.message)}</div>`;$('instructions').innerHTML='<h2 class="panel-title">Open a shipment to begin.</h2><p class="panel-intro">Choose an Excel workbook using Open shipment.</p>';$('confirm-button').disabled=true;}
if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
