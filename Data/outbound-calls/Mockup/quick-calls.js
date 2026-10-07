(() => {
  const {M,S,esc,cap,btn,chip,card,head,field,select,area,check,def,notice,avatar,icon}=window.UI;
  const limit=10,pageSize=5,clock=Date.parse('2026-10-04T15:00:00Z'),businessZone='America/Toronto';
  const zones={Toronto:businessZone,Vancouver:'America/Vancouver',Montreal:'America/Toronto',Halifax:'America/Halifax','New York':'America/New_York',Mumbai:'Asia/Kolkata'};
  const formats=new Map(),requests=[];
  let api,draft=null,active=false,view='edit',dirty=false,reviewRows=[],sequence=0,scenario='',showcaseKey='',receipt=[];
  const contactKey=c=>c.quickId||'contact-'+M.contacts.indexOf(c);
  const person=id=>M.contacts.find(c=>contactKey(c)===id);
  const phone=c=>window.RecordUX.phone(c?.phone);
  const canCall=()=>cap('read')&&cap('call');
  function seed(){
    if(M.contacts.some(c=>c.quickId))return;
    [['Ava Turner','Vancouver'],['Leo Bennett','Toronto'],['Isabella Roy','Montreal'],['Ethan Scott','Toronto'],['Chloe Lee','Vancouver'],['Lucas Fraser','Halifax'],['Amelia Clark','Toronto'],['Jack Davis','Toronto']].forEach(([name,zone],i)=>M.contacts.push({quickId:'sample-'+i,name,initials:name.split(' ').map(x=>x[0]).join(''),phone:'+1 (416) 555-01'+String(20+i),country:'Canada',zone,timeBasis:'reviewed-contact',status:'Ready to call',tone:'green',source:'Customer permission link',date:'1 Oct 2026',color:i%2?'blue':'sage',email:'sample'+i+'@example.com'}));
  }
  function parts(time,zone){
    if(!formats.has(zone))formats.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
    return Object.fromEntries(formats.get(zone).formatToParts(new Date(time)).map(x=>[x.type,x.value]));
  }
  function wall(date,time,zone){
    const target=Date.parse(date+'T'+time+':00Z');if(!Number.isFinite(target))return [];
    let value=target;
    for(let i=0;i<3;i++){const p=parts(value,zone);value+=target-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);}
    return [...new Set([value-3600000,value,value+3600000])].filter(t=>{const p=parts(t,zone);return `${p.year}-${p.month}-${p.day}`===date&&`${p.hour}:${p.minute}`===time;});
  }
  function label(time,zone){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(time));}
  function nextWindow(start,c){
    const zone=zones[c.zone];if(!zone)return null;
    const p=parts(start,zone),day=Date.parse(`${p.year}-${p.month}-${p.day}T12:00:00Z`),hours=S.callingSettings?.hours||['09:00','19:00','10:00','16:00'];
    for(let i=0;i<8;i++){
      const date=new Date(day+i*86400000),weekday=date.getUTCDay();if(!weekday)continue;
      const index=weekday===6?2:0,opening=[hours[index],weekday===6?'10:00':'09:00'].sort().at(-1),closing=[hours[index+1],weekday===6?'16:00':'19:00',S.callingSettings?.businessHours?(weekday===6?'14:00':'17:00'):'23:59'].sort()[0];
      if(opening>=closing)continue;
      const iso=date.toISOString().slice(0,10),from=wall(iso,opening,zone)[0],to=wall(iso,closing,zone)[0],candidate=Math.max(start,from);
      if(candidate<to&&candidate<=start+7*86400000)return candidate;
    }
    return null;
  }
  function reason(c,seen=new Set(),purpose=draft?.purpose,ignoreKey=''){
    if(!c||c.deleted)return 'Contact no longer available';
    if(!window.RecordUX.validPhone(c.phone))return 'Check the phone number';
    if(seen.has(phone(c)))return 'Same number already selected';seen.add(phone(c));
    if(c.status==='Do not call'||window.RecordUX.blocked(c))return 'Do not call';
    if(c.country==='India')return purpose==='promotional'?'Promotional calls unavailable':'Caller number declaration required';
    if(purpose==='promotional'&&(c.consentExpired||c.status!=='Ready to call'))return c.consentExpired?'Calling permission expired':'Calling permission needed';
    if(purpose==='service'&&c.country==='United States'&&S.serviceEvidence?.phone!==phone(c))return 'Confirm the service relationship';
    if(!zones[c.zone]||!window.AudienceUX.known(c))return 'Confirm the local time';
    if(['minutes','limit','admin-hold'].includes(S.state))return {minutes:'No outbound minutes available',limit:'Daily calling limit reached','admin-hold':'Assistant is on hold'}[S.state];
    if(draft?.booking&&['cancelled','expired'].includes(S.state))return 'Booking no longer eligible';
    if(requests.some(r=>r.key!==ignoreKey&&['Scheduled','Checking request'].includes(r.status)&&window.RecordUX.phone(r.phone)===phone(c)))return 'A call request already exists for this number';
    return '';
  }
  function rows(){
    const seen=new Set(),start=draft.when==='later'?wall(draft.date,draft.time,businessZone)[0]:clock;
    return draft.ids.map(id=>{const c=person(id),why=reason(c,seen),at=!why?nextWindow(start,c):null;return {id,name:c?.name||'Removed contact',phone:c?.phone||'',zone:c?.zone||'',reason:why||(!at?'No calling window before expiry':draft.booking&&at>=Date.parse('2026-10-06T14:00:00Z')?'Call would start after this booking':''),at,key:phone(c)};});
  }
  function capture(){
    if(!draft||view!=='edit')return;
    for(const key of ['purpose','goal','language','when','date','time']){const el=document.getElementById('quick-'+key);if(el)draft[key]=el.value;}
    const follow=document.querySelector('[name="quick-followup"]');if(follow)draft.followup=follow.checked;
  }
  function open(ids,booking=false){
    seed();if(!canCall()){api.modal('Calling access required','<p class="caption">Ask your business owner for permission to request AI calls.</p>',btn('Close','close','','secondary'));return;}
    if(!draft){draft={ids:booking?['contact-0']:ids||(['contact','followups','providerbooking'].includes(S.screen)?[contactKey(M.contacts[S.contact])]:[]),purpose:'service',goal:booking?'Confirm the upcoming visit and ask about access instructions.':'',language:S.callingSettings?.language||'English',when:'next',date:'2026-10-06',time:'11:00',followup:true,booking,search:'',page:0,selectedOnly:false,submission:crypto.randomUUID()};dirty=false;}
    active=true;view='edit';draw();
  }
  function peopleList(){
    const q=draft.search.toLowerCase(),all=M.contacts.filter(c=>!c.deleted&&(!draft.selectedOnly||draft.ids.includes(contactKey(c)))&&[c.name,c.phone].some(x=>x.toLowerCase().includes(q)));
    const max=Math.max(1,Math.ceil(all.length/pageSize));draft.page=Math.min(draft.page,max-1);
    return all.slice(draft.page*pageSize,(draft.page+1)*pageSize).map(c=>{const id=contactKey(c),selected=draft.ids.includes(id);return `<label class="quick-person ${selected?'chosen':''}"><input type="checkbox" data-quick-person="${id}" ${selected?'checked':''} ${!selected&&draft.ids.length>=limit?'disabled':''}>${avatar(c,true)}<span><b>${esc(c.name)}</b><small>${esc(c.phone)} · ${esc(c.zone)}</small><small>${esc(reason(c)||'Ready for review')}</small></span></label>`;}).join('')+(!all.length?'<p class="caption quick-empty">No matching contacts. Change the search or view all contacts.</p>':'')+`<div class="audience-pagination"><span>${all.length?draft.page*pageSize+1:0}–${Math.min(all.length,(draft.page+1)*pageSize)} of ${all.length}</span><div>${btn('Previous','quick-prev','ChevronLeft','secondary sm',draft.page===0)}${btn('Next','quick-next','ChevronRight','secondary sm',draft.page>=max-1)}</div></div>`;
  }
  function picker(){
    if(draft.booking){const c=person(draft.ids[0]);return notice('Person from this booking',esc(c.name)+' · '+esc(c.phone)+'. This call stays linked to their visit.','blue','','CalendarDays');}
    return `<div class="quick-picker"><div class="flex-between"><h3>People to call</h3><strong id="quick-count">${draft.ids.length} / ${limit}</strong></div><p class="caption">One person or a small group. Each gets a separate call.</p><label class="searchbox quick-search">${icon('Search')}<input id="quick-search" type="search" value="${esc(draft.search)}" aria-label="Search contacts for calls" placeholder="Search name or phone"></label><div class="segmented">${btn('All contacts','quick-all','','',!draft.selectedOnly)}${btn('Selected ('+draft.ids.length+')','quick-selected','','',draft.selectedOnly)}</div><div id="quick-people">${peopleList()}</div><p class="small-help">Selection stays when you search or change pages. Maximum ${limit} per request in this preview.</p></div>`;
  }
  function draw(message=''){
    active=true;view='edit';
    api.modal('Call with AI',`${message?notice('Review your selection',esc(message),'amber'):''}<p class="quick-intro">A clear goal. One person or a few. No campaign setup.</p><div class="quick-grid">${picker()}<div class="quick-brief">${draft.booking?def('Purpose','Existing booking · service call'):select('Purpose','quick-purpose',[['service','About an existing service'],['promotional','An offer or new booking']],draft.purpose)}${area('What should the assistant achieve?','quick-goal',draft.goal,'These instructions apply to every selected person. Avoid private details about someone else.')}${select('Language','quick-language',['English','French','Spanish','Hindi','Punjabi','Gujarati'],draft.language)}${select('When','quick-when',[['next','Next permitted time'],['later','Schedule for later']],draft.when)}<div id="quick-schedule" ${draft.when==='later'?'':'hidden'}><div class="field-row">${field('Date · your Toronto time','quick-date',draft.date,'date')}${field('Time · your Toronto time','quick-time',draft.time,'time')}</div><p class="caption">One starting time for everyone. Review shows each person’s local time and any adjustment to allowed hours.</p></div>${check('Ask the team to follow up if needed','quick-followup',draft.followup,'No live transfer during an outgoing call.')}<details class="plain-details"><summary>Assistant and call limits</summary><p>Uses the current assistant’s knowledge, voice and permitted tools. Calls aim for 2 minutes and end by 5. Ordinary retries, stop requests, minutes and daily limits apply to each number. Requests expire within seven days, or sooner for a linked booking. No campaign is created.</p></details><p class="small-help">Preview clock: 4 Oct 2026, 11 am Toronto. No real calls are placed.</p></div></div>`,btn('Review '+(draft.ids.length===1?'call':draft.ids.length+' calls'),'quick-review','ArrowRight','',!draft.ids.length||!canCall()),true);
  }
  function validate(){
    if(!canCall()){api.fail('Your calling access has changed. No request was sent.');return false;}
    if(!draft.ids.length||draft.ids.length>limit){api.fail('Choose between 1 and '+limit+' people.');return false;}
    if(!draft.goal.trim()){api.fail('Add a clear goal for these calls.','quick-goal');return false;}
    if(draft.goal.length>1000){api.fail('Keep the goal within 1,000 characters in this preview.','quick-goal');return false;}
    if(draft.when==='later'){const times=wall(draft.date,draft.time,businessZone);if(times.length!==1){api.fail('Choose a clear Toronto date and time. This time is missing or repeats when the clocks change.','quick-time');return false;}if(times[0]<=clock){api.fail('Choose a time after the preview clock.','quick-time');return false;}}
    return true;
  }
  function review(){
    capture();if(!validate())return;view='review';reviewRows=rows();const ready=reviewRows.filter(x=>!x.reason),held=reviewRows.length-ready.length;
    api.modal('Review '+reviewRows.length+(reviewRows.length===1?' call':' calls'),notice(ready.length+' ready'+(held?' · '+held+' not requested':''),'Only the ready people below will be submitted. Nothing has been scheduled yet.','blue')+card('Conversation',`<p>${esc(draft.goal)}</p><div class="divider"></div>${def('Purpose',draft.purpose==='service'?'Existing service':'Promotional')}${def('Language',esc(draft.language))}${def('Caller ID','Willow Home Care · +1 (416) 555-0100')}${def('Call length','Aim for 2 minutes · end by 5')}${def('Team follow-up',draft.followup?'Allowed if needed':'Not requested')}${def('Earliest start',draft.when==='later'?esc(label(wall(draft.date,draft.time,businessZone)[0],businessZone)):'Next permitted time')}${def('Estimated talk time','About '+ready.length*2+' minutes')}<p class="small-help">Actual answered seconds, including voicemail, use your shared allowance. No simultaneous-call or exact start-time promise.</p>`)+`<div class="quick-review-list">${reviewRows.map(r=>`<div class="quick-review-row"><div><b>${esc(r.name)}</b><p>${esc(r.phone)}</p><p>${r.reason?esc(r.reason):esc(label(r.at,zones[r.zone]))+' · '+esc(r.zone)}</p>${!r.reason&&draft.when==='later'&&r.at!==wall(draft.date,draft.time,businessZone)[0]?'<small>Adjusted to this person’s next allowed hours.</small>':''}</div>${chip(r.reason?'Not requested':'Ready',r.reason?'amber':'green')}</div>`).join('')}</div><p class="section-note">Permission, original number, hours, minutes and limits are checked again before each call. A blocked person is not silently scheduled for later.</p>`,btn('Back to edit','quick-edit','ArrowLeft','secondary')+btn('Request '+ready.length+(ready.length===1?' call':' calls'),'quick-submit','PhoneOutgoing','',!ready.length||!canCall()),true);
  }
  function fingerprint(list){return JSON.stringify(list.map(r=>[r.id,r.phone,r.reason,r.at]));}
  function submit(){
    if(!draft||!canCall()){api.fail('Your calling access has changed or this selection was already submitted. No new request was sent.');return;}
    if(scenario==='quick-changed-number'){person(draft.ids[0]).phone='+1 (416) 555-0189';scenario='';}
    if(fingerprint(rows())!==fingerprint(reviewRows)){review();api.fail('A number, permission or calling time changed. Review the updated people before requesting calls.');return;}
    if(scenario==='quick-error'){scenario='';api.fail('The request was not saved. Your choices are kept; try Request calls again.');return;}
    const eligible=reviewRows.filter(r=>!r.reason);receipt=[];
    eligible.forEach((row,i)=>{const key=draft.submission+':'+row.key,prior=requests.find(r=>r.key===key);if(prior){receipt.push(prior);return;}
      const status=scenario==='quick-checking'?'Checking request':scenario==='quick-partial'&&i===1?'Not saved':scenario==='quick-partial'&&i===2?'Checking request':'Scheduled';
      const request={...row,contactId:row.id,id:'quick-'+(++sequence),key,status,goal:draft.goal,language:draft.language,purpose:draft.purpose,followup:draft.followup,booking:draft.booking,submission:draft.submission,history:[status==='Scheduled'?'Request saved; no call placed yet.':status==='Not saved'?'Request rejected before being saved.':'Awaiting confirmation; do not send another request.']};requests.unshift(request);receipt.push(request);
    });
    const omitted=reviewRows.filter(r=>r.reason);draft=null;dirty=false;active=false;scenario='';api.navigate('calls');receiptDialog(omitted);
  }
  const statusTone=r=>r.status==='Scheduled'||r.status==='Completed'?'green':r.status==='Cancelled'?'neutral':'amber';
  function requestRow(r){return `<div class="quick-review-row"><div><b>${esc(r.name)}</b><p>${esc(r.phone)}</p><p>${esc(r.at?label(r.at,zones[r.zone]):'Time to be confirmed')}</p>${chip(r.status,statusTone(r))}</div><div class="quick-row-actions">${btn('Details','quick-detail-'+r.id,'FileText','secondary sm')}${r.status==='Needs review'?'<span class="caption">Review the contact’s current number and permission before making a new request.</span>':r.status==='Not saved'?btn('Retry this request','quick-retry-'+r.id,'RefreshCw','secondary sm',!canCall()):r.status==='Checking request'?btn('Check status','quick-check-'+r.id,'RefreshCw','secondary sm',!cap('read')):r.status==='Scheduled'?btn('Cancel','quick-cancel-'+r.id,'X','secondary sm',!canCall()):''}</div></div>`;}
  function receiptDialog(omitted=[]){
    active=false;api.modal('Your call requests',notice(receipt.filter(r=>r.status==='Scheduled').length+' scheduled · '+receipt.filter(r=>['Not saved','Checking request'].includes(r.status)).length+' need attention','Each person has a separate request. No campaign was created. These are preview records, not real calls.','blue')+receipt.map(requestRow).join('')+(omitted.length?notice(omitted.length+' not requested',omitted.map(r=>esc(r.name)+': '+esc(r.reason)).join('<br>'),'amber'):'')+`<p class="section-note">A failed request can be retried on its own. If its status is uncertain, check it first; never resend the whole selection.</p>`,btn('View calls','quick-view-calls','ArrowRight'),true);
  }
  function details(r){
    active=false;api.modal(r.name+' · call request',def('Phone',esc(r.phone))+def('Status',r.status)+def('Goal',esc(r.goal))+def('Language',esc(r.language))+def('Purpose',r.purpose==='service'?'Existing service':'Promotional')+def('Requested local time',esc(label(r.at,zones[r.zone])))+def('Team follow-up',r.followup?'Allowed if needed':'Not requested')+def('Linked booking',r.booking?'Original customer and visit':'None')+def('Expires by',esc(label(Math.min(r.at+7*86400000,r.booking?Date.parse('2026-10-06T14:00:00Z'):Infinity),businessZone)))+(r.status==='Completed'?card('Summary','<p>The person confirmed that the recent visit went well. No new booking or handout was requested.</p>'):'<p class="section-note">No completed conversation, answer, recording or minute charge is implied by a saved request.</p>')+card('History',r.history.map(x=>'<p class="caption">'+esc(x)+'</p>').join('')),btn('Back to calls','quick-view-calls','ArrowLeft','secondary')+(r.status==='Scheduled'?btn('Cancel this request','quick-cancel-'+r.id,'X','secondary',!canCall()):''));
  }
  function list(){
    if(!requests.length)return '';const q=(S.quickRequestSearch||'').toLowerCase(),list=requests.filter(r=>(r.name+' '+r.phone+' '+r.status).toLowerCase().includes(q)),pages=Math.max(1,Math.ceil(list.length/10));S.quickRequestPage=Math.min(S.quickRequestPage||0,pages-1);
    return card('Individual call requests',`<p class="caption">Requested for one person or a small group. Every call is managed separately.</p><label class="searchbox quick-search">${icon('Search')}<input id="quick-request-search" type="search" aria-label="Search individual requests" placeholder="Name, phone or status" value="${esc(S.quickRequestSearch||'')}"></label><div id="quick-request-rows">${list.slice(S.quickRequestPage*10,S.quickRequestPage*10+10).map(requestRow).join('')||'<p class="caption">No matching requests.</p>'}</div><div class="audience-pagination"><span>${list.length} requests · page ${S.quickRequestPage+1} of ${pages}</span><div>${btn('Previous','quick-requests-prev','ChevronLeft','secondary sm',!S.quickRequestPage)}${btn('Next','quick-requests-next','ChevronRight','secondary sm',S.quickRequestPage>=pages-1)}</div></div>`,'','quick-requests');
  }
  function requestClose(){
    if(!active)return false;if(!draft){active=false;return false;}capture();if(!dirty){active=false;draft=null;return false;}
    api.modal('Discard this call setup?','<p class="caption">No calls have been requested. Keep editing to retain the people, goal and schedule.</p>',btn('Keep editing','quick-keep','','secondary')+btn('Discard setup','quick-discard','X','danger'));return true;
  }
  function changed(el){
    if(el.id==='quick-request-search'){if((S.quickRequestSearch||'')===el.value)return true;S.quickRequestSearch=el.value;S.quickRequestPage=0;const at=el.selectionStart;api.render();const next=document.getElementById('quick-request-search');next.focus();next.setSelectionRange(at,at);return true;}
    if(!draft||!active)return false;
    if(el.id==='quick-search'){if(draft.search===el.value)return true;draft.search=el.value;draft.page=0;document.getElementById('quick-people').innerHTML=peopleList();return true;}
    if(el.matches('[data-quick-person]')){const id=el.dataset.quickPerson;if(el.checked&&!draft.ids.includes(id)&&draft.ids.length<limit)draft.ids.push(id);else if(!el.checked)draft.ids=draft.ids.filter(x=>x!==id);dirty=true;capture();draw();document.querySelector('[data-quick-person="'+id+'"]')?.focus();return true;}
    if(el.id.startsWith('quick-')||el.name==='quick-followup'){capture();dirty=true;if(el.id==='quick-when')document.getElementById('quick-schedule').hidden=draft.when!=='later';if(el.id==='quick-purpose')draw();return true;}
    return false;
  }
  function handle(action){
    if(action==='call-sheet'){open(undefined,S.screen==='providerbooking');return true;}
    if(!action.startsWith('quick-'))return false;
    const match=action.match(/^quick-(detail|cancel|confirm-cancel|retry|check)-(.+)$/);
    if(match){const r=requests.find(x=>x.id===match[2]);if(!r)return true;const kind=match[1];if(kind==='detail'){details(r);return true;}if(kind==='check'?!cap('read'):!canCall()){api.fail('Your role cannot perform this request action.');return true;}
      if(kind==='cancel'&&r.status==='Scheduled')api.modal('Cancel the call to '+esc(r.name)+'?',`<p class="caption">Cancel only this person’s waiting request. The other selected people are unchanged.</p>`,btn('Keep request','quick-detail-'+r.id,'','secondary')+btn('Cancel request','quick-confirm-cancel-'+r.id,'X','danger'));
      if(kind==='confirm-cancel'&&r.status!=='Scheduled'){api.fail('This request is no longer waiting. Refresh its details before taking another action.');return true;}
      if(kind==='confirm-cancel'&&r.status==='Scheduled'){r.status='Cancelled';r.history.push('Jamie Carter cancelled this waiting request. Other requests were unchanged.');api.close();api.render();}
      if(['retry','check'].includes(kind)&&r.status===(kind==='retry'?'Not saved':'Checking request')){const c=person(r.contactId);if(!c||phone(c)!==window.RecordUX.phone(r.phone)||reason(c,new Set(),r.purpose,r.key)){r.status='Needs review';r.history.push('Current eligibility changed; no new request was made.');}else{r.status='Scheduled';r.history.push(kind==='retry'?'Only this unsuccessful request was retried, using its original request identity.':'The original request was found. No second request was created.');}api.close();api.render();}
      return true;
    }
    switch(action){
      case 'quick-review':review();break;
      case 'quick-edit':case 'quick-keep':draw();break;
      case 'quick-submit':submit();break;
      case 'quick-discard':draft=null;active=false;dirty=false;api.close();break;
      case 'quick-view-calls':active=false;api.navigate('calls');break;
      case 'quick-next':case 'quick-prev':capture();draft.page=Math.max(0,draft.page+(action==='quick-next'?1:-1));draw();break;
      case 'quick-selected':case 'quick-all':capture();draft.selectedOnly=action==='quick-selected';draft.page=0;draw();break;
      case 'quick-requests-next':case 'quick-requests-prev':S.quickRequestPage=Math.max(0,(S.quickRequestPage||0)+(action.endsWith('next')?1:-1));api.render();break;
      default:return false;
    }
    return true;
  }
  function showcase(){
    const key=S.screen+':'+S.state;if(key===showcaseKey)return;showcaseKey=key;
    if(S.screen!=='calls'||!S.state.startsWith('quick-'))return;
    seed();draft=null;active=false;dirty=false;scenario=S.state;
    if(!canCall())return;
    if(S.state==='quick-permission'){api.modal('Calling access required','<p class="caption">Your role can read calls but cannot request them. Ask your business owner for access.</p>',btn('Close','close','','secondary'));return;}
    if(S.state==='quick-loading'||S.state==='quick-offline'){api.modal(S.state==='quick-loading'?'Checking people and calling times':'You’re offline','<p class="caption">No call request has been sent. Your selection will remain available when the check finishes.</p>',btn('Back to setup','quick-keep','','secondary'));draft={ids:[],purpose:'service',goal:'',language:'English',when:'next',date:'2026-10-06',time:'11:00',followup:true,search:'',page:0,submission:crypto.randomUUID()};return;}
    const ids=S.state==='quick-single'?['contact-0']:S.state==='quick-mixed'?['contact-0','contact-2','contact-3','contact-5']:S.state==='quick-limit'?['contact-0','contact-1',...M.contacts.filter(c=>c.quickId).map(contactKey)]:S.state==='quick-empty'?[]:['contact-0','contact-1','sample-0','sample-1','sample-2'];
    if(S.state==='quick-duplicate'){M.contacts.push({...M.contacts[0],quickId:'sample-duplicate',name:'Emma · duplicate contact'});ids.splice(0,ids.length,'contact-0','sample-duplicate');}
    open(ids);draft.goal='Check whether the recent visit went well and record any follow-up needed.';draft.when='later';dirty=true;draw();
    if(['quick-review','quick-mixed','quick-partial','quick-checking','quick-error','quick-scheduled','quick-completed','quick-cancelled','quick-changed-number','quick-duplicate'].includes(S.state))review();
    if(['quick-partial','quick-checking','quick-scheduled','quick-completed','quick-cancelled'].includes(S.state)){const state=S.state;submit();if(state==='quick-completed'||state==='quick-cancelled'){receipt[0].status=state==='quick-completed'?'Completed':'Cancelled';receipt[0].history.push(state==='quick-completed'?'Example call completed; feedback confirmed.':'Waiting request cancelled.');api.close();api.render();details(receipt[0]);}}
  }
  const originalCalls=window.ScreenViews.calls,originalContacts=window.ScreenViews.contacts,originalContact=window.ScreenViews.contact;
  window.ScreenViews.contact=()=>originalContact()+ (requests.some(r=>r.contactId===contactKey(M.contacts[S.contact]))?card('Individual call requests',requests.filter(r=>r.contactId===contactKey(M.contacts[S.contact])).slice(0,10).map(requestRow).join('')+'<p class="small-help">Original numbers are retained after a contact changes. All requests remain searchable in Calls.</p>'):'');
  window.ScreenViews.calls=()=>originalCalls().replace('<div class="tabs"',list()+'<div class="tabs"');
  window.ScreenViews.contacts=()=>originalContacts().replace('<div class="heading-actions">','<div class="heading-actions">'+btn('Call with AI','call-sheet','PhoneOutgoing','secondary',!canCall()));
  window.QuickCalls={handle,changed,requestClose,showcase,requests,install:x=>api=x};
})();
