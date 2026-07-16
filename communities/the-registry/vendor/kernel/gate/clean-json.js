// Role: strip code fences and surrounding prose from a model's JSON reply.
// Contract: cleanJSON(raw:string) -> string, the bare JSON array/object text.
// Invariant: pure and DOM-free; same input, same output, no side effects.
function cleanJSON(raw){
  var t=(raw||'').trim();
  t=t.replace(/^```[A-Za-z]*\s*/,'').replace(/\s*```$/,'').trim();     // strip ```json fences
  var a=t.indexOf('['), c=t.indexOf('{');                              // earliest opening bracket wins
  if(a===-1 && c===-1) return t;
  var start, open;
  if(a===-1){start=c;open='{';} else if(c===-1){start=a;open='[';}
  else if(a<c){start=a;open='[';} else {start=c;open='{';}
  var end = open==='[' ? t.lastIndexOf(']') : t.lastIndexOf('}');
  if(end>start) t=t.slice(start,end+1);
  return t;
}

if (typeof module !== "undefined" && module.exports) module.exports = { cleanJSON };
