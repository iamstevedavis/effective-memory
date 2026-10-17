"use client";
import { FormEvent,useEffect,useRef,useState } from "react";
import BrandPreview from "../brand/BrandPreview";
type Draft={id:string;version:number;quote_text:string;caption_text:string;image_path:string|null;status:string;job_state?:string;error_code?:string};
type Progress={business:{id:string;name:string;timezone:string;weekly_target:number}|null;reviews:number;drafts:Draft[];period?:{reason:string;allocated:number;target:number}};
export default function Onboarding(){
  const [data,setData]=useState<Progress|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[authenticated,setAuthenticated]=useState(false),[importing,setImporting]=useState(false);
  const [name,setName]=useState(""),[zone,setZone]=useState("UTC"),[primary,setPrimary]=useState("#1f2937"),[secondary,setSecondary]=useState("#374151"),[tone,setTone]=useState("friendly"),[logo,setLogo]=useState("");
  const [loaded,setLoaded]=useState<Record<string,string>>({});const key=useRef("");
  async function load(id?:string){
    const response=await fetch(`/api/onboarding${id?`?businessId=${encodeURIComponent(id)}`:""}`),next=await response.json();
    if(!response.ok){setData(null);setAuthenticated(response.status!==401);setMessage(next.error??"Unable to resume; sign in and retry");return;}
    setAuthenticated(true);setData(next);if(next.business)window.history.replaceState(null,"",`/onboarding?businessId=${next.business.id}`);
  }
  useEffect(()=>{key.current=sessionStorage.getItem("praise-onboarding-key")??crypto.randomUUID();sessionStorage.setItem("praise-onboarding-key",key.current);void load(new URL(window.location.href).searchParams.get("businessId")??undefined);},[]);
  const business=data?.business;
  useEffect(()=>{if(!business)return;const timer=setInterval(()=>void load(business.id),2000);return()=>clearInterval(timer);},[business?.id]);
  async function create(event:FormEvent){event.preventDefault();setBusy(true);try{
    const response=await fetch("/api/businesses",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,timezone:zone,brandColors:{primary,secondary},brandTone:tone,logoUrl:logo||null,onboardingKey:key.current})});const body=await response.json();
    if(!response.ok){setMessage(body.error);return;}await load(body.business.id);setMessage("Business saved. Progress resumes from your account.");
  }catch{setMessage("Connection failed; retry safely with the same setup request.");}finally{setBusy(false);}}
  async function uploadLogo(file?:File){if(!file){setLogo("");return;}if(file.size>256000||!["image/png","image/jpeg","image/webp"].includes(file.type)){setLogo("");setMessage("Use PNG/JPEG/WebP under 256 KB.");return;}
    const reader=new FileReader();reader.onload=()=>setLogo(String(reader.result));reader.onerror=()=>setMessage("Logo could not be read");reader.readAsDataURL(file);
  }
  async function importCsv(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!business)return;const form=new FormData(event.currentTarget);form.set("businessId",business.id);setBusy(true);try{
    const response=await fetch("/api/reviews/import",{method:"POST",body:form}),body=await response.json();
    if(!response.ok){setMessage(body.error);return;}setMessage(`Imported ${body.imported}; duplicates ${body.duplicates}; invalid ${body.rejectedInvalid}; empty ${body.skippedEmpty}; storage failures ${body.failedRows}. ${(body.errors??[]).map((e:{row:number;error:string})=>`Row ${e.row}: ${e.error}`).join("; ")}`);
    if(body.imported||body.duplicates)setImporting(false);await load(business.id);
  }catch{setMessage("Import connection failed; reimporting the same file is safe.");}finally{setBusy(false);}}
  async function generate(path="/api/quotes/select",draft?:Draft){if(!business)return;setBusy(true);try{
    const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(draft?{draftPostId:draft.id,version:draft.version}:{businessId:business.id,limit:3})}),body=await response.json();
    setMessage(response.ok?body.message??`Generation queued: ${body.reason}`:body.error??"Generation request failed");await load(business.id);
  }catch{setMessage("Generation connection failed; refresh progress before retrying.");}finally{setBusy(false);}}
  const target=Math.min(3,business?.weekly_target??3),complete=(data?.drafts??[]).filter(d=>d.caption_text.trim()&&d.image_path&&!["failed","archived"].includes(d.status)).slice(0,target);
  const ready=complete.length===target&&complete.every(d=>loaded[d.id]===d.image_path);
  return <main style={{maxWidth:900,margin:"auto",padding:24}}><h1>Get your first review drafts</h1><p>Setup → import → generate → review. No automatic approval or scheduling.</p>
    <p role="status">{message}</p>{!authenticated?<p>Sign in with your account above to start or resume.</p>:null}
    {authenticated&&!business?<form onSubmit={create}><h2>1. Business and brand</h2>
      <label>Business name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Business timezone<input required value={zone} onChange={e=>setZone(e.target.value)}/></label>
      <label>Optional logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadLogo(e.target.files?.[0])}/></label>
      <label>Primary color<input type="color" value={primary} onChange={e=>setPrimary(e.target.value)}/></label><label>Secondary color<input type="color" value={secondary} onChange={e=>setSecondary(e.target.value)}/></label>
      <label>Brand tone<select value={tone} onChange={e=>setTone(e.target.value)}><option>friendly</option><option>premium</option><option>playful</option></select></label>
      <BrandPreview primary={primary} secondary={secondary} quoteSize="standard" tone={tone}/><button disabled={busy}>Save and continue</button></form>:null}
    {business?<><h2>{business.name} · {business.timezone}</h2><a href="/brand">Adjust saved brand settings</a>
      {data.reviews===0||importing?<form onSubmit={importCsv}><h2>2. Import reviews</h2><p>CSV: rating, text, reviewed_at (UTC); optional author_name, source_review_id, source_url. 1 MB / 1000 rows maximum.</p><a href="/onboarding-example.csv" download>Download synthetic sample CSV</a><label>Review CSV<input type="file" name="file" accept=".csv,text/csv" required/></label><button disabled={busy}>Import reviews</button></form>:<button onClick={()=>setImporting(true)}>Import more reviews</button>}
      {data.reviews>0&&!importing?<section><h2>3. Generate up to {target} previews</h2><p>{data.reviews} imported reviews. At least {target} eligible 4–5 star reviews of 30+ characters are needed. Exhausted reviews need more eligible input.</p>
        <button disabled={busy} onClick={()=>void generate()}>Queue first drafts</button><p>Weekly generation: {data.period?.reason??"not requested"}. First drafts count toward the same weekly quota.</p>
        <ul>{data.drafts.map(d=><li key={d.id}>Draft #{d.id}: {{pending:"Queued",running:"Generating",retry:"Retrying automatically",complete:"Ready for review",failed:"Needs attention"}[d.job_state??""]??d.status} {d.error_code?"Generation needs attention. Retry after checking saved branding; automatic retries are bounded.":""}{d.job_state==="failed"?<button disabled={busy} onClick={()=>void generate("/api/generation/retry",d)}>Retry failed draft {d.id}</button>:null}</li>)}</ul>
      </section>:null}
      <section><h2>{ready?`${target} usable draft previews`:"4. Draft previews"}</h2>{complete.map(d=><article key={d.id}><blockquote>{d.quote_text}</blockquote><p>{d.caption_text}</p><img src={d.image_path!} width={260} height={260} alt={`Onboarding draft ${d.id}`} onLoad={()=>setLoaded(v=>({...v,[d.id]:d.image_path!}))} onError={()=>{setLoaded(v=>({...v,[d.id]:""}));setMessage("Image unavailable; open approval to recover this draft.");}}/></article>)}
        <a href={`/approval?businessId=${business.id}`}>Review in approval</a><p>You choose what to approve; publishing requires a verified scheduler connection.</p></section>
    </>:null}</main>;
}
