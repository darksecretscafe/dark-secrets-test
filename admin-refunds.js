'use strict';
(() => {
 const $ = id => document.getElementById(id);
 const db = window.DS_adminDb;
 const list=$('refundList'), message=$('refundMessage'), refresh=$('refundRefresh'), badge=$('tabRefundCount');
 if(!db||!list||!message||!refresh||!badge) return;
 const node=(tag,value,cls)=>{
  const e=document.createElement(tag);
  if(value!==undefined&&value!==null)e.textContent=String(value);
  if(cls)e.className=cls;
  return e;
 };
 const pesos=n=>'₱'+Number(n).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const mask=n=>typeof n==='string'&&n.length>=4 ? n.slice(0,2)+'•••••••'+n.slice(-2) : 'Unavailable';
 const validAmount=n=>n!==null&&n!==undefined&&Number.isFinite(Number(n))&&Number(n)>0;
 let busy=false, records=[], expanded=null, lastLoad=0;
 const drafts=new Map();
 let lastSnapshot=null;
 const draftFor=id=>{if(!drafts.has(id))drafts.set(id,{reference:'',confirmed:false,authorized:false});return drafts.get(id);};
 const active=()=>!$('dashboard').hidden;
 const show=(s)=>{message.textContent=s;};
 const add=(parent,tag,value,cls)=>{const e=node(tag,value,cls);parent.append(e);return e;};
 function button(label,fn,cls){
  const b=node('button',label,cls);b.type='button';b.onclick=fn;return b;
 }
 async function load(force=false){
  if(busy||!active()||(!force&&Date.now()-lastLoad<12000))return;
  busy=true;refresh.disabled=true;show('Loading refunds…');
  try{
   const {data:isAdmin,error:adminError}=await db.rpc('is_admin');
   if(adminError||isAdmin!==true)throw new Error('Admin access required.');
   const {data,error}=await db.from('order_cancellation_requests')
    .select('id,order_id,request_status,refund_status,refund_amount,refund_reference,refund_method,refund_account_name,refund_mobile,refund_destination_type,refund_destination_verified_at,refund_destination_verified_by,refunded_at,requested_at,orders(order_number,status,payment_status,payment_method,final_total)')
    .eq('request_status','Approved')
    .in('refund_status',['Refund Required','Processing','Refunded'])
    .order('requested_at',{ascending:false}).limit(100);
   if(error)throw error;
   const nextRecords=data||[];
   const snapshot=JSON.stringify(nextRecords);
   const changed=snapshot!==lastSnapshot;
   records=nextRecords;
   lastSnapshot=snapshot;
   const liveIds=new Set(records.filter(r=>r.refund_status!=='Refunded').map(r=>r.id));
   for(const id of drafts.keys())if(!liveIds.has(id))drafts.delete(id);
   const outstanding=records.filter(r=>r.refund_status!=='Refunded').length;
   badge.textContent=outstanding?String(outstanding):'';
   badge.hidden=!outstanding;
   if(changed)render();
   lastLoad=Date.now();
   show(`${outstanding} outstanding refund${outstanding===1?'':'s'} · ${records.length} records shown.`);
  }catch(e){show('Unable to load refunds: '+e.message);list.replaceChildren();badge.hidden=true;}
  finally{busy=false;refresh.disabled=false;}
 }
 async function action(r,kind,reference){
  if(busy)return;
  const rpc=kind==='verify'?'admin_verify_refund_destination':kind==='start'?'admin_start_refund':'admin_complete_refund';
  const args=kind==='verify'?{p_request_id:r.id,p_original_payer_authorized:r.refund_destination_type==='Different'}:
    kind==='start'?{p_request_id:r.id}:{p_request_id:r.id,p_refund_reference:reference};
  busy=true;refresh.disabled=true;show('Saving refund update…');
  try{
   const {error}=await db.rpc(rpc,args);
   if(error)throw error;
   busy=false;
   await load(true);
  }catch(e){show('Refund action failed: '+e.message);}
  finally{busy=false;refresh.disabled=false;}
 }
 function detail(r,card){
  const panel=node('div',null,'ds-refund-details');panel.hidden=expanded!==r.id;card.append(panel);
  const draft=draftFor(r.id);
  add(panel,'p','Account holder: '+(r.refund_account_name||'Unavailable'));
  add(panel,'p','GCash/Maya mobile: '+(r.refund_mobile||'Unavailable'));
  add(panel,'p','Destination: '+(r.refund_destination_type||'Unavailable'));
  add(panel,'p','Method: '+(r.refund_method||'Unavailable'));
  add(panel,'p','Verification: '+(r.refund_destination_verified_at?'Verified':'Not verified'));
  if(r.refund_status==='Refunded'){
   add(panel,'p','Refund reference: '+(r.refund_reference||'Unavailable'));
   add(panel,'p','Refunded at: '+(r.refunded_at?new Date(r.refunded_at).toLocaleString('en-PH'):'Unavailable'));
  }
  const o=r.orders||{};
  const amountOK=validAmount(r.refund_amount)&&Number(r.refund_amount)===Number(o.final_total);
  if(!amountOK)add(panel,'p','Warning: refund amount does not match the order final total.','ds-refund-warning');
  if(r.refund_status==='Refund Required'&&!r.refund_destination_verified_at){
   if(r.refund_destination_type==='Different'){
    const label=node('label',null,'ds-refund-field');
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=draft.authorized;
    label.classList.add('ds-refund-check');
    label.append(cb,node('span','I verified authorization from the original payer to refund this different account.'));
    panel.append(label);
    const b=button('Verify refund destination',()=>{
     if(!cb.checked)return;
     if(!window.confirm(`Confirm original payer authorization and verify ${r.refund_method} recipient ${r.refund_account_name} (${r.refund_mobile}) for ${o.order_number}?`))return;
     action(r,'verify');
    });
    cb.onchange=()=>{draft.authorized=cb.checked;b.disabled=!cb.checked||!amountOK;};
    b.disabled=!cb.checked||!amountOK;panel.append(b);
   }else{
    const b=button('Verify refund destination',()=>{
     if(!window.confirm(`I independently checked the original ${r.refund_method} refund recipient ${r.refund_account_name} (${r.refund_mobile}) for ${o.order_number}. Confirm verification?`))return;
     action(r,'verify');
    });b.disabled=!amountOK;panel.append(b);
   }
  }else if(r.refund_status==='Refund Required'&&r.refund_destination_verified_at){
   const b=button('Start processing',()=>{
    if(!window.confirm(`Start manual refund processing for ${o.order_number} (${pesos(r.refund_amount)})? This does not transfer money.`))return;
    action(r,'start');
   });b.disabled=!amountOK;panel.append(b);
  }else if(r.refund_status==='Processing'){
   add(panel,'p','Only mark Refunded after checking actual successful payment-provider transfer confirmation.','ds-refund-warning');
   const label=node('label',null,'ds-refund-field');
   label.append(node('span','Confirmed transfer reference'));
   const input=document.createElement('input');input.type='text';input.maxLength=100;input.placeholder='GCash / Maya transaction reference';input.value=draft.reference;input.addEventListener('input',()=>{draft.reference=input.value;});label.append(input);panel.append(label);
   const confirmation=node('label',null,'ds-refund-field ds-refund-check');
   const cb=document.createElement('input');cb.type='checkbox';cb.checked=draft.confirmed;cb.addEventListener('change',()=>{draft.confirmed=cb.checked;});
   confirmation.append(cb,node('span','I checked that the full refund transfer succeeded.'));
   panel.append(confirmation);
   const b=button('Mark Refunded',()=>{
    const ref=input.value.trim();
    if(ref.length<4||ref.length>100||!/^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(ref)){
     show('Enter a valid refund reference (4–100 characters).');return;
    }
    if(!cb.checked)return;
    if(!window.confirm(`FINALIZE refund for ${o.order_number}, ${pesos(r.refund_amount)}? Only confirm if the actual transfer succeeded.`))return;
    action(r,'complete',ref);
   });
   b.disabled=!amountOK;
   panel.append(b);
  }
 }
 function render(){
  list.replaceChildren();
  if(!records.length){add(list,'p','No approved paid cancellations yet.');return;}
  for(const r of records){
   const o=r.orders||{}, card=node('article',null,'ds-refund-card');
   const head=node('div',null,'ds-refund-head');
   add(head,'h3',o.order_number||'Order');
   add(head,'span',r.refund_status,'ds-refund-pill');
   card.append(head);
   add(card,'div',pesos(r.refund_amount),'ds-refund-amount');
   add(card,'p',`${r.refund_method||'Unknown method'} · ${r.refund_destination_type||'Unknown destination'} · ${mask(r.refund_mobile)}`,'ds-refund-meta');
   add(card,'p',r.refund_destination_verified_at?'Recipient verified':'Recipient verification required','ds-refund-meta');
   const actions=node('div',null,'ds-refund-actions');
   const b=button(expanded===r.id?'Hide details':'Manage Refund',()=>{
    expanded=expanded===r.id?null:r.id;render();
   },'secondary');
   actions.append(b);card.append(actions);
   detail(r,card);list.append(card);
  }
 }
 refresh.onclick=()=>load(true);
 $('tabRefunds')?.addEventListener('click',()=>load(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active()&&!$('panelRefunds').hidden)load(true);});
 $('loginForm')?.addEventListener('submit',()=>setTimeout(()=>load(true),1600));
 $('signout')?.addEventListener('click',()=>{records=[];expanded=null;drafts.clear();lastSnapshot=null;list.replaceChildren();badge.hidden=true;show('Sign in to view refunds.');});
 setInterval(()=>{if(!document.hidden&&active()&&!$('panelRefunds').hidden)load();},20000);
 setTimeout(()=>{if(active())load(true);},1300);
})();
