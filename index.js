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

---

FAQ INTERNO DA CONEXA SAUDE (use estas informações para embasar suas respostas):

## CANAIS DE CONTATO

**PX:**
- Zenklub: profissionais@zenklub.com; premium@zenklub.com ou chat
- Conexa Saúde Mental e Saúde Física: +55 (21) 96696-4821 [Sala de atendimento]
- Conexa Saúde Mental: equipecs@psicologiaviva.com.br ou chat
- Conexa Saúde Física: +55 (11) 91474-4607 [Clari Pro]

**CX:**
- Zenklub Empresas: corporativo@zenklub.com
- Zenklub Clientes: +55 (21) 99186-0605 [Clari]
- Conexa Clientes: +55 (11) 97639-6153 [Clari]

**Outros números (WhatsApp):**
- Conexa AI: +55 (11) 91726-1618
- Números de notificações: +55 (21) 99712-3519 / +55 (21) 99625-5086
- Hospital Conexa: +55 (11) 93054-4580
- Contato Insider (CRM): +1 (555) 842-9326
- Relacionamento médico: +55 (21) 96813-3472
- ATENÇÃO: Número antigo de suporte aos médicos (NÃO USAR): +55 (11) 93210-9249

---

## COMO AGENDAR PACIENTE

Em algumas situações será necessário agendar o paciente do zero. Passos:
1. Acessar o Backoffice e clicar em "Atendimento"
2. Selecionar "Agendar Consulta"
3. Selecionar a clínica do paciente, o CPF ou o nome completo
4. Após preencher todos os dados, clicar em "Buscar"
5. Acessar a agenda do profissional e escolher o horário de acordo com a solicitação
   - Obs.: se for NIP ou encaixe e não houver data próxima, entrar em contato com o curador
6. Ao selecionar o horário, confirmar o agendamento clicando em "Sim, confirmar"
7. Após a confirmação, o paciente receberá uma notificação no e-mail sobre o agendamento

---

## BLOQUEIO DE AGENDA

- Planilha: Pedido de Alteração - Agenda Especialistas (SharePoint)
- E-mail Profissionais: Caixa de Entrada (profissionais@conexasaude.com.br)
- Backoffice: Usuário > Profissional (backoffice.conexasaude.com.br/usuario)
- ADMIN: Buscar pela clínica em que o profissional está cadastrado
- Existe também a opção de Bloqueio de agenda por tempo indeterminado (passo a passo disponível no FAQ interno)

---

## COMO FAZER UM ATIVO COM O PROFISSIONAL (via RD Conversas/Tallos)

1. Acessar o RD Conversas (https://app.tallos.com.br/app/chat/queue_wait)
2. Ir em "Contatos e Mensagens" > "Contatos"
3. Buscar pelo nome do profissional
4. Localizado o contato, clicar no ícone do bolãozinho para enviar um ativo
5. Na nova tela, clicar em "Iniciar" na parte superior
6. Selecionar o setor "Acolhimento" e clicar em "Iniciar Atendimento"
7. Irá aparecer um pop-up para enviar um template (não é possível mensagem personalizada de cara)
8. Clicar em "Enviar Template" e selecionar o template
9. Após enviar, clicar em "Atividades" na parte superior
10. Nos campos à direita, selecionar "Descrição" — se a demanda veio do Zendesk, inserir o número do ticket; se não, escrever um breve resumo
11. Selecionar "Tornar pública" e clicar em "Cadastrar Atividade"
12. Quando o profissional retornar o contato, seguir com a devida tratativa

---

## REENVIO DE DOCUMENTOS

1. Ir no BKO (Backoffice)
2. No menu lateral esquerdo, clicar em "Usuários" > "Pacientes"
3. Buscar o nome, CPF ou e-mail do paciente
4. Localizado o paciente, clicar nos 3 pontinhos e ir em "Gerar link mágico"
5. Copiar o link e colar em outra janela do navegador (para entrar no login do paciente)
6. Ir em "Consultas" > "Realizadas"
7. Localizar a consulta e clicar nela > "Anexos" > "Anexos do profissional"
8. ATENÇÃO: O status da consulta precisa estar "Concluído" — significa que o profissional preencheu o prontuário. Se estiver pendente, acionar o profissional via RD Conversas (Tallos) solicitando o envio
9. Se for feito contato ativo e o profissional retornar, copiar a demanda solicitada via ticket de CX
10. No ticket do Zendesk, responder ao paciente informando que foi solicitado o reenvio dos documentos
11. Deixar ticket com status "Em Espera" (aguardando retorno do profissional)

---

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
        .slice(0, 800);
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
  if (h.length > 40) h.splice(0, 2);
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
    await addReaction(client, message.channel, message.ts, "hourglass_flowing_sand");
    const reply = await askGroq(key, text);
    await say({ text: reply, thread_ts: message.thread_ts || message.ts });
    await removeReaction(client, message.channel, message.ts, "hourglass_flowing_sand");
  } catch (err) {
    await say({ text: `Erro: ${err.message}`, thread_ts: message.thread_ts || message.ts });
  }
});

app.event("message", async ({ event, client }) => {
  if (event.channel_type !== "im" || event.subtype || event.bot_id) return;
  const text = (event.text || "").trim();
  if (!text) return;
  try {
    if (!boasVindasEnviadas.has(event.channel)) {
      boasVindasEnviadas.add(event.channel);
      await client.chat.postMessage({
        channel: event.channel,
        text: BOAS_VINDAS,
      });
    }
    await addReaction(client, event.channel, event.ts, "hourglass_flowing_sand");
    const reply = await askGroq(`dm_${event.channel}`, text);
    await client.chat.postMessage({ channel: event.channel, text: reply });
    await removeReaction(client, event.channel, event.ts, "hourglass_flowing_sand");
  } catch (err) {
    await client.chat.postMessage({ channel: event.channel, text: `Erro: ${err.message}` });
  }
});

// Servidor HTTP para o Render nao derrubar o servico
http.createServer((req, res) => res.end("Luna online!")).listen(process.env.PORT || 3000);

(async () => {
  await app.start();
  console.log("Luna rodando com boas-vindas e FAQ em tempo real!");
})();
