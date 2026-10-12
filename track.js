(() => {
  const token=new URLSearchParams(location.hash.slice(1)).get('token');
  const msg=document.getElementById('trackingMessage');
  const stages=document.getElementById('trackingStages');
  const statuses=['Pending','Accepted','Preparing','Ready','Out for Delivery','Completed'];
  let busy=false,finished=false;
  function show(data){
    document.getElementById('trackingNumber').textContent=data.order_number;
    document.getElementById('trackingStatus').textContent='Status: '+data.status;
    const declined=data.status==='Declined';
    const idx=statuses.indexOf(data.status);
    stages.replaceChildren();
    for(let i=0;i<statuses.length;i++){const li=document.createElement('li');li.textContent=statuses[i];if(!declined && i<=idx)li.className='done';stages.append(li)}
    msg.textContent=declined?'This order was declined. Contact support for assistance.':idx===-1?'Order status is being updated.':'Latest status shown below.';
    document.getElementById('trackingUpdated').textContent=data.updated_at?'Last updated: '+new Date(data.updated_at).toLocaleString():'';
    finished=declined||data.status==='Completed';
  }
  async function refresh(){
    if(busy || !/^[a-f0-9]{64}$/.test(token||'')){if(!token || !/^[a-f0-9]{64}$/.test(token))msg.textContent='Invalid or missing private tracking link.';return}
    busy=true;
    try{
      const r=await fetch(window.DS_SUPABASE_URL+'/functions/v1/track-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),cache:'no-store'});
      const data=await r.json();if(!r.ok)throw new Error(data.error||'Tracking temporarily unavailable');show(data);
    }catch(e){msg.textContent=e.message==='Order not found'?'Order not found. Check your private tracking link.':'Could not refresh: '+e.message}
    finally{busy=false}
  }
  document.getElementById('refreshTracking').addEventListener('click',refresh);
  refresh();
  setInterval(()=>{if(!document.hidden&&!finished)refresh()},20000);
})();
