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

---

FAQ INTERNA — INFORMAÇÕES ÚTEIS

CANAIS DE CONTATO PX:
- Zenklub: profissionais@zenklub.com; premium@zenklub.com ou chat
- Conexa Saúde Mental e Saúde Física: +55 (21) 96696-4821 (Sala de atendimento)
- Conexa Saúde Mental: equipecs@psicologiaviva.com.br ou chat
- Conexa Saúde Física: +55 (11) 91474-4607 (Clari Pro)

CANAIS CX:
- Zenklub Empresas: corporativo@zenklub.com
- Zenklub Clientes: +55 (21) 99186-0605 (Clari)
- Conexa Clientes: +55 (11) 97639-6153 (Clari)

OUTROS NÚMEROS (WhatsApp):
- Conexa AI: +55 (11) 91726-1618
- Números de notificações: +55 (21) 99712-3519 / +55 (21) 99625-5086
- Hospital Conexa: +55 (11) 93054-4580
- Contato Insider (CRM): +1 (555) 842-9326
- Relacionamento médico: +55 (21) 96813-3472
- Número antigo de suporte aos médicos (NÃO USAR): +55 (11) 93210-9249

---

HOSPITAL PÚRPURA — LISTAGEM DE PSIQUIATRAS (em ordem alfabética):
- Fernanda Moraes
- Livia Rodarte
- Marcela Amancio
- Marcelo Takizawa
- Matheus Cardoso Murta Botelho
- Nayara Urtiga
- Rodrigo Pazeto
- Sidney Seabra
- Vinicius Frederico
- Vitto Carlo Silva

---

AGENDA EXTRA:
- Planilha: Pedido de Alteração - Agenda Especialistas
- E-mail Profissionais: Caixa de Entrada
- Backoffice: Usuário > Profissional
- ADMIN: Buscar pela clínica em que o profissional está cadastrado

---

BLOQUEIO DE AGENDA:
- Planilha: Pedido de Alteração - Agenda Especialistas
- Link: https://docs.google.com/spreadsheets/d/1M4EHbgMIqmGaHAXmWWPMplbo1jUnu6uAqfT6wpEa-KQ/edit?gid=1528505662
- E-mail Profissionais: Caixa de Entrada
- Backoffice: Usuário > Profissional
- ADMIN: Buscar pela clínica em que o profissional está cadastrado

---

NIP (Notificação de Intermediação Preliminar):
NIP é um sistema da ANS para resolver conflitos entre consumidores e operadoras de planos de saúde. Quando um cliente não consegue resolver um problema diretamente, registra a reclamação na NIP, que envia notificação à operadora para resposta amigável e extrajudicial.

ATENÇÃO: Para casos de NIP, como precisamos cumprir o prazo, podemos contatar o curador da especialidade via WhatsApp empresarial, pedindo que ele direcione o profissional que poderá atender, considerando a data limite.

REGRA IMPORTANTE: Só gere a macro de abordagem de NIP quando o atendente PEDIR EXPLICITAMENTE (ex: "me dá a macro de NIP", "como abordar o curador"). Se o atendente apenas perguntar quem é uma pessoa ou citar um nome, apenas identifique quem é (especialidade e contato), NÃO gere a macro completa.

Sugestão de macro de abordagem:
"Dra. [NOME], me chamo [NOME], sou analista do time de Experiência do Profissional Conexa e estou entrando em contato porque temos uma NIP que precisa ser solucionada até a data dd/mm/aaaa (colocar sempre uma data considerando o dia anterior ao prazo). Estou entrando em contato porque recebemos uma NIP que precisa ser resolvida com urgência, até dd/mm/aaaa, e contamos muito com o seu apoio para isso. Você poderia, por favor, nos ajudar verificando qual profissional da especialidade [citar especialidade] consegue assumir essa demanda? Seu retorno é essencial para garantirmos o melhor desfecho possível. Muito obrigado desde já! Ficamos no seu aguardo."

