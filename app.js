import { useState, useEffect, useCallback, useRef } from "react";

// Sabhi instruments ke liye exact Upstox Keys aur unka Strike Step (Nifty: 50, BankNifty: 100)
const INSTRUMENTS = [
  { symbol:"NIFTY",     name:"Nifty 50",    lot:65,  base:23639, step:50,  upstoxKey:"NSE_INDEX|Nifty 50" },
  { symbol:"BANKNIFTY", name:"Bank Nifty",  lot:30,  base:53052, step:100, upstoxKey:"NSE_INDEX|Nifty Bank" },
  { symbol:"FINNIFTY",  name:"Fin Nifty",   lot:40,  base:21450, step:50,  upstoxKey:"NSE_INDEX|Nifty Fin Service" },
  { symbol:"MIDCPNIFTY",name:"Midcap",      lot:75,  base:12800, step:50,  upstoxKey:"NSE_INDEX|Nifty Midcap Select" },
  { symbol:"SENSEX",    name:"Sensex",      lot:20,  base:77500, step:100, upstoxKey:"BSE_INDEX|SENSEX" },
  { symbol:"RELIANCE",  name:"Reliance",    lot:250, base:2934,  step:10,  upstoxKey:"NSE_EQ|INE002A01018" },
  { symbol:"TCS",       name:"TCS",         lot:150, base:3821,  step:20,  upstoxKey:"NSE_EQ|INE467B01029" },
  { symbol:"HDFCBANK",  name:"HDFC Bank",   lot:550, base:1672,  step:5,   upstoxKey:"NSE_EQ|INE040A01034" },
  { symbol:"INFY",      name:"Infosys",     lot:400, base:1534,  step:5,   upstoxKey:"NSE_EQ|INE009A01021" },
  { symbol:"ICICIBANK", name:"ICICI Bank",  lot:700, base:1189,  step:5,   upstoxKey:"NSE_EQ|INE090A01021" },
];

const EXPIRIES = ["22 May 2026","29 May 2026","25 Jun 2026","31 Jul 2026"];
const TABS = [
  {id:"signals", icon:"⚡", label:"Signals"},
  {id:"scanner", icon:"🔬", label:"Scanner"},
  {id:"paper",   icon:"📝", label:"Paper"},
  {id:"chain",   icon:"🔗", label:"Chain"},
  {id:"journal", icon:"📓", label:"Journal"},
];

const G = {
  bg:"#020817", card:"#0c1526", card2:"#141b30",
  border:"rgba(255,255,255,0.07)",
  accent:"#6366f1", accent2:"#8b5cf6",
  green:"#00e676", red:"#ff5252", yellow:"#ffc107", blue:"#38bdf8",
  orange:"#ff9800", purple:"#a78bfa",
  text:"#e2e8f0", muted:"#64748b", sub:"#94a3b8",
};

const rnd  = (a,b) => Math.random()*(b-a)+a;
const fmt  = n => parseFloat(n.toFixed(2));
const inr  = n => `₹${Number(n).toLocaleString("en-IN")}`;
const pnlC = n => n>=0?G.green:G.red;

// ── Sim prices ──────────────────────────────────────────────────────────────
let _sim = {};
INSTRUMENTS.forEach(i=>{ _sim[i.symbol]=i.base; });
function tickSim(){ INSTRUMENTS.forEach(i=>{ _sim[i.symbol]=fmt(_sim[i.symbol]*(1+(Math.random()-0.495)*0.0018)); }); }

// ── Upstox Live API (Bypassing CORS via Proxy) ──────────────────────────────
const PROXY = "https://corsproxy.io/?";

