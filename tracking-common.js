// TEST only. Tracking links remain private bearer tokens saved on this device.
(function(){
  'use strict';
  const KEY='dsc-test-orders-v1';
  const DAY=24*60*60*1000;
  const tokenPattern=/^[a-f0-9]{64}$/;
  let checking=false;
  let lastCheck=0;
  let statusMessage='';
  function list(){
    try {const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&tokenPattern.test(x.token)).slice(0,30):[];}
    catch{return [];}
  }
  function persist(items){try{localStorage.setItem(KEY,JSON.stringify(items));}catch{}}
  function makeUrl(token){return new URL('track.html#token='+encodeURIComponent(token),location.href).href;}
  function saveOrder(o){
    if(!o||!tokenPattern.test(o.token))return;
    persist([o,...list().filter(x=>x.token!==o.token)].slice(0,30));
    render();
  }
  function canArchive(o){
    const status=o.status, refund=o.refund;
    const done=status==='Completed'||status==='Declined'||status==='Cancelled';
    if(!done)return false;
    if((status==='Cancelled'||status==='Declined')&&o.payment_status==='Paid'&&(!refund||refund.status!=='Refunded'))return false;
    if(refund&&refund.status!=='Refunded')return false;
    const when=(refund&&refund.status==='Refunded'&&refund.refunded_at)||o.updated_at;
    const stamp=Date.parse(when||'');
    return Number.isFinite(stamp)&&Date.now()-stamp>=DAY;
  }
  function render(){
    const el=document.getElementById('myOrdersList');if(!el)return;
    const a=list(),count=document.getElementById('savedOrdersCount');
    if(count)count.textContent=a.length?'('+a.length+')':'';
    el.replaceChildren();
    if(statusMessage){const p=document.createElement('p');p.className='my-orders-note';p.textContent=statusMessage;el.append(p);}
    if(!a.length){const p=document.createElement('p');p.textContent='No active saved orders on this device.';el.append(p);return;}
    for(const o of a){
      const d=document.createElement('div');d.className='saved-order';
      const b=document.createElement('strong');b.textContent=o.order_number||'Order';
      const link=document.createElement('a');link.href=makeUrl(o.token);link.textContent='TRACK ORDER ↗';
      d.append(b,link);el.append(d);
    }
  }
  async function sync(){
    if(checking||Date.now()-lastCheck<60000)return;
    const saved=list();if(!saved.length)return;
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(window.DS_SUPABASE_URL||''))return;
    checking=true;lastCheck=Date.now();statusMessage='Checking order statuses…';render();
    try{
      const response=await fetch(window.DS_SUPABASE_URL+'/functions/v1/track-order',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tokens:saved.map(o=>o.token)}),cache:'no-store'
      });
      const result=await response.json();
      if(!response.ok||!Array.isArray(result.orders))throw new Error(result.error||'Status check unavailable');
      const byIndex=new Map(result.orders.filter(x=>Number.isInteger(x.index)&&x.index>=0&&x.index<saved.length).map(x=>[x.index,x]));
      const removed=new Set();
      for(let i=0;i<saved.length;i++)if(byIndex.has(i)&&canArchive(byIndex.get(i)))removed.add(saved[i].token);
      // Merge against current storage, so orders placed during the request are not lost.
      if(removed.size)persist(list().filter(o=>!removed.has(o.token)));
      statusMessage=removed.size?`${removed.size} settled order${removed.size===1?'':'s'} archived from this device.`:'';
    }catch(e){statusMessage='Could not check statuses right now. Saved tracking links were kept.';}
    finally{checking=false;render();}
  }
  window.DS_TRACKING={list,makeUrl,saveOrder};
  document.addEventListener('DOMContentLoaded',()=>{
    render();const modal=document.getElementById('myOrdersModal');
    document.getElementById('myOrdersBtn')?.addEventListener('click',()=>{
      render();modal.classList.add('open');modal.setAttribute('aria-hidden','false');sync();
    });
    document.querySelectorAll('[data-my-orders-close]').forEach(e=>e.addEventListener('click',()=>{
      modal.classList.remove('open');modal.setAttribute('aria-hidden','true');
    }));
  });
})();