ATENÇÃO: Para nutrição em NIP, o fluxo é diferente — encaminhar direto para N2.

É necessário sempre deixar uma nota com o print do contato feito via WhatsApp, para que outro analista possa acompanhar a solicitação.

---

CURADORES POR ESPECIALIDADE (contato via WhatsApp empresarial ou email para NIP e demandas urgentes):
IMPORTANTE: O CPF é apenas para identificação interna do profissional. NUNCA oriente contato pelo CPF — o contato é feito apenas por WhatsApp ou email.
IMPORTANTE: Quando houver mais de um curador para a mesma especialidade (ex: Nutrição Clínica tem duas), informe SEMPRE todos de uma vez, não um por vez.
- Pneumologia: CYNTHIA FUNDAO PONTES SAAD — (561) 303-8677 — cpsaad98@gmail.com — CPF 038.167.857-19
- Pediatria (demais espec.): MÔNICA ANDRADE RODRIGUES — (21) 99975-6608 — rodrigues.monica@gmail.com — CPF 009.132.177-86
- Dermatologia: MARIANA ORMAY — (21) 98773-4040 — maryormay@hotmail.com — CPF 120.155.327-06
- Ginecologia: ALBERTO TAVARES DE ARAÚJO FREITAS — (21) 99500-9747 — alberto@freitas.med.br — CPF 099.102.457-52
- Ortopedia: SANDRA TIE NISHIBE MINAMOTO — (21) 97253-0053 — sandraminamoto@yahoo.com.br — CPF 329.514.638-12
- Cardiologia: NATHALIA MONERAT PINTO BLAZUTI BARRETO — +44 7383 335366 — sandraminamoto@yahoo.com.br — CPF 116.307.837-90
- Endocrinologia e Metabologia: RACHEL CARDOSO LOPES REGO — (31) 997565939 — rachel.cardoso@icloud.com — CPF 072.707.096-70
- Neuropediatria: LUIS FELIPE HABERFELD MAIA — (22) 988345890 — felipehaberfeld@gmail.com — CPF 113.874.397-66
- Psiquiatria: THIAGO GENARO — (11) 945992213 — tlgenaro@hotmail.com — CPF 307.089.518-21
- Fonoaudiologia: CAROLINA RUIZ — (21) 996468863 — avance.fono@gmail.com — CPF 073.418.407-73
- Nutrição Clínica: DANIELLE TOLEDO — (21) 99379-9154 — danielle.toledo@hotmail.com — CPF 090.320.417-70
- Nutrição Clínica: SARA SINGER — (21) 98806-9935 — personalnutri@gmail.com — CPF 025.987.937-14
- Demais especialidades (Clínica Geral, Coloproctologia, Gastroenterologia, Infectologia, Nefrologia, Neurologia, Nutrologia, Oftalmologia, Otorrinolaringologia, Reumatologia, Urologia, Medicina de Família): LUIS FELIPE HABERFELD MAIA — (22) 98834-5890 — felipehaberfeld@gmail.com — CPF 113.874.397-66

---

MÉDICOS DE ROTINA:
Os médicos de rotina são os coordenadores dos plantões. Assim como os curadores são responsáveis pelas especialidades, os médicos de rotina são responsáveis pelos plantões de clínica geral.
Para saber qual médico de rotina está de plantão, acessar o DoctorID > Escalas > Semanal > "Conexa Saúde - 001 CNX Rotinas".

Listagem de médicos de rotina:
- FERNANDA KOGA
- JULIANA SOUZA DE SEIXAS
- DAYANE MARQUES
- JÚLIA MONACO
- RAFAEL LEITE AGUILAR
- OTTO ALBUQUERQUE

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

  // Boas-vindas apenas quando a mensagem for um cumprimento
  const ehCumprimento = /^(oi|ol[áa]|opa|e a[íi]|eai|bom dia|boa tarde|boa noite|hey|hi|luna)[\s!,.?]*$/i.test(text);
  if (isDM && ehCumprimento) {
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
