const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const SYSTEM_PROMPT = `Você é a Luna, assistente de suporte interno da Conexa Saude, criada para auxiliar os ATENDENTES da equipe de suporte PX, disponivel 24h.

CONTEXTO:
- Quem usa este bot sao os ATENDENTES internos da Conexa Saude
- Os atendentes recebem contatos de PROFISSIONAIS DE SAUDE (medicos, nutricionistas) com duvidas
- Voce ajuda o atendente a saber O QUE RESPONDER ao profissional
- Voce recebe trechos do FAQ oficial da Conexa Saude para embasar suas respostas
- Se o FAQ nao tiver a informacao, oriente encaminhar para WhatsApp (21) 96696-4821 ou https://faq.conexasaude.com.br

SOBRE A LANI (sua parceira):
- A Lani e sua parceira na Conexa Saude
- Ela foi criada pela Larissa Rocha para a equipe N1 Premium
- Foco no atendimento ao paciente — respostas empaticas e humanizadas
- Juntas cobrem toda a jornada: Lani cuida do paciente, Luna apoia o suporte noturno

REGRAS NOTURNAS (22h-7h):
- Responder apenas se o profissional iniciou o contato
- NAO acionar solicitacoes paradas entre 22h e 6h
- A partir das 6h pode contatar profissionais

FORMATO: resposta direta e natural. Informe ao atendente o que deve fazer ou responder. Sem rotulos ou tags.

Desenvolvida por Larissa Rocha e Maria Vitoria — Conexa Saude, 2026.`;

// ─── BUSCA NO FAQ ───────────────────────────────────────────
async function searchFAQ(query) {
  try {
    const url = `https://faq.conexasaude.com.br/api/v2/help_center/pt-br/articles/search.json?query=${encodeURIComponent(query)}&per_page=3`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.results || data.results.length === 0) return null;

    return data.results.map(article => {
      // Remove HTML tags do corpo
      const body = (article.body || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 800);
      return `ARTIGO: ${article.title}\n${body}`;
    }).join("\n\n---\n\n");
  } catch (err) {
    console.error("Erro ao buscar FAQ:", err.message);
    return null;
  }
}

// ─── HISTÓRICO ──────────────────────────────────────────────
const histories = new Map();
function getHistory(key) {
  if (!histories.has(key)) histories.set(key, []);
  return histories.get(key);
}
function addToHistory(key, role, content) {
  const h = getHistory(key);
  h.push({ role, content });
  if (h.length > 40) h.splice(0, 2);
}

// ─── GROQ + FAQ ─────────────────────────────────────────────
async function askGroq(key, text) {
  // Busca artigos relevantes no FAQ
  const faqContent = await searchFAQ(text);

  // Monta mensagem com contexto do FAQ
  const userMessage = faqContent
    ? `PERGUNTA DO ATENDENTE: ${text}\n\nINFORMAÇÕES DO FAQ OFICIAL:\n${faqContent}`
    : text;

  addToHistory(key, "user", userMessage);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...getHistory(key),
      ],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const reply = data.choices?.[0]?.message?.content || "Sem resposta.";
  addToHistory(key, "assistant", reply);
  return reply;
}

// ─── HANDLER CANAL ──────────────────────────────────────────
app.message(async ({ message, say, client }) => {
  if (message.subtype || message.bot_id) return;
  const key = message.thread_ts
    ? `${message.channel}_${message.thread_ts}`
    : `${message.channel}_${message.ts}`;
  const text = (message.text || "").replace(/<@[A-Z0-9]+>/g, "").trim();
  if (!text) return;
  try {
    await client.reactions.add({ channel: message.channel, timestamp: message.ts, name: "hourglass_flowing_sand" });
    const reply = await askGroq(key, text);
    await say({ text: reply, thread_ts: message.thread_ts || message.ts });
    await client.reactions.remove({ channel: message.channel, timestamp: message.ts, name: "hourglass_flowing_sand" });
  } catch (err) {
    await say({ text: `Erro: ${err.message}`, thread_ts: message.thread_ts || message.ts });
  }
});

// ─── HANDLER DM ─────────────────────────────────────────────
app.event("message", async ({ event, client }) => {
  if (event.channel_type !== "im" || event.subtype || event.bot_id) return;
  const text = (event.text || "").trim();
  if (!text) return;
  try {
    await client.reactions.add({ channel: event.channel, timestamp: event.ts, name: "hourglass_flowing_sand" });
    const reply = await askGroq(`dm_${event.channel}`, text);
    await client.chat.postMessage({ channel: event.channel, text: reply });
    await client.reactions.remove({ channel: event.channel, timestamp: event.ts, name: "hourglass_flowing_sand" });
  } catch (err) {
    await client.chat.postMessage({ channel: event.channel, text: `Erro: ${err.message}` });
  }
});

(async () => { await app.start(); console.log("Luna rodando com FAQ em tempo real!"); })();
