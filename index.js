const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const SYSTEM_PROMPT = `Você é assistente de suporte interno da Conexa Saúde para equipe noturna (22h–7h).

REGRA DE HORÁRIO:
- PODE responder se o profissional/paciente iniciou o contato
- NÃO acionar tickets parados entre 22h e 6h
- A partir das 6h pode contatar profissionais

SISTEMAS: Zendesk (tickets), Pipefy (pagamentos/contestações), Google Planilhas (agenda), Planilha (controle financeiro — prazo 3 dias úteis)

PROFISSIONAIS:
- Não recebeu demonstrativo: resolver na hora
- Pagamento não caiu: planilha, não resolve na hora
- Contestação de valor: planilha, encaminhar financeiro
- Problema NF Pipefy: orientar acesso e anexo na hora
- Sem acesso Pipefy: enviar convite na hora
- Alterar/fechar agenda: verificar formulário na Planilha de Agenda (Google Sheets), executar conforme solicitação
- Encerramento de contrato: escalar supervisor

PACIENTES:
- Remarcar: resolver na hora
- Cancelar: resolver + registrar Zendesk
- Plano/convênio: responder ou ticket Zendesk para equipe do dia

FORMATO: direto, passos numerados quando necessário.
Finalizar sempre com uma das tags:
✅ Resolve agora
📋 Planilha: [o que registrar] | Prazo: 3 dias úteis
🌙 Aguardar 6h
⬆️ Escalar para supervisor`;

const histories = new Map();

function getHistory(key) {
  if (!histories.has(key)) histories.set(key, []);
  return histories.get(key);
}

function addToHistory(key, role, content) {
  const hist = getHistory(key);
  hist.push({ role, content });
  if (hist.length > 40) hist.splice(0, 2);
}

async function askClaude(historyKey, userMessage) {
  addToHistory(historyKey, "user", userMessage);
  const history = getHistory(historyKey);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: history,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const reply = data.content?.[0]?.text || "Sem resposta.";
  addToHistory(historyKey, "assistant", reply);
  return reply;
}

function formatForSlack(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "*$1*")
    .replace(/(✅ Resolve agora[^\n]*)/g, "\n✅ *Resolve agora*")
    .replace(/(📋 Planilha:[^\n]*)/g, "\n📋 $1")
    .replace(/(🌙 Aguardar[^\n]*)/g, "\n🌙 $1")
    .replace(/(⬆️ Escalar[^\n]*)/g, "\n⬆️ *$1*")
    .replace(/^(\d+)\. /gm, "\n$1. ");
}

app.message(async ({ message, say, client }) => {
  if (message.subtype || message.bot_id) return;

  const historyKey = message.thread_ts
    ? `${message.channel}_${message.thread_ts}`
    : `${message.channel}_
