const { App } = require("@slack/bolt");
const http = require("http");

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

SOBRE A LANI:
- A Lani e sua parceira, criada pela Larissa Rocha para a equipe N1 Premium
- Lani cuida do paciente, Luna apoia o suporte PX

REGRAS NOTURNAS (22h-7h):
- Responder apenas se o profissional iniciou o contato
- NAO acionar solicitacoes paradas entre 22h e 6h

FORMATO: resposta direta e natural. Informe ao atendente o que deve fazer ou responder. Sem rotulos ou tags.

Desenvolvida por Larissa Rocha e Maria Oliveira — Conexa Saude, 2026.`;

const BOAS_VINDAS = `Oi! Eu sou a Luna 🌙

Sou a assistente de suporte PX da Conexa Saude, disponivel 24h para te ajudar durante o plantao.

Me conta a situacao que voce esta enfrentando e eu te oriento com base no FAQ oficial — rapido, direto e sem complicacao.

Posso ajudar com:
- Instabilidade na plataforma
- Agenda dos profissionais
- Pagamentos e nota fiscal
- Teleconsulta
- Certificado digital
- E muito mais!

Pode falar! 💙`;

const boasVindasEnviadas = new Set();

async function searchFAQ(query) {
  try {
    const url = `https://faq.conexasaude.com.br/api/v2/help_center/pt-br/articles/search.json?query=${encodeURIComponent(query)}&per_page=3`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    return data.results.map(article => {
      const body = (article.body || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);
      return `ARTIGO: ${article.title}\n${body}`;
    }).join("\n\n---\n\n");
  } catch (err) {
    console.error("Erro ao buscar FAQ:", err.message);
    return null;
  }
}

const histories = new Map();
function getHistory(key) {
  if (!histories.has(key)) histories.set(key, []);
  return histories.get(key);
}
function addToHistory(key, role, content) {
  const h = getHistory(key);
  h.push({ role, content });
  if (h.length > 6) h.splice(0, 2);
}

async function addReaction(client, channel, timestamp, name) {
  try {
    await client.reactions.add({ channel, timestamp, name });
  } catch (err) {
    if (err.data?.error !== "already_reacted") {
      console.error("Erro ao adicionar reação:", err.message);
    }
  }
}

async function removeReaction(client, channel, timestamp, name) {
  try {
    await client.reactions.remove({ channel, timestamp, name });
  } catch (err) {
    if (err.data?.error !== "no_reaction") {
      console.error("Erro ao remover reação:", err.message);
    }
  }
}

async function askGroq(key, text) {
  const faqContent = await searchFAQ(text);
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
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...getHistory(key),
      ],
      max_tokens: 512,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const reply = data.choices?.[0]?.message?.content || "Sem resposta.";
  addToHistory(key, "assistant", reply);
  return reply;
}

app.message(async ({ message, client }) => {
  if (message.subtype || message.bot_id) return;
  if (message.thread_ts && message.thread_ts !== message.ts) return;

  const isDM = message.channel_type === "im";
  const text = (message.text || "").replace(/<@[A-Z0-9]+>/g, "").trim();
  if (!text) return;

  if (isDM && !boasVindasEnviadas.has(message.channel)) {
    boasVindasEnviadas.add(message.channel);
    await client.chat.postMessage({ channel: message.channel, text: BOAS_VINDAS });
    return;
  }

  const key = isDM ? `dm_${message.channel}` : `${message.channel}_${message.ts}`;

  try {
    await addReaction(client, message.channel, message.ts, "hourglass_flowing_sand");
    const reply = await askGroq(key, text);
    await client.chat.postMessage({ channel: message.channel, text: reply });
    await removeReaction(client, message.channel, message.ts, "hourglass_flowing_sand");
  } catch (err) {
    await client.chat.postMessage({ channel: message.channel, text: `Erro: ${err.message}` });
  }
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

http.createServer((req, res) => res.end("Luna online!")).listen(process.env.PORT || 3000);

(async () => {
  await app.start();
  console.log("Luna rodando com boas-vindas e FAQ em tempo real!");
})();