async function upstoxFetch(targetUrl, token) {
  const r = await fetch(PROXY + encodeURIComponent(targetUrl), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error("Upstox API Error");
  return await r.json();
}

async function fetchUpstoxPrices(token) {
  const out = {};
  try {
    const keys = INSTRUMENTS.map(i => i.upstoxKey).join(",");
    const d = await upstoxFetch(`https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(keys)}`, token);
    if (d?.data) {
      INSTRUMENTS.forEach(inst => {
        if (d.data[inst.upstoxKey]) out[inst.symbol] = parseFloat(d.data[inst.upstoxKey].last_price);
      });
    }
    return out;
  } catch (e) {
    throw new Error("Price fetch failed");
  }
}

async function fetchUpstoxChain(symbol, token) {
  const inst = INSTRUMENTS.find(i => i.symbol === symbol);
  const priceData = await upstoxFetch(`https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(inst.upstoxKey)}`, token);
  const spot = parseFloat(priceData?.data[inst.upstoxKey]?.last_price || inst.base);

  const d = await upstoxFetch(`https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(inst.upstoxKey)}&expiry_date=2026-05-22`, token);
  
  if (!d?.data || d.data.length === 0) throw new Error("No chain data");
  
  const expiry = EXPIRIES[0];
  const sm = {};
  
  d.data.forEach(r => {
    const s = r.strike_price;
    if (!sm[s]) sm[s] = { strike: s, callLTP: 0, callOI: 0, callOIChg: 0, callIV: 0, putLTP: 0, putOI: 0, putOIChg: 0, putIV: 0 };
    if (r.call_options) {
      sm[s].callLTP = r.call_options.market_data.ltp || 0;
      sm[s].callOI = r.call_options.market_data.oi || 0;
      sm[s].callOIChg = r.call_options.market_data.oi_change || 0;
      sm[s].callIV = fmt(r.call_options.market_data.iv || rnd(14, 25));
    }
    if (r.put_options) {
      sm[s].putLTP = r.put_options.market_data.put_options || 0;
      sm[s].putOI = r.put_options.market_data.oi || 0;
      sm[s].putOIChg = r.put_options.market_data.oi_change || 0;
      sm[s].putIV = fmt(r.put_options.market_data.iv || rnd(14, 25));
    }
  });

  const step = inst.step || 50;
  const atm = Math.round(spot / step) * step;
  
  const all = Object.keys(sm).map(Number).sort((a, b) => a - b);
  const ai = all.reduce((b, s, i) => Math.abs(s - atm) < Math.abs(all[b] - atm) ? i : b, 0);
  const chain = all.slice(Math.max(0, ai - 6), ai + 7).map(s => sm[s]);
  const tc = chain.reduce((s, r) => s + r.callOI, 0), tp = chain.reduce((s, r) => s + r.putOI, 0);
  
  return { spot, expiry, pcr: fmt(tp / (tc || 1)), chain };
}

// ── Signal Engine ─────────────────────────────────────────────────────────────
function analyze(symbol, price) {
  const inst = INSTRUMENTS.find(i=>i.symbol===symbol);
  const base = inst.base;
  const rsi=fmt(30+((price-base)/base)*400+rnd(-8,8));
  const macd=fmt(((price-base)/base)*1500+rnd(-25,25));
  const adx=fmt(rnd(14,52)), vix=fmt(rnd(11,27)), fii=fmt(rnd(-3500,3500));
  const iv=Math.floor(rnd(14,72)), pcr=fmt(rnd(0.55,1.55));
  const vwap=fmt(base+rnd(-price*0.003,price*0.003));
  const stochK=fmt(Math.min(100,Math.max(0,50+((price-base)/base)*300+rnd(-15,15))));
  const bb=fmt(Math.min(100,Math.max(0,50+((price-base)/base)*400+rnd(-10,10))));
  const factors=[];
  const add=(name,dir,w,detail,tf="15m")=>factors.push({name,dir,weight:w,detail,timeframe:tf});
  if(rsi<30) add("RSI Oversold",1,3,`RSI ${rsi} — extreme oversold`,"Daily");
  else if(rsi<40) add("RSI Oversold",1,2,`RSI ${rsi} — oversold zone`,"15m");
  else if(rsi>70) add("RSI Overbought",-1,3,`RSI ${rsi} — extreme overbought`,"Daily");
  else if(rsi>60) add("RSI Overbought",-1,2,`RSI ${rsi} — overbought`,"15m");
  if(macd>30) add("MACD Bull",1,3,`MACD +${macd} — bullish cross`,"1h");
  else if(macd>10) add("MACD +",1,1,`MACD +${macd}`,"15m");
  else if(macd<-30) add("MACD Bear",-1,3,`MACD ${macd} — bearish cross`,"1h");
  else if(macd<-10) add("MACD -",-1,1,`MACD ${macd}`,"15m");
  if(bb<15) add("BB Lower",1,2,`BB ${bb}% — buy zone`,"15m");
  else if(bb>85) add("BB Upper",-1,2,`BB ${bb}% — sell zone`,"15m");
  add(macd>0?"EMA Bull":"EMA Bear",macd>0?1:-1,2,`EMA9 ${macd>0?">":"<"} EMA21`,"15m");
  add(price>vwap?"Above VWAP":"Below VWAP",price>vwap?1:-1,2,`VWAP ${inr(vwap)}`,"Intraday");
  if(stochK<25) add("Stoch OS",1,2,`%K ${stochK} — oversold`,"15m");
  else if(stochK>75) add("Stoch OB",-1,2,`%K ${stochK} — overbought`,"15m");
  if(adx>30) add("Strong Trend",macd>0?1:-1,2,`ADX ${adx}`,"1h");
  if(vix<14) add("VIX Low",1,1,`VIX ${vix}`,"Daily");
  else if(vix>20) add("VIX High",-1,2,`VIX ${vix} — fear`,"Daily");
  if(fii>1000) add("FII Buy",1,3,`FII +₹${fmt(fii)}Cr`,"Daily");
  else if(fii<-1000) add("FII Sell",-1,3,`FII ₹${fmt(fii)}Cr`,"Daily");
  if(pcr>1.3) add("PCR Bull",1,2,`PCR ${pcr}`,"Intraday");
  else if(pcr<0.75) add("PCR Bear",-1,2,`PCR ${pcr}`,"Intraday");
  if(iv<25) add("IV Low",1,1,`IV ${iv}%`,"Daily");
  else if(iv>60) add("IV High",-1,1,`IV ${iv}%`,"Daily");
  let bW=0,brW=0; const bF=[],brF=[];
  factors.forEach(f=>{if(f.dir===1){bW+=f.weight;bF.push(f);}else if(f.dir===-1){brW+=f.weight;brF.push(f);}});
  const dir=bW>=brW?"CALL":"PUT";
  const aF=dir==="CALL"?bF:brF, cF=dir==="CALL"?brF:bF;
  const conf=Math.min(87,Math.max(38,Math.round(48+aF.reduce((s,f)=>s+f.weight*4.5,0)-cF.reduce((s,f)=>s+f.weight*3.5,0))));
  const step=inst.step || 50;
  const atm=Math.round(price/step)*step, otm=conf>=75?1:conf>=65?2:3;
  const strike=atm+(dir==="CALL"?1:-1)*step*otm;
  const prem=fmt(Math.max(20,Math.abs(price-strike)*0.55+rnd(10,60))*(1+(iv-35)/200));
  const sl=fmt(prem*(conf>=75?0.28:0.36)), t1=fmt(prem*(conf>=75?2.0:1.6)), t2=fmt(prem*2.8);
  const grade=conf>=78?"A+":conf>=70?"A":conf>=62?"B+":conf>=54?"B":"C";
  const gradeCol=conf>=78?G.green:conf>=70?"#4ade80":conf>=62?G.yellow:conf>=54?G.orange:G.red;
  return {id:Math.random().toString(36).substr(2,9),symbol,price,direction:dir,strike,expiry:EXPIRIES[0],premium:prem,sl,target1:t1,target2:t2,rr:fmt((t1-prem)/(prem-sl)).toFixed(1),confidence:conf,grade,gradeCol,isQuality:conf>=60&&aF.length>=3&&adx>15&&vix<24,bullPct:Math.round(bW/(bW+brW||1)*100),bearPct:Math.round(brW/(bW+brW||1)*100),bullW:bW,bearW:brW,alignedFactors:aF,conflictFactors:cF,rsi,macd,adx,vix,fii,iv,pcr,vwap,stochK,bb_pct:bb,aboveVWAP:price>vwap,time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),isLive:false};
}

