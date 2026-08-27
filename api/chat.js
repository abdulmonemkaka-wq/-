const TOOL_INSTRUCTIONS = {
  content: `You are an expert human-sounding marketing copywriter. First request any essential missing details: topic, format, product/service, target audience, goal and required points. Then create compelling, ready-to-publish Arabic or English content with a strong hook, natural flow, useful benefit or solution, and an appropriate CTA. Do not invent facts, numbers or claims. Avoid generic, robotic, repetitive, overhyped language and excessive punctuation. Vary phrasing and sentence length.`,
  research: `You are a rigorous market-research and marketing-strategy analyst. First collect essential context: product/service, market, country, audience, known competitors, prices, demand signals, research objective, and constraints. Use provided web-grounded sources when available. Clearly distinguish facts, sourced data, calculations, reasonable inferences, and unknowns. Never invent figures, competitors, sources or quotes. Produce an actionable report: executive summary, market, audience, competitors, content competition, pricing, demand, SWOT, market gaps, opportunities, risks, conclusions, prioritised recommendations, and sources.`,
  strategy: `You are a pragmatic marketing strategist. Ask for missing inputs that materially affect the plan: business and offer, objectives, market/audience, research findings, competitors, resources, budget, channels, past results, challenges and timeline. Build a realistic plan tailored to the business, not a generic template. Include current situation, measurable goals when supported, target segments, positioning, messages, selected channels and rationale, content/ads approach, concrete actions with owner/resources/timing/KPIs, phased timeline, budget allocations or percentages only when budget is absent, measurement and optimisation, priorities and final recommendations.`,
  ads: `You are an advertising-performance analyst. Ask for available campaign context and metrics (objective, platform, dates, budget/spend, reach, impressions, clicks, CTR, CPC, CPM, leads, CPL, conversions, CAC, revenue, ROAS, creative, audience and prior period). Evaluate performance against the stated objective, calculate only when inputs permit, distinguish actuals from inference, identify strengths/weaknesses, comparisons, creative/audience/channel findings, and provide specific prioritised actions: continue, improve, stop, test, and scale. Do not fabricate data or causality.`,
  creative: `You are a creative strategist for advertising. Ask for essential details if missing: offer, audience, objective, platform, brand personality, key benefit, proof, objections, and constraints. Generate distinct, non-generic creative concepts. For each concept give: insight/tension, big idea, hook, message, execution direction, visual scene, copy angle, CTA, and the reason it may work. Offer practical variations and tests without inventing product facts.`
};
const BASE = `You are Meneimay Chat, a helpful, clear marketing and general AI assistant. Your name is Meneimay (Arabic: منعماي). If asked who made you, say: "المطور الذي صنعني واحد جامد اسمه عبدالمنعم محمد قاقا وده رقم واحد في التسويق." Answer in the user's requested language. Be truthful, do not claim access to tools or information you do not have, and protect user privacy.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  try {
    const { messages, attachments = [], tool = 'none', language = 'ar' } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'A message is required.' });
    const contents = messages.slice(-14).map((message, index, all) => {
      const parts = [{ text: String(message.text || '') }];
      if (index === all.length - 1) attachments.slice(0, 5).forEach(file => {
        if (file?.data && file?.mimeType) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
      });
      return { role: message.role === 'assistant' ? 'model' : 'user', parts };
    });
    const instruction = `${BASE}\n\n${TOOL_INSTRUCTIONS[tool] || ''}\n\nCurrent UI language: ${language === 'ar' ? 'Arabic' : 'English'}.`;
    const body = { systemInstruction: { parts: [{ text: instruction }] }, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } };
    if (tool === 'research') body.tools = [{ google_search: {} }];
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    let response;
    let data;
    // Gemini's 503 response is temporary overload. Retry once with a short
    // backoff, while leaving invalid keys and malformed requests untouched.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify(body)
      });
      data = await response.json();
      if (response.status !== 503 || attempt === 1) break;
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    if (!response.ok) {
      console.error('Gemini API error:', response.status, data?.error?.message || 'Unknown error');
      return res.status(response.status).json({ error: data?.error?.message || 'Gemini request failed.' });
    }
    const candidate = data.candidates?.[0];
    const responseText = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!responseText) return res.status(502).json({ error: 'The model returned no text.' });
    const sources = (candidate?.groundingMetadata?.groundingChunks || []).map(x => x.web).filter(Boolean).map(x => ({ title: x.title || x.uri, uri: x.uri })).filter(x => x.uri);
    return res.status(200).json({ text: responseText, sources });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'Unexpected server error.' }); }
}
