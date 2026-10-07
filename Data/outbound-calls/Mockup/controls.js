(() => {
  const {esc,icon}=window.UI;
  let active=null,serial=0,frame=0;
  const pairs=new WeakMap();
  const labelFor=el=>el.getAttribute('aria-label')||el.closest('.field')?.querySelector('label')?.textContent||el.closest('label')?.querySelector('span')?.textContent||'Choose an option';
  function sync(select,trigger){
    trigger.disabled=select.disabled;
    const text=select.selectedOptions[0]?.textContent||'Choose an option';
    if(trigger.querySelector('.select-value').textContent!==text)trigger.querySelector('.select-value').textContent=text;
    trigger.setAttribute('aria-label',labelFor(select)+': '+text);
    trigger.setAttribute('aria-invalid',select.getAttribute('aria-invalid')||'false');
  }
  function enhance(){
    if(active&&!active.select.isConnected)close(false);
    document.querySelectorAll('#app select,#overlay-root select').forEach(select=>{
      if(pairs.has(select)){sync(select,pairs.get(select));return;}
      const label=labelFor(select),field=select.closest('.field'),id=select.id||'choice-'+(++serial);
      select.id=id;select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
      const trigger=document.createElement('button');trigger.type='button';trigger.id=id+'-control';trigger.className='select-control '+(field?'select-field':'select-compact');
      trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',id+'-options');
      trigger.innerHTML=(field?'<span class="select-label">'+esc(label)+'</span>':'')+'<span class="select-value"></span>'+icon('ChevronDown');
      select.after(trigger);if(field){field.classList.add('select-field-wrap');const l=field.querySelector('label');if(l)l.htmlFor=trigger.id;}
      pairs.set(select,trigger);sync(select,trigger);
      trigger.addEventListener('click',()=>active?.select===select?close():open(select,trigger));
      trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open(select,trigger);}});
    });
    if(document.body.classList.contains('admin-preview'))return;
    document.querySelectorAll('.field').forEach(field=>{
      const input=field.querySelector(':scope > input:not([type=file]):not([type=checkbox]):not([type=radio]),:scope > textarea'),label=field.querySelector(':scope > label');
      if(!input||!label)return;
      const box=document.createElement('div');box.className='floating-surface';
      input.before(box);box.append(input,label);if(!input.placeholder)input.placeholder=' ';
      if(!input.id)input.id='entry-'+(++serial);label.htmlFor=input.id;
      const help=field.querySelector('small');if(help){help.id=input.id+'-hint';input.setAttribute('aria-describedby',help.id);}
    });
  }
  function close(restore=true){
    if(!active)return;
    const {trigger,root,overflow}=active;active=null;cancelAnimationFrame(frame);root.remove();trigger.setAttribute('aria-expanded','false');
    if(overflow!==null)document.body.style.overflow=overflow;
    if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});
  }
  function paint(){
    const a=active;if(!a)return;
    const term=a.search?.value.trim().toLowerCase()||'';
    a.rows=[...a.select.options].filter(o=>!o.hidden&&o.textContent.toLowerCase().includes(term));
    a.index=Math.max(0,Math.min(a.index,a.rows.length-1));
    a.list.innerHTML=a.rows.map((o,i)=>'<button type="button" role="option" id="'+a.select.id+'-option-'+i+'" aria-selected="'+o.selected+'" '+(o.disabled?'disabled':'')+' class="select-option '+(i===a.index?'active':'')+'" data-option="'+i+'"><span>'+esc(o.textContent)+'</span>'+(o.selected?icon('Check'):'')+'</button>').join('')||'<p class="select-empty" role="status">No matching options</p>';
    if(a.search){if(a.rows[a.index])a.search.setAttribute('aria-activedescendant',a.select.id+'-option-'+a.index);else a.search.removeAttribute('aria-activedescendant');}
  }
  function pick(index){
    const a=active,o=a?.rows[index];if(!o||o.disabled)return;
    const id=a.trigger.id;a.select.value=o.value;sync(a.select,a.trigger);close();
    a.select.dispatchEvent(new Event('change',{bubbles:true}));
    queueMicrotask(()=>{enhance();document.getElementById(id)?.focus({preventScroll:true});});
  }
  function place(){
    if(!active)return;
    const a=active;
    if(!a.trigger.isConnected){close(false);return;}
    if(!a.mobile){const r=a.trigger.getBoundingClientRect(),v=window.visualViewport,h=v?.height||innerHeight,w=v?.width||innerWidth,oy=v?.offsetTop||0;
      const width=Math.min(Math.max(r.width,230),w-24),below=h+oy-r.bottom-12,above=r.top-oy-12,up=below<270&&above>below,space=Math.max(120,up?above:below);
      Object.assign(a.panel.style,{left:Math.max(12,Math.min(r.left,w-width-12))+'px',width:width+'px',maxHeight:Math.min(360,space)+'px',top:up?'auto':Math.max(oy+12,r.bottom+4)+'px',bottom:up?Math.max(12,innerHeight-r.top+4)+'px':'auto'});
    }else{const v=window.visualViewport;if(v){a.root.style.height=v.height+'px';a.root.style.top=v.offsetTop+'px';a.root.style.bottom='auto';}}
    frame=requestAnimationFrame(place);
  }
  function open(select,trigger){
    if(select.disabled)return;close(false);
    const mobile=document.body.classList.contains('native'),label=labelFor(select),root=document.createElement('div');root.className='select-layer'+(mobile?' select-sheet':'');
    root.innerHTML='<section class="select-panel" '+(mobile?'role="dialog" aria-modal="true" aria-label="'+esc(label)+'"':'')+'>'+(mobile?'<header><h2>'+esc(label)+'</h2><button type="button" class="icon-button" aria-label="Close choices" data-choice-close>'+icon('X')+'</button></header>':'')+(select.options.length?'<div class="select-search-wrap">'+icon('Search')+'<input type="search" class="select-search" placeholder="Search" aria-label="Search '+esc(label)+'" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="'+select.id+'-options"></div>':'')+'<div class="select-options" role="listbox" id="'+select.id+'-options" aria-label="'+esc(label)+'"></div></section>';
    (document.fullscreenElement||document.body).append(root);
    active={select,trigger,root,mobile,panel:root.querySelector('.select-panel'),list:root.querySelector('.select-options'),search:root.querySelector('.select-search'),index:Math.max(0,select.selectedIndex),overflow:mobile?document.body.style.overflow:null};
    if(mobile)document.body.style.overflow='hidden';trigger.setAttribute('aria-expanded','true');
    root.addEventListener('pointerdown',e=>e.stopPropagation());
    root.addEventListener('click',e=>{e.stopPropagation();if(e.target.closest('[data-choice-close]')||e.target===root){close();return;}const o=e.target.closest('[data-option]');if(o)pick(+o.dataset.option);});
    active.search?.addEventListener('input',e=>{e.stopPropagation();active.index=0;paint();});
    paint();place();if(!mobile)active.search?.focus({preventScroll:true});else root.querySelector('[data-choice-close]')?.focus({preventScroll:true});
  }
  document.addEventListener('pointerdown',e=>{if(active&&!active.root.contains(e.target)&&!active.trigger.contains(e.target))close(false);},true);
  document.addEventListener('keydown',e=>{
    if(!active)return;
    const a=active;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
    if(e.key==='Tab'){
      if(!a.mobile){e.preventDefault();e.stopImmediatePropagation();const trigger=a.trigger;close();const nodes=[...document.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(x=>x.getClientRects().length);nodes[nodes.indexOf(trigger)+(e.shiftKey?-1:1)]?.focus();return;}
      const nodes=[...a.root.querySelectorAll('button:not(:disabled),input')],i=nodes.indexOf(document.activeElement);if(e.shiftKey&&i===0||!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[e.shiftKey?nodes.length-1:0]?.focus();}e.stopImmediatePropagation();return;
    }
    if(!a.root.contains(e.target)&&e.target!==a.trigger)return;
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&a.rows.length){e.preventDefault();e.stopImmediatePropagation();a.index=e.key==='Home'?0:e.key==='End'?a.rows.length-1:(a.index+(e.key==='ArrowDown'?1:-1)+a.rows.length)%a.rows.length;paint();a.list.querySelector('.active')?.scrollIntoView({block:'nearest'});}
    if(e.key==='Enter'&&e.target===a.search){e.preventDefault();e.stopImmediatePropagation();pick(a.index);}
  },true);
  new MutationObserver(enhance).observe(document.getElementById('app'),{childList:true,subtree:true});
  new MutationObserver(enhance).observe(document.getElementById('overlay-root'),{childList:true,subtree:true});
  window.FormControls={enhance,close,sync:()=>document.querySelectorAll('select').forEach(s=>{if(pairs.has(s))sync(s,pairs.get(s));})};
})();