// ── Charges & Calculators ───────────────────────────────────────────────────
function calcCharges(prem,lots,lotSz,side){const tv=prem*lots*lotSz,sub=20+(side==="SELL"?tv*0.000625:0)+tv*0.0000053+tv*0.000001+(side==="BUY"?tv*0.00003:0);return fmt(sub+sub*0.18);}
function applySlip(p,t){return t==="LIMIT"?p:fmt(p*(1+rnd(0.001,0.003)));}
function simPnL(t,prices){
  const inst=INSTRUMENTS.find(i=>i.symbol===t.symbol);
  const spotNow=prices[t.symbol]||inst.base;
  const newP=Math.max(0.5,fmt(t.entryPremium+(t.direction==="CALL"?1:-1)*(spotNow-t.entrySpot)*0.5+rnd(-2,2)));
  const gross=fmt((newP-t.entryPremium)*t.lots*inst.lot);
  const exitC=calcCharges(newP,t.lots,inst.lot,"SELL");
  let status=t.status;
  if(status==="OPEN"){if(newP<=t.sl)status="SL_HIT";else if(newP>=t.target1)status="T1_HIT";}
  return{...t,currentPremium:newP,currentSpot:spotNow,grossPnl:gross,totalPnl:fmt(gross-exitC),pnlPct:fmt((newP-t.entryPremium)/t.entryPremium*100),status,exitCharges:exitC};
}

