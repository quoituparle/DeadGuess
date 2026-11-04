import {esc} from './model.js';

const chevron='<svg viewBox="0 0 24 24" class="icon select-caret" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
const check='<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
let active=null;

export function moveIndex(index, delta, length){return length?((index+delta)%length+length)%length:-1;}
export function matchOption(labels, text, start=0){
  const query=text.toLocaleLowerCase();
  for(let step=0;step<labels.length;step++){
    const i=moveIndex(start,step,labels.length);
    if(labels[i].toLocaleLowerCase().startsWith(query))return i;
  }
  return -1;
}

export function closeSelect({restoreFocus=false}={}){
  if(!active)return;
  const {trigger,popup}=active;
  trigger.setAttribute('aria-expanded','false');
  trigger.removeAttribute('aria-activedescendant');
  popup.remove();active=null;
  if(restoreFocus&&trigger.isConnected)trigger.focus({preventScroll:true});
}

function positionPopup(){
  if(!active)return;
  const {trigger,popup}=active;
  if(!trigger.isConnected){closeSelect();return;}
  const r=trigger.getBoundingClientRect(),gap=7,margin=12;
  const viewportWidth=document.documentElement.clientWidth||innerWidth;
  const viewportHeight=document.documentElement.clientHeight||innerHeight;
  const below=viewportHeight-r.bottom-gap-margin,above=r.top-gap-margin;
  const upwards=below<180&&above>below;
  const room=Math.max(60,upwards?above:below);
  const width=Math.min(viewportWidth-margin*2,Math.max(r.width,230));
  popup.style.width=`${width}px`;
  popup.style.maxHeight=`${Math.min(320,room)}px`;
  popup.style.left=`${Math.min(Math.max(margin,r.left),viewportWidth-width-margin)}px`;
  const height=popup.getBoundingClientRect().height;
  popup.style.top=`${upwards?Math.max(margin,r.top-gap-height):r.bottom+gap}px`;
  popup.dataset.placement=upwards?'top':'bottom';
}

function highlight(index){
  if(!active||index<0)return;
  active.index=index;
  active.popup.querySelectorAll('[role="option"]').forEach((option,i)=>option.classList.toggle('is-active',index===i));
  const item=active.popup.querySelectorAll('[role="option"]')[index];
  active.trigger.setAttribute('aria-activedescendant',item.id);
  item.scrollIntoView({block:'nearest'});
}

function commit(index){
  if(!active)return;
  const {select,trigger,options}=active;
  const next=options[index];
  if(!next)return;
  const changed=select.value!==next.value;
  select.value=next.value;
  trigger.querySelector('.select-value').textContent=next.textContent;
  closeSelect({restoreFocus:true});
  if(changed){
    select.dispatchEvent(new Event('change',{bubbles:true}));
    queueMicrotask(()=>document.getElementById(`${select.id}-trigger`)?.focus({preventScroll:true}));
  }
}

function openSelect(select,trigger){
  if(active?.trigger===trigger){closeSelect();return;}
  closeSelect();
  const options=[...select.options].filter(option=>!option.disabled);
  if(!options.length)return;
  const popup=document.createElement('div');
  popup.className='select-popup';popup.id=`${select.id}-listbox`;
  popup.setAttribute('role','listbox');
  popup.setAttribute('aria-label',select.getAttribute('aria-label')||'Options');
  popup.innerHTML=options.map((option,i)=>`<div class="select-option ${option.value===select.value?'is-selected':''}" role="option" id="${esc(select.id)}-option-${i}" aria-selected="${option.value===select.value}" data-option="${i}"><span>${esc(option.textContent)}</span><span class="option-check">${check}</span></div>`).join('');
  document.body.append(popup);
  active={select,trigger,popup,options,index:Math.max(0,options.findIndex(option=>option.value===select.value)),query:'',typedAt:0};
  trigger.setAttribute('aria-expanded','true');
  positionPopup();highlight(active.index);
  popup.addEventListener('pointermove',event=>{const option=event.target.closest('[data-option]');if(option)highlight(Number(option.dataset.option));});
  popup.addEventListener('pointerdown',event=>event.preventDefault());
  popup.addEventListener('click',event=>{const option=event.target.closest('[data-option]');if(option)commit(Number(option.dataset.option));});
}

function onKey(event,select,trigger){
  const isOpen=active?.trigger===trigger;
  if(event.key==='Escape'&&isOpen){event.preventDefault();event.stopPropagation();closeSelect({restoreFocus:true});return;}
  if(event.key==='Tab'){closeSelect();return;}
  if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)){
    event.preventDefault();
    if(!isOpen){openSelect(select,trigger);if(event.key==='Home')highlight(0);if(event.key==='End')highlight(active.options.length-1);return;}
    if(event.key==='Enter'||event.key===' '){commit(active.index);return;}
    if(event.key==='Home')highlight(0);
    else if(event.key==='End')highlight(active.options.length-1);
    else highlight(moveIndex(active.index,event.key==='ArrowDown'?1:-1,active.options.length));
    return;
  }
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    event.preventDefault();if(!isOpen)openSelect(select,trigger);
    if(!active)return;
    const now=Date.now();active.query=now-active.typedAt>650?'':active.query;active.typedAt=now;
    active.query+=event.key;
    let found=matchOption(active.options.map(o=>o.textContent),active.query,active.index);
    if(found<0){active.query=event.key;found=matchOption(active.options.map(o=>o.textContent),event.key,moveIndex(active.index,1,active.options.length));}
    if(found>=0)highlight(found);
  }
}

/** Upgrade existing selects, retaining their values and change event contract. */
export function enhanceSelects(root=document){
  closeSelect();
  root.querySelectorAll('select:not([data-enhanced])').forEach(select=>{
    select.dataset.enhanced='true';select.hidden=true;select.tabIndex=-1;
    const wrapper=document.createElement('div');wrapper.className='selectbox';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';
    trigger.id=`${select.id}-trigger`;trigger.disabled=select.disabled;
    trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',`${select.id}-listbox`);
    trigger.setAttribute('aria-label',select.getAttribute('aria-label')||'Select option');
    trigger.innerHTML=`<span class="select-value">${esc(select.selectedOptions[0]?.textContent||'Select…')}</span>${chevron}`;
    select.after(wrapper);wrapper.append(trigger);
    trigger.addEventListener('click',()=>openSelect(select,trigger));
    trigger.addEventListener('keydown',event=>onKey(event,select,trigger));
    trigger.addEventListener('blur',()=>{if(active?.trigger===trigger)closeSelect();});
  });
}

if(typeof document!=='undefined'){
  document.addEventListener('pointerdown',event=>{if(active&&!active.trigger.contains(event.target)&&!active.popup.contains(event.target))closeSelect();},true);
  window.addEventListener('resize',positionPopup);
  window.addEventListener('scroll',event=>{if(active&&!active.popup.contains(event.target))closeSelect();},true);
}
