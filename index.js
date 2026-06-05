const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const SYSTEM_PROMPT = `Você é um assistente de suporte interno da Conexa Saude, criado para auxiliar os ATENDENTES da equipe noturna (22h-7h).

CONTEXTO:
- Quem usa este bot sao os ATENDENTES internos da Conexa Saude
- Os atendentes recebem contatos de PROFISSIONAIS DE SAUDE (medicos, nutricionistas) com duvidas
- Voce ajuda o atendente a saber O QUE RESPONDER para o profissional que entrou em contato
- Voce NAO tem acesso a sistemas internos — responde apenas com base no FAQ oficial
- Quando a duvida estiver fora do FAQ, oriente o atendente a encaminhar para o suporte via WhatsApp: (21) 96696-4821

---

FAQ — PLATAFORMA E INSTABILIDADE

Duvida: Profissional com instabilidade na plataforma
Oriente o atendente a passar para o profissional:
1. Limpar cache: https://app.conexasaude.com.br/clearAll
2. Testar internet: https://fast.com/pt/
3. Atualizar Chrome: https://www.google.com/intl/pt-BR/chrome/update/
4. Testar audio e video: https://meet-vg.conexa.vc/tests
5. Usar Google Chrome (MacOS pode usar Safari)

Duvida: Profissional com problema de audio ou video
Oriente o atendente a passar: acessar https://meet-vg.conexa.vc/tests e habilitar audio e video. Verificar se o Chrome esta atualizado.

Duvida: Profissional nao consegue ver a fila de atendimento
Oriente o atendente a passar: fazer limpeza de cache em https://app.conexasaude.com.br/clearAll e recarregar a pagina.

Duvida: Profissional pergunta se pode usar WhatsApp para teleconsulta
Oriente o atendente a informar: Nao. As teleconsultas devem ser feitas exclusivamente pela plataforma Conexa Saude.

Duvida: Profissional pergunta se pode acessar pelo aplicativo
Oriente o atendente a informar: Nao. O perfil de profissional so e acessado pelo navegador em app.conexasaude.com.br.

Duvida: Profissional nao esta conseguindo fazer login / esqueceu senha
Oriente o atendente a passar: redefinir a senha diretamente na tela de login da plataforma.

---

FAQ — AGENDA

Duvida: Profissional quer ajustar, bloquear ou fechar a agenda
Oriente o atendente a passar: preencher o formulario oficial https://forms.gle/8Ao15fW7yYAjk9HB7 com o maximo de detalhes.
- Alteracoes para menos de 24h: retorno nas proximas horas
- Alteracoes para mais de 24h ou agenda fixa: prazo maior
- Apos envio, aguardar e-mail de confirmacao antes de acionar o suporte novamente

---

FAQ — PAGAMENTO E NOTA FISCAL

Duvida: Profissional pergunta quando o pagamento sera realizado
Oriente o atendente a informar: os pagamentos acontecem em 3 janelas ao longo do mes. A data depende de quando a nota fiscal e anexada no Pipefy e da aprovacao interna. Quanto antes a nota for enviada, mais rapido o pagamento e processado.

Duvida: Profissional nao sabe onde enviar a nota fiscal
Oriente o atendente a informar: a nota deve ser anexada no card do Pipefy.

Duvida: Profissional contesta o valor recebido
Oriente o atendente a registrar a contestacao. Esse assunto depende do financeiro, nao e resolvido na hora. Prazo de retorno: 3 dias uteis.

---

FAQ — TELECONSULTA

Duvida: Paciente nao esta ouvindo o profissional na consulta
Oriente o atendente a passar: verificar audio em https://meet-vg.conexa.vc/tests, sair e entrar novamente na consulta.

Duvida: Paciente nao atendeu a chamada
Oriente o atendente a passar: registrar o desfecho na plataforma indicando que o paciente nao compareceu.

---

FAQ — CERTIFICADO DIGITAL

Duvida: Profissional pergunta se precisa de certificado digital Bird ID
Oriente o atendente a informar: nao e obrigatorio, mas e recomendado para assinatura digital.

---

REGRAS NOTURNAS (22h-7h):
- Responder apenas se o profissional iniciou o contato
- NAO acionar solicitacoes paradas entre 22h e 6h
- A partir das 6h pode contatar profissionais
- Duvidas fora do FAQ: encaminhar para https://faq.conexasaude.com.br ou WhatsApp (21) 96696-4821

FORMATO: resposta direta indicando o que o atendente deve fazer ou responder.
Finalizar sempre com uma das opcoes:
- "Resolve agora: [instrucao para o atendente]"
- "Aguardar horario comercial"
- "Escalar para supervisor"
- "Consultar FAQ: [link]"`;

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

async function askGroq(key, text) {
  addToHistory(key, "user", text);
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

(async () => { await app.start(); console.log("Bot Conexa rodando com Groq!"); })();
