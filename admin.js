'use strict';
(() => {
 const $ = id => document.getElementById(id);
 const url = window.DS_SUPABASE_URL, key = window.DS_SUPABASE_KEY;
 const valid = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url || '') && key && !key.startsWith('PASTE_') && window.supabase;
 const msg = (s,err=false) => { $('message').textContent=s || ''; $('message').className=err?'error':''; };
 if (!valid) { $('setup').hidden=false; msg('Configuration required before signing in.'); return; }
 const db = window.supabase.createClient(url,key);
 let currentOrders=[];
 let pendingBaseline=null;
 const SOUND_KEY='ds-admin-sound-preference-v1';
 const ALARM_MAX_MS=120000, ALARM_REPEAT_MS=10000;
 let soundEnabled=localStorage.getItem(SOUND_KEY)==='on';
 let audioContext=null;
 let alarmTimer=null;
 // Only new orders observed while the dashboard is running trigger an alarm.
 // Track individual order expiry so one order cannot restart another's alarm.
 const activeAlarms=new Map();
 function updateSoundButton(){
  $('soundToggle').textContent=soundEnabled?'🔊 Sound on':'🔇 Enable sound';
  $('soundToggle').setAttribute('aria-pressed',String(soundEnabled));
 }
 updateSoundButton();
 async function activateAudio(){
  const AudioCtor=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtor)throw new Error('Audio is not supported by this browser.');
  audioContext=audioContext||new AudioCtor();
  await audioContext.resume();
  if(audioContext.state!=='running')throw new Error('Tap Enable sound to unlock audio on this device.');
 }
 function playOrderChime(){
  if(!soundEnabled || !audioContext || audioContext.state!=='running')return;
  try{
   const now=audioContext.currentTime;
   // Four distinct double-tone pulses (~3.7 seconds) for a restaurant-style alert.
   for(let n=0;n<4;n++)for(const [offset,freq] of [[0,740],[0.23,988]]){
    const delay=n*0.95+offset;
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();
    osc.type='triangle';osc.frequency.value=freq;
    gain.gain.setValueAtTime(0.0001,now+delay);
    gain.gain.exponentialRampToValueAtTime(0.10,now+delay+0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+delay+0.20);
    osc.connect(gain);gain.connect(audioContext.destination);
    osc.start(now+delay);osc.stop(now+delay+0.21);
   }
  }catch(e){console.warn('Order alert sound unavailable',e);}
 }
 function stopAlarmLoop(){if(alarmTimer){clearInterval(alarmTimer);alarmTimer=null;}}
 function alarmTick(){
  const now=Date.now();
  for(const [id,expires] of activeAlarms){
   if(expires<=now || !currentOrders.some(o=>o.id===id && o.status==='Pending'))activeAlarms.delete(id);
  }
  if(!activeAlarms.size || !soundEnabled){stopAlarmLoop();return;}
  if(!document.hidden)playOrderChime();
 }
 function ensureAlarmLoop(){
  if(!soundEnabled || !activeAlarms.size)return;
  if(!alarmTimer){alarmTick();alarmTimer=setInterval(alarmTick,ALARM_REPEAT_MS);}
 }
 function trackNewPending(orders){
  const ids=new Set(orders.filter(o=>o.status==='Pending').map(o=>o.id));
  for(const id of activeAlarms.keys())if(!ids.has(id))activeAlarms.delete(id);
  if(pendingBaseline!==null){
   const now=Date.now();
   for(const id of ids)if(!pendingBaseline.has(id))activeAlarms.set(id,now+ALARM_MAX_MS);
  }
  pendingBaseline=ids;
  if(!activeAlarms.size)stopAlarmLoop();else ensureAlarmLoop();
 }
 $('soundToggle').onclick=async()=>{
  if(soundEnabled){soundEnabled=false;localStorage.setItem(SOUND_KEY,'off');stopAlarmLoop();updateSoundButton();return;}
  try{
   await activateAudio();soundEnabled=true;localStorage.setItem(SOUND_KEY,'on');updateSoundButton();
   if(activeAlarms.size)ensureAlarmLoop();else playOrderChime();
  }catch(e){msg('Could not enable sound: '+e.message,true);}
 };
 // A saved preference cannot bypass Android's requirement for a user gesture
 // after some app launches. Show the preference; retry audio on user interaction.
 document.addEventListener('pointerdown',()=>{
  if(soundEnabled && audioContext?.state==='suspended')audioContext.resume().catch(()=>{});
 },{passive:true});
 let refreshInFlight=false;
 let pollTimer=null;
 const money=n=>'₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const text=(tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value==null?'':String(value);if(cls)el.className=cls;return el;};
 function show(auth){$('login').hidden=auth;$('dashboard').hidden=!auth;$('signout').hidden=!auth;}
 async function authorized(){
 const { data: { user }, error: userError } = await db.auth.getUser();
 if (userError || !user) return false;
 const { data: isAdmin, error: adminError } = await db.rpc('is_admin');
 if (adminError) {
    msg('Admin verification failed: ' + adminError.message, true);
    return false;
  }
 return isAdmin === true;
 }
 async function refresh(quiet=false){
  if(refreshInFlight)return;
  refreshInFlight=true;
  if(!quiet)msg('Loading orders…');$('refresh').disabled=true;
  const {data,error}=await db.from('orders').select('id,order_number,customer_name,customer_phone,delivery_address,landmark,gps_latitude,gps_longitude,notes,payment_method,total_amount,status,created_at,order_items(product_name,packaging,quantity,unit_price,subtotal)').order('created_at',{ascending:false}).limit(100);
  $('refresh').disabled=false;refreshInFlight=false;
  if(error){if(!quiet)msg('Could not load orders: '+error.message,true);return;}
  currentOrders=data||[];trackNewPending(currentOrders);render();if(!quiet)msg('Showing the 100 most recent orders.');
 }
 function renderPending(pending){
  $('pendingBadge').textContent=pending.length;
  $('pendingBell').setAttribute('aria-label',`${pending.length} pending orders. Open notifications`);
  const root=$('pendingNotificationList');root.replaceChildren();
  if(!pending.length){root.append(text('p','No pending orders right now.','pending-note'));return;}
  pending.forEach(o=>{
   const b=text('button',`${o.order_number} · Pending · ${new Date(o.created_at).toLocaleString('en-PH')}`,'pending-link');
   b.type='button';b.onclick=()=>{
    $('statusFilter').value='Pending';render();
    $('pendingNotifications').hidden=true;$('pendingBell').setAttribute('aria-expanded','false');
    const cards=Array.from(document.querySelectorAll('.ordercard'));
    const target=cards.find(c=>c.querySelector('h3')?.textContent===o.order_number);
    target?.scrollIntoView({behavior:'smooth',block:'center'});
   };root.append(b);
  });
 }
 function startPolling(){
  if(pollTimer)clearInterval(pollTimer);
  pollTimer=setInterval(()=>{if(!$('dashboard').hidden && !document.hidden)refresh(true);},15000);
 }
 function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
 function render(){
  const pending=currentOrders.filter(o=>o.status==='Pending');
  $('pendingCount').textContent=pending.length;
  renderPending(pending);
  $('progressCount').textContent=currentOrders.filter(o=>['Accepted','Preparing','Ready','Out for Delivery'].includes(o.status)).length;
  $('completedCount').textContent=currentOrders.filter(o=>o.status==='Completed').length;
  const root=$('orders');root.replaceChildren();const filter=$('statusFilter').value;
  const list=currentOrders.filter(o=>filter==='all'||o.status===filter);
  if(!list.length){root.append(text('div','No orders found. Orders are not being submitted by the website yet.','empty'));return;}
  list.forEach(o=>{
   const card=text('article','','ordercard'),head=text('div','','cardhead'),left=text('div');
   left.append(text('h3',o.order_number));left.append(text('div',new Date(o.created_at).toLocaleString('en-PH'),'meta'));
   head.append(left,text('span',o.status,'tag'));card.append(head);
   card.append(text('div',`${o.customer_name} · ${o.customer_phone}`,'meta'));
   card.append(text('div',`Delivery: ${o.delivery_address}${o.landmark?' · '+o.landmark:''}`,'meta'));
   if(Number.isFinite(o.gps_latitude)&&Number.isFinite(o.gps_longitude)){
     const a=text('a','View customer GPS pin');a.href=`https://www.google.com/maps?q=${encodeURIComponent(o.gps_latitude+','+o.gps_longitude)}`;a.target='_blank';a.rel='noopener noreferrer';card.append(a);
   }
   if(o.notes)card.append(text('div','Notes: '+o.notes,'meta'));
   card.append(text('div','Payment: '+o.payment_method,'meta'));
   const items=text('div','','items');(o.order_items||[]).forEach(i=>items.append(text('div',`${i.quantity} × ${i.product_name} (${i.packaging}) — ${money(i.subtotal)}`,'item')));card.append(items);
   const total=text('div','','total');total.append(text('span','Total'),text('span',money(o.total_amount)));card.append(total);
   const actions=text('div','','actions');
   const transitions={Pending:[['Accept','Accepted',''],['Decline','Declined','reject']],Accepted:[['Start preparing','Preparing','secondary']],Preparing:[['Mark ready','Ready','secondary']],Ready:[['Out for delivery','Out for Delivery','secondary']], 'Out for Delivery':[['Complete','Completed','']]};
   (transitions[o.status]||[]).forEach(([label,next,cls])=>{
    const b=text('button',label,cls);b.type='button';b.onclick=()=>changeStatus(o,next,b);actions.append(b);
   });card.append(actions);root.append(card);
  });
 }
 async function changeStatus(order,next,button){
  if(!confirm(`Change ${order.order_number} from ${order.status} to ${next}?`))return;
  button.disabled=true;msg('Updating order status…');
  const {data,error}=await db.from('orders').update({status:next}).eq('id',order.id).eq('status',order.status).select('id,status');
  button.disabled=false;
  if(error){msg('Update failed: '+error.message,true);return;}
  if(!data?.length){msg('Order changed elsewhere or update not permitted. Refresh and try again.',true);return;}
  await refresh();
 }
 $('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();$('loginButton').disabled=true;msg('Signing in…');
  const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
  $('password').value='';$('loginButton').disabled=false;
  if(error){msg('Sign in failed: '+error.message,true);return;}
  if(!await authorized()){await db.auth.signOut();show(false);msg('Signed in, but order access was denied. Contact the project administrator.',true);return;}
  show(true);await refresh();startPolling();
 });
 $('signout').onclick=async()=>{stopPolling();stopAlarmLoop();activeAlarms.clear();pendingBaseline=null;await db.auth.signOut();currentOrders=[];show(false);$('pendingNotifications').hidden=true;msg('Signed out.');};
 $('refresh').onclick=()=>refresh();$('statusFilter').onchange=render;
 $('pendingBell').onclick=()=>{const panel=$('pendingNotifications');panel.hidden=!panel.hidden;$('pendingBell').setAttribute('aria-expanded',String(!panel.hidden));};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('dashboard').hidden){refresh(true);if(soundEnabled && activeAlarms.size)ensureAlarmLoop();}});
 (async()=>{const {data:{session}}=await db.auth.getSession();if(session&&await authorized()){show(true);await refresh();startPolling();}else{show(false);msg('Sign in with your owner account.');}})();
})();
