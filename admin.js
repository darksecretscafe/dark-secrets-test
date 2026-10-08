'use strict';
(() => {
 const $ = id => document.getElementById(id);
 const url = window.DS_SUPABASE_URL, key = window.DS_SUPABASE_KEY;
 const valid = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url || '') && key && !key.startsWith('PASTE_') && window.supabase;
 const msg = (s,err=false) => { $('message').textContent=s || ''; $('message').className=err?'error':''; };
 if (!valid) { $('setup').hidden=false; msg('Configuration required before signing in.'); return; }
 const db = window.supabase.createClient(url,key);
 let currentOrders=[];
 const money=n=>'₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const text=(tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value==null?'':String(value);if(cls)el.className=cls;return el;};
 function show(auth){$('login').hidden=auth;$('dashboard').hidden=!auth;$('signout').hidden=!auth;}
 async function authorized(){
  const {data:{user},error}=await db.auth.getUser();if(error||!user)return false;
  // Membership is not directly readable by clients. Read access to orders is controlled by RLS.
  // When no orders exist, the query below cannot prove admin membership; login alone is not an admin grant.
  const {data,error:readError}=await db.from('orders').select('id').limit(1);
  if(readError){msg('Cannot access orders. Check admin permissions: '+readError.message,true);return false;}
  return true;
 }
 async function refresh(){
  msg('Loading orders…');$('refresh').disabled=true;
  const {data,error}=await db.from('orders').select('id,order_number,customer_name,customer_phone,delivery_address,landmark,gps_latitude,gps_longitude,notes,payment_method,total_amount,status,created_at,order_items(product_name,packaging,quantity,unit_price,subtotal)').order('created_at',{ascending:false}).limit(100);
  $('refresh').disabled=false;
  if(error){msg('Could not load orders: '+error.message,true);return;}
  currentOrders=data||[];render();msg('Showing the 100 most recent orders.');
 }
 function render(){
  $('pendingCount').textContent=currentOrders.filter(o=>o.status==='Pending').length;
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
  show(true);await refresh();
 });
 $('signout').onclick=async()=>{await db.auth.signOut();currentOrders=[];show(false);msg('Signed out.');};
 $('refresh').onclick=refresh;$('statusFilter').onchange=render;
 (async()=>{const {data:{session}}=await db.auth.getSession();if(session&&await authorized()){show(true);await refresh();}else{show(false);msg('Sign in with your owner account.');}})();
})();
