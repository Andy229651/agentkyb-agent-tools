// Public, unauthenticated read-only audit of x402 facilitator catalog entries.
// No wallet, signer, authentication, verification or settlement requests.
const ORIGIN='https://agentkyb.andy229651.workers.dev';
const PAY_TO='0x63Ef759d667394EFB6dd9403fD60ac7B619d3018';
const targets=[
  {environment:'mainnet',endpoint:ORIGIN+'/mcp-x402',network:'eip155:8453'},
  {environment:'testnet',endpoint:ORIGIN+'/mcp-x402-payai-test',network:'eip155:84532'}
];
const catalogs=[
  {name:'payai',base:'https://facilitator.payai.network'},
  {name:'x402-org',base:'https://x402.org/facilitator'},
  {name:'coinbase-cdp',base:'https://api.cdp.coinbase.com/platform/v2/x402'}
];
const norm=v=>String(v||'').toLowerCase();
const getItems=data=>Array.isArray(data)?data:
  Array.isArray(data?.items)?data.items:
  Array.isArray(data?.resources)?data.resources:
  Array.isArray(data?.data?.items)?data.data.items:
  [];
const summary=item=>({
  resource:item.resource?.url||item.resource||item.url||null,
  toolName:item.toolName||item.extensions?.bazaar?.info?.input?.toolName||null,
  type:item.type||null,
  lastUpdated:item.lastUpdated||item.updatedAt||null,
  serviceName:item.serviceName||item.resource?.serviceName||null,
  tags:item.tags||item.resource?.tags||null,
  descriptionPresent:typeof item.description==='string'&&item.description.length>0,
  bazaarSchemaPresent:Boolean(item.extensions?.bazaar?.schema),
  bazaarInfoPresent:Boolean(item.extensions?.bazaar?.info),
  outputSchemaPresent:Boolean(item.outputSchema),
  networks:(item.accepts||[]).map(a=>a.network),
  recipients:(item.accepts||[]).map(a=>a.payTo),
  amountMicroUsdc:(item.accepts||[]).map(a=>a.amount||a.maxAmountRequired)
});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function queryCatalog(catalog, target) {
  const params=new URLSearchParams({type:'mcp',payTo:PAY_TO,network:target.network,limit:'100',offset:'0'});
  const uri=catalog.base+'/discovery/resources?'+params;
  const response=await fetch(uri,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});
  const raw=await response.text();
  if(!response.ok) return {status:'unavailable',http:response.status,diagnostic:raw.slice(0,180)};
  let json;
  try{json=JSON.parse(raw)}catch{return {status:'unavailable',http:response.status,diagnostic:'non_json_response'};}
  const items=getItems(json);
  const match=items.filter(item=>{
    const name=norm(item.resource?.url||item.resource||item.url);
    const recipientMatches=(item.accepts||[]).some(a=>norm(a.payTo)===norm(PAY_TO));
    const tool=String(item.toolName||item.extensions?.bazaar?.info?.input?.toolName||'').toLowerCase();
    const endpointMatches=name===norm(target.endpoint);
    return endpointMatches && (recipientMatches||tool==='vendor_preflight'||!item.accepts?.length);
  });
  return {status:match.length?'indexed':'not_seen_on_first_page',http:response.status,
    queried:uri,returnedCount:items.length,total:json.total||json.totalCount||null,
    matches:match.map(summary)};
}
for(const target of targets){
 for(const catalog of catalogs){
  let result;
  try{result=await queryCatalog(catalog,target)}catch(error){result={status:'unavailable',error:String(error).slice(0,180)};}
  console.log('X402_CATALOG_EVIDENCE',JSON.stringify({catalog:catalog.name,environment:target.environment,endpoint:target.endpoint,...result}));
  await wait(400);
 }
}

const searchQueries=['verify vendor before paying','KYB supplier risk','counterparty check'];
for (const catalog of catalogs.filter(c=>c.name!=='x402-org')) {
 for (const query of searchQueries) {
  let responseResult={status:'unavailable'};
  try {
   const u=catalog.base+'/discovery/search?'+new URLSearchParams({query,limit:'30'});
   const response=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
   const body=await response.text();
   if(response.ok) {
    const data=JSON.parse(body);
    const matches=getItems(data).filter(x=>norm(x.resource?.url||x.resource||x.url).includes('agentkyb.andy229651.workers.dev/mcp-x402'));
    responseResult={status:'ok',http:200,returned:getItems(data).length,
      matches:matches.map(summary),partialResults:data.partialResults||false};
   } else responseResult={status:'unavailable',http:response.status};
  } catch(e){responseResult={status:'unavailable',error:String(e).slice(0,160)};}
  console.log('X402_UNBRANDED_SEARCH_EVIDENCE',JSON.stringify({catalog:catalog.name,query,...responseResult}));
 }
}

console.log('INTERPRETATION',{rule:'Historical catalog entries prove listings only, not current metadata, paid agent usage or external revenue. Absence from one page is inconclusive when catalog paginates.'});
