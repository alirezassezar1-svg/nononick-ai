/*
 * NONONICK AI — Secure Vercel Gateway
 *
 * Secret required in Vercel:
 *   OPENROUTER_API_KEY
 *
 * Optional:
 *   NONONICK_MODEL=openrouter/free
 *   ALLOWED_ORIGIN=https://alirezassezar1-svg.github.io
 *
 * The browser never receives the OpenRouter key.
 */

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 12;
const buckets = new Map();

function getClientKey(req){
  const forwarded = req.headers["x-forwarded-for"];
  return (
    (typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : "") ||
    req.headers["x-real-ip"] ||
    "anonymous"
  );
}

function rateLimited(key){
  const now = Date.now();
  const bucket = buckets.get(key);

  if(!bucket || now - bucket.startedAt >= WINDOW_MS){
    buckets.set(key,{
      startedAt:now,
      count:1
    });
    return false;
  }

  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

function corsHeaders(origin){
  const allowed = process.env.ALLOWED_ORIGIN || "*";

  return {
    "Access-Control-Allow-Origin":
      allowed === "*" ? "*" : origin === allowed ? allowed : "null",
    "Access-Control-Allow-Methods":"POST,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type",
    "Vary":"Origin",
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store"
  };
}

function send(res,status,payload,origin){
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key,value])=>{
    res.setHeader(key,value);
  });
  res.status(status).json(payload);
}

function buildPrompt(body){
  const text = String(body.text || "").trim();
  const mode = String(body.mode || "ask").trim();

  if(!text){
    return {error:"Text is required."};
  }

  if(text.length > 12000){
    return {error:"Text is too long. Maximum is 12,000 characters."};
  }

  switch(mode){

    case "translate":{
      const from =
        String(body.sourceLanguage || "Auto Detect");
      const to =
        String(body.targetLanguage || "Persian");

      return {
        system:
          "You are NONONICK AI, a precise multilingual translator. " +
          "Preserve meaning, tone, names, numbers and formatting. " +
          "Return only the translated text unless a brief clarification is essential.",
        user:
          "Translate from " + from + " to " + to + ".\n\n" + text
      };
    }

    case "summarize":
      return {
        system:
          "You are NONONICK AI. Summarize accurately and compactly. " +
          "Keep the important facts, decisions, names and numbers. " +
          "Use clear bullets when they improve readability.",
        user:"Summarize this text:\n\n" + text
      };

    case "rewrite":{
      const style =
        String(body.style || "Clear");

      return {
        system:
          "You are NONONICK AI, an expert writing assistant. " +
          "Rewrite without inventing facts. Preserve the intended meaning. " +
          "The requested style is: " + style + ".",
        user:"Rewrite this text:\n\n" + text
      };
    }

    case "ask":
    default:
      return {
        system:
          "You are NONONICK AI, a helpful, accurate and concise AI assistant. " +
          "Answer directly and clearly. If the user asks for code, provide complete usable code.",
        user:text
      };
  }
}

module.exports = async function handler(req,res){

  const origin = req.headers.origin || "";

  if(req.method === "OPTIONS"){
    const headers = corsHeaders(origin);
    Object.entries(headers).forEach(([key,value])=>{
      res.setHeader(key,value);
    });
    return res.status(204).end();
  }

  if(req.method !== "POST"){
    return send(
      res,
      405,
      {error:"Method not allowed."},
      origin
    );
  }

  const key = getClientKey(req);

  if(rateLimited(key)){
    return send(
      res,
      429,
      {error:"Rate limit reached. Please try again shortly."},
      origin
    );
  }

  if(!process.env.OPENROUTER_API_KEY){
    return send(
      res,
      500,
      {error:"AI Gateway is not configured yet."},
      origin
    );
  }

  const prompt = buildPrompt(req.body || {});

  if(prompt.error){
    return send(
      res,
      400,
      {error:prompt.error},
      origin
    );
  }

  const model =
    process.env.NONONICK_MODEL ||
    "openrouter/free";

  try{

    const upstream = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method:"POST",
        headers:{
          "Authorization":
            "Bearer " +
            process.env.OPENROUTER_API_KEY,
          "Content-Type":
            "application/json",
          "HTTP-Referer":
            "https://alirezassezar1-svg.github.io/nononick-ai/",
          "X-Title":
            "NONONICK AI"
        },
        body:JSON.stringify({
          model,
          messages:[
            {
              role:"system",
              content:prompt.system
            },
            {
              role:"user",
              content:prompt.user
            }
          ],
          temperature:0.35,
          max_tokens:1200
        })
      }
    );

    const data = await upstream.json();

    if(!upstream.ok){
      const message =
        data?.error?.message ||
        "Upstream AI request failed.";

      return send(
        res,
        upstream.status >= 500 ? 502 : upstream.status,
        {error:message},
        origin
      );
    }

    const text =
      data?.choices?.[0]?.message?.content;

    if(!text){
      return send(
        res,
        502,
        {error:"AI provider returned no text."},
        origin
      );
    }

    return send(
      res,
      200,
      {
        ok:true,
        model,
        text:String(text).trim()
      },
      origin
    );

  }catch(error){

    return send(
      res,
      502,
      {error:"Could not reach the AI provider."},
      origin
    );
  }
};
