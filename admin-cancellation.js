'use strict';
(() => {
 const db = window.DS_adminDb;
 const section = document.getElementById('cancellationManagement');
 const list = document.getElementById('cancellationList');
 const status = document.getElementById('cancellationMessage');
 const count = document.getElementById('cancellationCount');
 const refreshButton = document.getElementById('cancellationRefresh');
 if (!db || !section || !list || !status || !count || !refreshButton) return;
 const el = (tag, content, className) => { const node=document.createElement(tag);node.textContent=String(content??'');if(className)node.className=className;return node; };
 let busy = false;
 let requests = [];
 async function load() {
  if(busy || document.getElementById('dashboard').hidden) return;
  busy=true;refreshButton.disabled=true;status.textContent='Loading cancellation requests…';
  try {
   const {data:admin,error:adminError}=await db.rpc('is_admin');
   if(adminError || admin!==true) throw new Error('Admin access required.');
   const {data,error}=await db.from('order_cancellation_requests')
    .select('id,order_id,reason,request_status,refund_status,requested_at,reviewed_at,orders(order_number,status,payment_status)')
    .order('requested_at',{ascending:false}).limit(100);
   if(error) throw error;
   requests=data||[];
   render();
   status.textContent=`Showing ${requests.length} recent cancellation requests.`;
  } catch(e) {status.textContent='Unable to load requests: '+e.message+' (check admin SELECT RLS policy)';list.replaceChildren();count.textContent='—';}
  finally {busy=false;refreshButton.disabled=false;}
 }
 function render(){
  list.replaceChildren();count.textContent=requests.filter(r=>r.request_status==='Requested').length;
  if(!requests.length){list.append(el('p','No cancellation requests yet.'));return;}
  for(const r of requests){
   const o=r.orders||{};
   const card=el('article','', 'ordercard');card.style.marginTop='12px';
   card.append(el('h3',`${o.order_number||'Order'} · ${r.request_status}`));
   card.append(el('p',`Order: ${o.status||'Unknown'} · Payment: ${o.payment_status||'Unknown'}`));
   card.append(el('p',`Reason: ${r.reason}`));
   card.append(el('p',`Requested: ${new Date(r.requested_at).toLocaleString('en-PH')}`));
   if(r.request_status==='Requested'){
    const actions=el('div','','actions');
    for(const decision of ['Approved','Rejected']){
     const button=el('button',decision==='Approved'?'Approve cancellation':'Reject request',decision==='Rejected'?'secondary':'');
     button.type='button';
     button.onclick=()=>review(r,decision,button);
     actions.append(button);
    }
    if(o.payment_status==='Paid')card.append(el('p','Paid order: approval requires the separate refund workflow. You may reject the request.'));
    card.append(actions);
   } else card.append(el('p',`Refund: ${r.refund_status}`));
   list.append(card);
  }
 }
 async function review(r,decision,button){
  const o=r.orders||{};
  if(decision==='Approved' && o.payment_status==='Paid') {status.textContent='Paid order: refund workflow must be implemented before approval.';return;}
  if(!window.confirm(`${decision==='Approved'?'APPROVE cancellation':'REJECT cancellation request'} for ${o.order_number||'this order'}?`))return;
  button.disabled=true;status.textContent='Saving decision…';
  const {data,error}=await db.rpc('admin_review_cancellation',{p_request_id:r.id,p_decision:decision});
  if(error){status.textContent='Decision failed: '+error.message;button.disabled=false;return;}
  status.textContent='Decision saved: '+data;
  await load();
  document.getElementById('refresh')?.click();
 }
 refreshButton.addEventListener('click',load);
 // The existing dashboard owns sign-in. Poll only while it is visible.
 const timer=setInterval(()=>{if(!document.hidden && !document.getElementById('dashboard').hidden)load();},15000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 document.getElementById('loginForm')?.addEventListener('submit',()=>setTimeout(load,1500));
 document.getElementById('signout')?.addEventListener('click',()=>{requests=[];list.replaceChildren();count.textContent='0';status.textContent='Sign in to view requests.';});
 setTimeout(load,1000);
})();
