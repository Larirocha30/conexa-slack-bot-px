const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const SYSTEM_PROMPT = `Você é assistente de suporte interno da Conexa Saúde para equipe noturna (22h-7h).
REGRA DE HORÁRIO:
- PODE responder se o profissional/paciente iniciou o contato
- NÃO acionar tickets parados entre 22h e 6h
- A partir das 6h pode contatar profissionais
SISTEMAS: Zendesk, Pipefy, Google Planilhas, Planilha financeira (prazo 3 dias úteis)
PROFISSIONAIS:
- Não recebeu demonstrativo: resolver na hora
- Pagamento não caiu: planilha, não resolve na hora
- Contestação de valor: planilha, encaminhar financeiro
- Problema NF Pipefy: orientar acesso e anexo na hora
- Sem acesso Pipefy: enviar convite na hora
- Alterar/fechar agenda: verificar formulário na Planilha de Agenda, executar
- Encerramento de contrato: escalar supervisor
PACIENTES:
- Remarcar: resolver na hora
- Cancelar: resolver + registrar Zendesk
- Plano/convênio: responder ou ticket Zendesk para equipe do dia
FORMATO: direto, passos numerados quando necessário.
Finalizar com: checkmark Resolve agora OU Planilha: [registrar] Prazo 3 dias uteis OU Aguardar 6h OU Escalar supervisor`;

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

async function askGemini(key, text) {
  addToHistory(key, "user", text);
  const history = getHistory(key);
  const contents = history.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta.";
  addToHistory(key, "assistant", reply);
  return reply;
}

app.message(async ({ message, say, client }) => {
  if (message.subtype || message.bot_id) return;
  const key = message.thread_ts
    ? `${message.channel}_${message.thread_ts}`
    : `${message.channel}_${message.ts}`;
  const text = (message.text || "").replace(/<@[A-Z0-9]+>/g, "").trim();
  if (!text) return;
  try {
    await client.reactions.add({ channel: message.channel, timestamp: message.ts, name: "hourglass_flowing_sand" });
    const reply = await askGemini(key, text);
    await say({ text: reply, thread_ts: message.thread_ts || message.ts });
    await client.reactions.remove({ channel: message.channel, timestamp: message.ts, name: "hourglass_flowing_sand" });
  } catch (err) {
    await say({ text: `Erro: ${err.message}`, thread_ts: message.thread_ts || message.ts });
  }
});

app.event("message", async ({ event, client }) => {
  if (event.channel_type !== "im" || event.subtype || event.bot_id) return;
  const text = (event.text || "").trim();
  if (!text) return;
  try {
    await client.reactions.add({ channel: event.channel, timestamp: event.ts, name: "hourglass_flowing_sand" });
    const reply = await askGemini(`dm_${event.channel}`, text);
    await client.chat.postMessage({ channel: event.channel, text: reply });
    await client.reactions.remove({ channel: event.channel, timestamp: event.ts, name: "hourglass_flowing_sand" });
  } catch (err) {
    await client.chat.postMessage({ channel: event.channel, text: `Erro: ${err.message}` });
  }
});

(async () => { await app.start(); console.log("Bot Conexa rodando com Gemini!"); })();