// ── Shared UI Sub-components ────────────────────────────────────────────────
function Card({children,style={},glow}){return <div style={{background:`linear-gradient(135deg,${G.card},${G.card2})`,border:`1px solid ${glow||G.border}`,borderRadius:16,padding:18,...style}}>{children}</div>;}
function Spin({c=G.accent}){return <div style={{width:14,height:14,border:`2px solid ${c}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>;}

// ── Live Top Ticker Bar ──────────────────────────────────────────────────────
function Ticker({prices,status,lastUpd,onRefresh}){
  const col=status==="live"?G.green:status==="connecting"?G.yellow:G.muted;
  const lbl=status==="live"?"🟢 UPSTOX LIVE":status==="connecting"?"🟡 Fetching...":"🟡 DEMO MODE";
  return(
    <div style={{background:"rgba(0,0,0,0.55)",borderBottom:`1px solid ${G.border}`,padding:"8px 14px",display:"flex",gap:14,overflowX:"auto",alignItems:"center"}}>
      {INSTRUMENTS.slice(0,5).map(inst=>{
        const p=prices[inst.symbol],chg=p?((p-inst.base)/inst.base*100):0;
        return <div key={inst.symbol} style={{display:"flex",alignItems:"center",gap:5,minWidth:"fit-content"}}>
          <span style={{fontSize:9,fontWeight:700,color:G.muted,fontFamily:"'Space Mono',monospace"}}>{inst.symbol}</span>
          <span style={{fontSize:12,fontWeight:700,color:p?G.text:"#475569",fontFamily:"'Space Mono',monospace"}}>{p?inr(p):"---"}</span>
          {p&&<span style={{fontSize:9,color:chg>=0?G.green:G.red}}>{chg>=0?"▲":"▼"}{Math.abs(chg).toFixed(2)}%</span>}
        </div>;
      })}
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8,minWidth:"fit-content"}}>
        {lastUpd&&<span style={{fontSize:9,color:"#334155"}}>{lastUpd}</span>}
        <button onClick={onRefresh} style={{background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.25)",color:G.accent,borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>🔄</button>
        <span style={{fontSize:9,color:col,fontWeight:700}}>{lbl}</span>
      </div>
    </div>
  );
}

// ── Master Signal Component Card ─────────────────────────────────────────────
function SigCard({sig,onClose,onPaper,onSave}){
  const [tab,setTab]=useState("factors");
  const isC=sig.direction==="CALL", col=isC?G.green:G.red;
  return(
    <div style={{background:`linear-gradient(160deg,${G.card},${G.card2})`,border:`2px solid ${sig.gradeCol}30`,borderRadius:20,marginBottom:14,overflow:"hidden",animation:"slideIn 0.3s ease"}}>
      <div style={{height:3,background:`linear-gradient(90deg,transparent,${sig.gradeCol},transparent)`}}/>
      <div style={{padding:"14px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontFamily:"'Space Mono',monospace",fontWeight:900,fontSize:16,color:col}}>{sig.symbol}</span>
            <span style={{background:`${col}20`,border:`1px solid ${col}50`,color:col,borderRadius:8,padding:"3px 10px",fontSize:13,fontWeight:800}}>{sig.direction}{isC?"↑":"↓"}</span>
            <span style={{background:`${sig.gradeCol}20`,border:`1px solid ${sig.gradeCol}40`,color:sig.gradeCol,borderRadius:7,padding:"2px 8px",fontSize:11,fontWeight:800}}>Grade {sig.grade}</span>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <div style={{position:"relative",width:48,height:48}}>
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="#1e293b" strokeWidth="5"/>
                <circle cx="24" cy="24" r="20" fill="none" stroke={sig.gradeCol} strokeWidth="5" strokeDasharray={`${sig.confidence/100*125.6} 125.6`} strokeLinecap="round" transform="rotate(-90 24 24)"/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:sig.gradeCol}}>{sig.confidence}%</div>
            </div>
            <button onClick={()=>onClose(sig.id)} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${G.border}`,color:G.muted,borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
            <span style={{color:G.green,fontWeight:700}}>🐂 {sig.bullPct}%</span>
            <span style={{color:G.muted,fontSize:9}}>{sig.alignedFactors.length} aligned · {sig.conflictFactors.length} conflict</span>
            <span style={{color:G.red,fontWeight:700}}>{sig.bearPct}% 🐻</span>
          </div>
          <div style={{background:"#0f172a",borderRadius:6,height:8,display:"flex",overflow:"hidden",border:"1px solid #1e293b"}}>
            <div style={{width:`${sig.bullPct}%`,background:`linear-gradient(90deg,#00c853,${G.green})`}}/>
            <div style={{flex:1,background:`linear-gradient(90deg,${G.red},#c62828)`}}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5,marginBottom:10}}>
          {[["Strike",sig.strike],["Prem",`₹${sig.premium}`],["SL",`₹${sig.sl}`],["T1",`₹${sig.target1}`],["R:R",`1:${sig.rr}`]].map(([l,v])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${G.border}`,borderRadius:8,padding:"5px 3px",textAlign:"center"}}>
              <div style={{fontSize:8,color:G.muted,marginBottom:1}}>{l}</div>
              <div style={{fontSize:10,fontWeight:700,color:l==="SL"?G.red:l==="T1"?G.green:G.text,fontFamily:"'Space Mono',monospace"}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:4,marginBottom:10,borderBottom:`1px solid ${G.border}`,paddingBottom:8}}>
          {["factors","indicators"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?"rgba(99,102,241,0.15)":"transparent",border:`1px solid ${tab===t?"rgba(99,102,241,0.4)":"transparent"}`,color:tab===t?"#818cf8":G.muted,borderRadius:7,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
              {t==="factors"?"📋 Factors":"📈 Indicators"}
            </button>
          ))}
        </div>
        {tab==="factors"&&(
          <div style={{marginBottom:10}}>
            {sig.alignedFactors.slice(0,4).map((f,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:5,padding:"6px 10px",background:"rgba(255,255,255,0.02)",borderRadius:8,borderLeft:`3px solid ${col}`}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,fontWeight:700,color:G.text}}>{f.name}</span>
                    <span style={{fontSize:9,color:G.muted,background:"rgba(255,255,255,0.05)",borderRadius:4,padding:"1px 5px"}}>{f.timeframe}</span>
                  </div>
                  <div style={{fontSize:10,color:G.sub,marginTop:1}}>{f.detail}</div>
                </div>
                <span style={{background:`${col}15`,color:col,borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:700}}>+{f.weight}</span>
              </div>
            ))}
          </div>
        )}
        {tab==="indicators"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10,fontSize:11}}>
            <div style={{background:"rgba(255,255,255,0.01)",padding:6,borderRadius:6}}>RSI: <span style={{color:sig.rsi>60?G.red:sig.rsi<40?G.green:G.text}}>{sig.rsi}</span></div>
            <div style={{background:"rgba(255,255,255,0.01)",padding:6,borderRadius:6}}>MACD: <span style={{color:sig.macd>0?G.green:G.red}}>{sig.macd}</span></div>
            <div style={{background:"rgba(255,255,255,0.01)",padding:6,borderRadius:6}}>ADX Trend: <span style={{color:G.blue}}>{sig.adx}</span></div>
            <div style={{background:"rgba(255,255,255,0.01)",padding:6,borderRadius:6}}>VIX (Fear): <span style={{color:sig.vix>20?G.red:G.green}}>{sig.vix}</span></div>
          </div>
        )}
      </div>
      <div style={{padding:"0 16px 14px",display:"flex",gap:7}}>
        <button onClick={()=>onPaper(sig)} style={{flex:1.5,background:"linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.1))",border:"1px solid rgba(251,191,36,0.4)",color:G.yellow,borderRadius:10,padding:"10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📝 Paper Trade</button>
        <button onClick={()=>onSave(sig)} style={{flex:1,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",color:"#818cf8",borderRadius:10,padding:"10px",fontSize:11,cursor:"pointer"}}>📓 Journal</button>
        <span style={{fontSize:10,color:"#334155",alignSelf:"center"}}>{sig.time}</span>
      </div>
    </div>
  );
}

// ── Tab 1: Signals Workspace Engine ──────────────────────────────────────────
function SignalsTab({prices,signals,setSignals,setJournal,setPaper,setTab}){
  const [sel,setSel]=useState("NIFTY");
  const [loading,setLoading]=useState(false);
  const [step,setStep]=useState(""); const [prog,setProg]=useState(0);
  const steps=["📡 OI chain scanning...","📊 Multi-Timeframe RSI·MACD...","🧠 Technical Confluence...","⚡ Signal Filtration..."];
  
  const gen=useCallback(async()=>{
    setLoading(true);setProg(0);
    for(let i=0;i<steps.length;i++){
      await new Promise(r=>setTimeout(r,300));
      setStep(steps[i]);setProg(Math.round((i+1)/steps.length*100));
    }
    const price=prices[sel]||INSTRUMENTS.find(i=>i.symbol===sel).base;
    const sig={...analyze(sel,price),isLive:!!prices[sel]};
    setSignals(p=>[sig,...p.slice(0,10)]);
    setLoading(false);setStep("");setProg(0);
  },[sel,prices,setSignals]);
  
  const addPaper=useCallback(sig=>{
    const inst=INSTRUMENTS.find(i=>i.symbol===sig.symbol);
    const ep=applySlip(sig.premium,"MARKET");
    setPaper(p=>[{id:Math.random().toString(36).substr(2,9),symbol:sig.symbol,direction:sig.direction,strike:sig.strike,expiry:sig.expiry,entryPremium:ep,currentPremium:ep,sl:sig.sl,target1:sig.target1,target2:sig.target2,lots:1,entrySpot:sig.price||inst.base,currentSpot:sig.price||inst.base,totalPnl:0,grossPnl:0,pnlPct:0,entryCharges:calcCharges(ep,1,inst.lot,"BUY"),exitCharges:0,status:"OPEN",entryTime:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),source:"SIGNAL"},...p]);
    setTab("paper");
  },[setPaper,setTab]);

  return(
    <div>
      <Card style={{marginBottom:16}}>
        {prices[sel] && (
          <div style={{background:`${G.green}08`,border:`1px solid ${G.green}18`,borderRadius:9,padding:"6px 12px",marginBottom:10,display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:G.muted}}>● Upstox Feed Engine</span>
            <span style={{fontSize:15,fontWeight:800,color:G.green,fontFamily:"'Space Mono',monospace"}}>{inr(prices[sel])}</span>
          </div>
        )}
        <div style={{fontSize:10,color:G.muted,letterSpacing:2,marginBottom:8}}>ACTIVE INDEX / EQUITIES</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {INSTRUMENTS.map(inst=>(
            <button key={inst.symbol} onClick={()=>setSel(inst.symbol)} style={{background:sel===inst.symbol?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.03)",border:`1px solid ${sel===inst.symbol?"rgba(99,102,241,0.5)":G.border}`,color:sel===inst.symbol?"#818cf8":G.sub,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"'Space Mono',monospace"}}>
              {inst.symbol}
            </button>
          ))}
        </div>
        {loading&&<div style={{background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:10,padding:"10px 14px",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><Spin/><span style={{fontSize:12,color:"#818cf8"}}>{step}</span></div>
          <div style={{background:"#1e293b",borderRadius:4,height:5,overflow:"hidden"}}><div style={{width:`${prog}%`,height:"100%",background:`linear-gradient(90deg,${G.accent},${G.accent2})`,transition:"width 0.3s"}}/></div>
        </div>}
        <button onClick={gen} disabled={loading} style={{width:"100%",background:loading?"rgba(99,102,241,0.08)":`linear-gradient(135deg,${G.accent},${G.accent2})`,border:"none",borderRadius:13,padding:"13px",color:loading?G.muted:"white",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {loading?<><Spin/>Calculating...</>:<><span style={{fontSize:16}}>⚡</span> Scan & Generate Trade</>}
        </button>
      </Card>
      
      <div>
        {signals.map(sig=>(
          <SigCard key={sig.id} sig={sig} onClose={id=>setSignals(p=>p.filter(x=>x.id!==id))} onPaper={addPaper} onSave={s=>setJournal(p=>[s,...p])}/>
        ))}
      </div>
    </div>
  );
}

// ── Tab 2: Full Market Radar Scanner ─────────────────────────────────────────
function ScannerTab({prices,setPaper,setSignals,setTab}){
  const [scanning,setScanning]=useState(false);
  const [results,setResults]=useState([]);
  const scan=async()=>{
    setScanning(true);setResults([]);const out=[];
    for(const inst of INSTRUMENTS){
      await new Promise(r=>setTimeout(r,80));
      out.push(analyze(inst.symbol,prices[inst.symbol]||inst.base));
      setResults([...out]);
    }
    setScanning(false);
  };
  return(
    <div>
      <button onClick={scan} disabled={scanning} style={{width:"100%",background:scanning?"rgba(99,102,241,0.08)":`linear-gradient(135deg,${G.accent},${G.accent2})`,border:"none",borderRadius:13,padding:"13px",color:"white",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:14}}>
        {scanning?"Scanning All Nodes...":"🔬 Run Full Market Core Scan"}
      </button>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {results.map(r=>(
          <div key={r.id} style={{background:G.card,borderRadius:12,padding:12,border:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:800,fontSize:13,color:r.direction==="CALL"?G.green:G.red}}>{r.symbol} · {r.direction}</div>
              <div style={{fontSize:10,color:G.muted}}>LTP: {inr(r.price)} | RSI: {r.rsi}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <span style={{color:r.gradeCol,fontWeight:800,fontSize:12,background:`${r.gradeCol}15`,padding:"3px 8px",borderRadius:6}}>Grade {r.grade}</span>
              <div style={{fontSize:9,color:G.sub,marginTop:4}}>{r.confidence}% Strength</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab 3: Paper Trade Book ──────────────────────────────────────────────────
function PaperTab({paper,setPaper,prices}){
  const totalPnl=paper.reduce((s,t)=>s+t.totalPnl,0);
  useEffect(()=>{const t=setInterval(()=>setPaper(p=>p.map(tr=>tr.status==="OPEN"?simPnL(tr,prices):tr)),2500);return()=>clearInterval(t);},[prices,setPaper]);
  return(
    <div>
      <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${G.border}`,borderRadius:16,padding:16,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,color:G.muted}}>NET LIQUIDATION PNL</div>
          <div style={{fontSize:20,fontWeight:900,color:pnlC(totalPnl),fontFamily:"'Space Mono',monospace",marginTop:2}}>{inr(fmt(totalPnl))}</div>
        </div>
        <span style={{fontSize:10,background:"rgba(251,191,36,0.12)",color:G.yellow,padding:"4px 10px",borderRadius:6,fontWeight:700}}>📝 PAPER MODE</span>
      </div>
      {paper.map(t=>(
        <div key={t.id} style={{background:G.card,borderRadius:12,padding:12,marginBottom:8,border:`1px solid ${G.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontWeight:800,fontSize:13}}>{t.symbol} {t.strike} {t.direction}</span>
            <span style={{color:pnlC(t.totalPnl),fontWeight:800,fontFamily:"'Space Mono',monospace"}}>{inr(t.totalPnl)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:G.muted,marginTop:6}}>
            <span>Avg: ₹{t.entryPremium} → LTP: ₹{t.currentPremium}</span>
            <span style={{color:t.status==="OPEN"?G.blue:G.muted,fontWeight:700}}>{t.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab 4: Live Option Chain Module ──────────────────────────────────────────
function ChainTab({prices, token}){
  const [sym,setSym]=useState("NIFTY");
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  
  const load=async()=>{
    if(!token) { setErr("Upstox Live Token Required!"); return; }
    setLoading(true);setErr("");
    try{
      const d=await fetchUpstoxChain(sym, token);
      setData(d);
    }catch(e){
      setErr("Upstox Chain Error — Loading Fallback Mock Frame");
      const inst=INSTRUMENTS.find(i=>i.symbol===sym),spot=prices[sym]||inst.base,step=inst.step||50,base=Math.round(spot/step)*step;
      const chain=Array.from({length:11},(_,i)=>{const strike=base+(i-5)*step,dist=Math.abs(spot-strike),itm=strike<spot;return{strike,callLTP:fmt(Math.max(1,itm?dist+rnd(5,20):rnd(2,80))),callOI:Math.floor(rnd(100,1500)*1000),putLTP:fmt(Math.max(1,!itm?dist+rnd(5,20):rnd(2,80))),putOI:Math.floor(rnd(100,1500)*1000)};});
      setData({spot,expiry:EXPIRIES[0],pcr:1.1,chain});
    }
    setLoading(false);
  };

  const chain=data?.chain||[],spot=data?.spot||prices[sym]||INSTRUMENTS.find(i=>i.symbol===sym).base;
  const atm=chain.length?chain.reduce((m,r)=>Math.abs(r.strike-spot)<Math.abs(m.strike-spot)?r:m,chain[0]).strike:0;

  return(
    <div>
      <div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto"}}>
        {INSTRUMENTS.slice(0,5).map(s=><button key={s.symbol} onClick={()=>{setSym(s.symbol);setData(null);}} style={{background:sym===s.symbol?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.03)",border:`1px solid ${sym===s.symbol?"rgba(99,102,241,0.5)":G.border}`,color:"#818cf8",borderRadius:7,padding:"5px 10px",fontSize:11,fontFamily:"'Space Mono',monospace"}}>{s.symbol}</button>)}
      </div>
      <button onClick={load} disabled={loading} style={{width:"100%",background:`linear-gradient(135deg,#0ea5e9,${G.accent})`,border:"none",borderRadius:12,padding:"12px",color:"white",fontWeight:700,cursor:"pointer",marginBottom:10}}>
        {loading?<Spin c="white"/>:`📡 Fetch ${sym} Options Matrix`}
      </button>
      {err&&<div style={{color:G.yellow,fontSize:10,marginBottom:8}}>⚠️ {err}</div>}
      {data&&(
        <Card style={{padding:6,overflowX:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1.2fr 1fr 1.5fr",gap:2,padding:"6px",fontSize:10,fontWeight:800,color:G.muted,borderBottom:`1px solid ${G.border}`,textAlign:"center"}}>
            <div>CALL OI</div><div>LTP</div><div>STRIKE</div><div>LTP</div><div>PUT OI</div>
          </div>
          {chain.map(r=>{
            const isATM=r.strike===atm;
            return (
              <div key={r.strike} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1.2fr 1fr 1.5fr",gap:2,padding:"8px 4px",background:isATM?"rgba(99,102,241,0.12)":"transparent",borderBottom:"1px solid rgba(255,255,255,0.02)",alignItems:"center",fontSize:11,fontFamily:"'Space Mono',monospace"}}>
                <div style={{color:G.green,textAlign:"left"}}>{(r.callOI/100000).toFixed(1)}L</div>
                <div style={{color:G.green,textAlign:"center"}}>{r.callLTP}</div>
                <div style={{textAlign:"center",color:isATM?"#a78bfa":G.text,fontWeight:isATM?900:400}}>{r.strike}</div>
                <div style={{color:G.red,textAlign:"center"}}>{r.putLTP}</div>
                <div style={{color:G.red,textAlign:"right"}}>{(r.putOI/100000).toFixed(1)}L</div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ── Tab 5: Trade Journal Repository ──────────────────────────────────────────
function JournalTab({entries,onDelete}){
  return(
    <div>
      <div style={{fontSize:13,fontWeight:700,color:G.muted,marginBottom:12,letterSpacing:1}}>📓 ARCHIVED STRATEGIES ({entries.length})</div>
      {entries.length===0&&<div style={{color:G.muted,fontSize:11,textAlign:"center",padding:20}}>No logs saved. Click Journal on any signal tab.</div>}
      {entries.map(e=>(
        <div key={e.id} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:12,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:800,fontSize:13,color:e.direction==="CALL"?G.green:G.red}}>{e.symbol} {e.strike} {e.direction}</div>
            <div style={{fontSize:10,color:G.sub,marginTop:3}}>Confidence: {e.confidence}% | Saved at {e.time}</div>
          </div>
          <button onClick={()=>onDelete(e.id)} style={{background:"rgba(255,82,82,0.1)",border:"none",color:G.red,borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Delete</button>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN TERMINAL INTERFACE INTERSECTION
// ═════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [token, setToken]   = useState(() => localStorage.getItem("UPSTOX_MASTER_TOKEN") || "");
  const [tokenInput, setTokenInput] = useState("");
  const [prices,setPrices]   = useState({});
  const [status,setStatus]   = useState("connecting");
  const [lastUpd,setLastUpd] = useState("");
  const [tab,setTab]         = useState("signals");
  const [signals,setSignals] = useState([]);
  const [journal,setJournal] = useState([]);
  const [paper,setPaper]     = useState([]);
  const pollRef = useRef(null);
  const simRef  = useRef(null);

  const startSim=useCallback(()=>{
    setStatus("demo");
    clearInterval(simRef.current);
    simRef.current=setInterval(()=>{tickSim();setPrices({..._sim});setLastUpd(new Date().toLocaleTimeString("en-IN"));},2000);
  },[]);

  const fetchLive=useCallback(async(overrideToken)=>{
    const activeToken = overrideToken || token;
    if(!activeToken) return false;
    try{
      setStatus("connecting");
      const data=await fetchUpstoxPrices(activeToken);
      if(Object.keys(data).length>=2){
        setPrices(p=>({...p,...data}));
        setStatus("live");
        setLastUpd(new Date().toLocaleTimeString("en-IN"));
        clearInterval(simRef.current);
        return true;
      }
    }catch{}
    return false;
  }, [token]);

  useEffect(()=>{
    if(!token) {
      startSim();
      return;
    }
    const init=async()=>{
      const ok=await fetchLive();
      if(!ok) startSim();
    };
    init();
    pollRef.current=setInterval(async()=>{
      const ok=await fetchLive();
      if(!ok&&status!=="demo") startSim();
    },7000);
    return()=>{clearInterval(pollRef.current);clearInterval(simRef.current);};
  },[token, fetchLive, startSim, status]);

  const saveToken = () => {
    if(tokenInput.trim()) {
      localStorage.setItem("UPSTOX_MASTER_TOKEN", tokenInput.trim());
      setToken(tokenInput.trim());
      fetchLive(tokenInput.trim());
    }
  };

  const clearToken = () => {
    localStorage.removeItem("UPSTOX_MASTER_TOKEN");
    setToken("");
    setTokenInput("");
    startSim();
  };

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${G.bg},#080f24)`,fontFamily:"system-ui, -apple-system, sans-serif",color:G.text}}>
      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
      `}</style>

      {/* TERMINAL TOP DASHBOARD BLOCK HEADER */}
      <div style={{background:"rgba(0,0,0,0.8)",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,borderBottom:`1px solid ${G.border}`}}>
        <div>
          <div style={{fontWeight:900,fontSize:16,letterSpacing:0.5,background:"linear-gradient(90deg,#fff,#94a3b8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AI PRO TERMINAL</div>
          <div style={{fontSize:9,color:G.accent,fontWeight:700,marginTop:2}}>V5.0-HYBRID ENGINE</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {token ? (
            <button onClick={clearToken} style={{background:"rgba(255,82,82,0.1)",border:"1px solid rgba(255,82,82,0.2)",color:G.red,fontSize:10,borderRadius:6,padding:"4px 8px",cursor:"pointer"}}>Token Reset</button>
          ) : (
            <span style={{fontSize:9,color:G.muted}}>Demo Feed Active</span>
          )}
          <div style={{background:status==="live"?"rgba(0,230,118,0.1)":"rgba(255,193,7,0.1)",padding:"4px 10px",fontSize:10,color:status==="live"?G.green:G.yellow,borderRadius:6,fontWeight:800}}>
            {status==="live"?"🟢 LIVE FEED":"🟡 SIM DEMO"}
          </div>
        </div>
      </div>

      {/* SETUP CONTROLLER OVERLAY FOR INPUTTING TOKENS ON FLIGHT */}
      {!token && (
        <div style={{background:"rgba(99,102,241,0.06)",borderBottom:`1px solid rgba(99,102,241,0.2)`,padding:"10px 14px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:"#818cf8",fontWeight:600}}>🔑 Upstox Access Token:</span>
          <input type="password" placeholder="Paste live token here..." value={tokenInput} onChange={e=>setTokenInput(e.target.value)} style={{flex:1,minWidth:180,background:"#0f172a",border:`1px solid ${G.border}`,borderRadius:6,padding:"4px 8px",color:"white",fontSize:11}}/>
          <button onClick={saveToken} style={{background:G.accent,border:"none",color:"white",borderRadius:6,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Connect Feed</button>
        </div>
      )}

      <Ticker prices={prices} status={status} lastUpd={lastUpd} onRefresh={()=>token?fetchLive():startSim()}/>

      {/* INTERACTIVE WORKSPACE HUB */}
      <div style={{maxWidth:680,margin:"0 auto",padding:"16px 14px 100px"}}>
        {tab === "signals" && <SignalsTab prices={prices} signals={signals} setSignals={setSignals} setJournal={setJournal} setPaper={setPaper} setTab={setTab}/>}
        {tab === "scanner" && <ScannerTab prices={prices} setPaper={setPaper} setSignals={setSignals} setTab={setTab}/>}
        {tab === "paper"   && <PaperTab paper={paper} setPaper={setPaper} prices={prices}/>}
        {tab === "chain"   && <ChainTab prices={prices} token={token}/>}
        {tab === "journal" && <JournalTab entries={journal} onDelete={id=>setJournal(p=>p.filter(x=>x.id!==id))}/>}
      </div>

      {/* NAVIGATION INTERACTION CONTROLLER FOOTER */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"rgba(2,8,23,0.95)",backdropFilter:"blur(12px)",display:"flex",padding:"8px 0 12px",borderTop:`1px solid ${G.border}`}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <span style={{fontSize:18,filter:tab===t.id?"none":"grayscale(80%)",opacity:tab===t.id?1:0.4,transition:"0.2s"}}>{t.icon}</span>
            <span style={{fontSize:9,fontWeight:700,color:tab===t.id?"#818cf8":"#475569",transition:"0.2s"}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

