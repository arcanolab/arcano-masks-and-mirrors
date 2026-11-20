// Masks & Mirrors — núcleo: guarda as formas no personagem e aplica no token.
// Regras do desenho:
//  - só a aparência muda; o ator do token nunca é trocado;
//  - a forma original é fotografada uma única vez e toda troca parte dela;
//  - cada troca é uma única atualização (imagem + anel + tamanho + estado juntos).

export const ID = "arcano-formas";

/* Idioma do módulo: segue o Foundry ou é forçado (en / pt-BR) na configuração do módulo. */
export const IDIOMAS = {auto: "AFORMAS.Idioma.auto", en: "English", "pt-BR": "Português (Brasil)"};
let dicionario = null;

/** Traduz uma chave completa ("AFORMAS.…") no idioma do módulo. */
export const traduzir = chave => {
  if ( dicionario ) {
    const v = foundry.utils.getProperty(dicionario, chave);
    if ( typeof v === "string" ) return v;
  }
  return game.i18n.localize(chave);
};

export const t = (chave, dados) => {
  let texto = traduzir(`AFORMAS.${chave}`);
  for ( const [k, v] of Object.entries(dados ?? {}) ) texto = texto.replaceAll(`{${k}}`, v);
  return texto;
};

/** Carrega o idioma escolhido na configuração. Em "auto" não faz nada. */
export async function carregarIdioma() {
  const idioma = game.settings.get(ID, "idioma");
  if ( !(idioma in IDIOMAS) || (idioma === "auto") ) return;
  try {
    const resposta = await fetch(`modules/${ID}/lang/${idioma}.json`);
    dicionario = await resposta.json();
  } catch(e) { console.warn(`${ID} | não foi possível carregar o idioma ${idioma}`, e); }
}

const emCurso = new Set();

/* ------------------------------------------------------------------ */
/*  Leitura                                                            */
/* ------------------------------------------------------------------ */

/** Personagem que guarda as formas: o ator-base, para que todas as cópias do token enxerguem as mesmas. */
export function donoDasFormas(tokenDoc) {
  if ( !tokenDoc ) return null;
  if ( tokenDoc.actorLink ) return tokenDoc.actor ?? null;
  return tokenDoc.baseActor ?? tokenDoc.actor ?? null;
}

/** Lista de formas de um personagem (cópia). */
export function formasDe(actor) {
  const lista = actor?.flags?.[ID]?.formas;
  return Array.isArray(lista) ? foundry.utils.deepClone(lista) : [];
}

/** Id da forma em uso (null = original). */
export function formaAtiva(tokenDoc) {
  const origem = tokenDoc.actorLink ? tokenDoc.actor : tokenDoc;
  return origem?.flags?.[ID]?.ativa ?? null;
}

/** Imagem da forma original, mesmo quando outra forma está em uso. */
export function imagemOriginal(tokenDoc) {
  return tokenDoc.flags?.[ID]?.base?.texture?.src ?? tokenDoc.texture.src;
}

export function podeConfigurar(actor) {
  if ( !actor ) return false;
  if ( game.user.isGM ) return true;
  return actor.isOwner && game.settings.get(ID, "jogadorConfigura");
}

function acharForma(formas, ref) {
  if ( ref === null || ref === undefined ) return null;
  const porId = formas.find(f => f.id === ref);
  if ( porId ) return porId;
  const nome = String(ref).trim().toLowerCase();
  return formas.find(f => f.nome?.trim().toLowerCase() === nome);
}

/* ------------------------------------------------------------------ */
/*  Montagem dos dados                                                 */
/* ------------------------------------------------------------------ */

/** Fotografa só os campos que o módulo altera. Serve para token colocado e para token-protótipo. */
function fotografar(tk) {
  return {
    texture: {src: tk.texture.src, scaleX: tk.texture.scaleX, scaleY: tk.texture.scaleY},
    width: tk.width,
    height: tk.height,
    ring: {subject: {texture: tk.ring?.subject?.texture ?? null, scale: tk.ring?.subject?.scale ?? 1}}
  };
}

/** Forma aplicada por cima da original. Campo vazio na forma = igual ao original. */
function montar(base, forma) {
  const escala = Number(forma.escala) > 0 ? Number(forma.escala) : null;
  const sinal = v => (Math.sign(v) || 1);
  const sujeito = base.ring.subject.texture;
  return {
    texture: {
      src: forma.img,
      scaleX: escala ? sinal(base.texture.scaleX) * escala : base.texture.scaleX,
      scaleY: escala ? sinal(base.texture.scaleY) * escala : base.texture.scaleY
    },
    width: Number(forma.largura) > 0 ? Number(forma.largura) : base.width,
    height: Number(forma.altura) > 0 ? Number(forma.altura) : base.height,
    // No v14 a textura do "sujeito" do anel dinâmico esconde a imagem do token: troca junto.
    ring: {subject: {texture: sujeito ? forma.img : sujeito, scale: base.ring.subject.scale}}
  };
}

/** Atualização de um token (ou protótipo). Devolve null quando não há o que fazer. */
function dadosDoToken(tk, forma) {
  const guardado = tk.flags?.[ID]?.base ?? null;
  if ( !forma && !guardado ) return null;
  const base = guardado ?? fotografar(tk);
  const dados = forma ? montar(base, forma) : foundry.utils.deepClone(base);
  dados.flags = {[ID]: {ativa: forma?.id ?? null, base: forma ? base : null}};
  return dados;
}

function opcoesDeAnimacao(animar) {
  const transicao = game.settings.get(ID, "transicao");
  if ( !animar || (transicao === "nenhuma") ) return {animate: false};
  return {animation: {transition: transicao, duration: game.settings.get(ID, "duracao")}};
}

async function carregar(forma) {
  try {
    const tex = await foundry.canvas.loadTexture(forma.img);
    if ( tex ) return true;
  } catch(e) { /* cai no aviso */ }
  ui.notifications.warn(t("Aviso.ImagemNaoCarrega", {forma: forma.nome, img: forma.img}));
  return false;
}

/* ------------------------------------------------------------------ */
/*  Troca                                                              */
/* ------------------------------------------------------------------ */

/**
 * Passa o token para uma forma.
 * @param {Token|TokenDocument} alvo
 * @param {string|null} ref     Id ou nome da forma; null volta à original.
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.animar=true]
 * @returns {Promise<boolean>}  true se a troca foi feita.
 */
export async function trocar(alvo, ref=null, {animar=true}={}) {
  const tokenDoc = alvo?.document ?? alvo;
  if ( !(tokenDoc instanceof foundry.documents.TokenDocument) ) return false;
  const actor = tokenDoc.actor;
  if ( !actor ) { ui.notifications.warn(t("Aviso.SemAtor")); return false; }
  if ( !tokenDoc.isOwner ) { ui.notifications.warn(t("Aviso.SemPermissao")); return false; }

  const formas = formasDe(donoDasFormas(tokenDoc));
  const forma = acharForma(formas, ref);
  if ( (ref !== null) && (ref !== undefined) && !forma ) {
    ui.notifications.warn(t("Aviso.FormaNaoExiste", {forma: ref}));
    return false;
  }

  const trava = tokenDoc.actorLink ? actor.uuid : tokenDoc.uuid;
  if ( emCurso.has(trava) ) return false;
  emCurso.add(trava);
  try {
    if ( forma && !(await carregar(forma)) ) return false;
    const opcoes = opcoesDeAnimacao(animar);

    // Token sem vínculo: só ele muda.
    if ( !tokenDoc.actorLink ) {
      const dados = dadosDoToken(tokenDoc, forma);
      if ( dados ) await tokenDoc.update(dados, opcoes);
      return true;
    }

    // Token vinculado: a forma é do personagem. Mudam os tokens dele nesta cena,
    // o retrato e o protótipo (para que um token arrastado depois já venha na forma certa).
    const cena = tokenDoc.parent;
    const lote = [];
    for ( const tk of cena.tokens ) {
      if ( !tk.actorLink || (tk.actorId !== actor.id) ) continue;
      const dados = dadosDoToken(tk, forma);
      if ( dados ) lote.push({_id: tk.id, ...dados});
    }
    if ( lote.length ) await cena.updateEmbeddedDocuments("Token", lote, opcoes);
    await atualizarPersonagem(actor, forma);
    return true;
  } finally {
    emCurso.delete(trava);
  }
}

async function atualizarPersonagem(actor, forma) {
  const guardado = actor.flags?.[ID]?.base ?? null;
  if ( !forma && !guardado ) return;
  const base = guardado ?? {img: actor.img};
  const dados = {
    img: forma ? (forma.retrato || base.img) : base.img,
    flags: {[ID]: {ativa: forma?.id ?? null, base: forma ? base : null}}
  };
  // Protótipo com imagem sorteada (curinga) fica como está; o token novo é acertado ao ser criado.
  if ( !actor.prototypeToken.randomImg ) {
    const proto = dadosDoToken(actor.prototypeToken, forma);
    if ( proto ) dados.prototypeToken = proto;
  }
  await actor.update(dados);
}

/** Próxima forma da lista; depois da última volta à original. */
export async function proxima(alvo, opcoes) {
  const tokenDoc = alvo?.document ?? alvo;
  const formas = formasDe(donoDasFormas(tokenDoc));
  if ( !formas.length ) {
    ui.notifications.info(t("Aviso.SemFormas", {nome: tokenDoc?.name ?? ""}));
    return false;
  }
  const i = formas.findIndex(f => f.id === formaAtiva(tokenDoc));
  const seguinte = formas[i + 1] ?? null;
  return trocar(tokenDoc, seguinte?.id ?? null, opcoes);
}

/* ------------------------------------------------------------------ */
/*  Manutenção                                                         */
/* ------------------------------------------------------------------ */

/**
 * Acerta um token vinculado cujo estado ficou diferente do personagem
 * (token de outra cena, ou recém-arrastado). Não anima.
 */
export async function acertar(tokenDoc) {
  if ( !tokenDoc?.actorLink || !tokenDoc.actor || !tokenDoc.isOwner ) return;
  const quer = tokenDoc.actor.flags?.[ID]?.ativa ?? null;
  const tem = tokenDoc.flags?.[ID]?.ativa ?? null;
  if ( quer === tem ) return;
  const forma = acharForma(formasDe(tokenDoc.actor), quer);
  if ( forma && !(await carregar(forma)) ) return;
  const dados = dadosDoToken(tokenDoc, forma ?? null);
  if ( dados ) await tokenDoc.update(dados, {animate: false});
}

/** Grava a lista de formas e reaplica nos tokens da cena aberta que usam uma forma editada ou removida. */
export async function salvarFormas(actor, lista) {
  await actor.update({[`flags.${ID}.formas`]: lista});
  const cena = canvas?.scene;
  if ( !cena ) return;
  let vinculadoFeito = false;
  for ( const tk of cena.tokens ) {
    if ( tk.actorId !== actor.id ) continue;
    const ativa = formaAtiva(tk);
    if ( !ativa ) continue;
    if ( tk.actorLink ) {
      if ( vinculadoFeito ) continue;
      vinculadoFeito = true;
    }
    const existe = lista.some(f => f.id === ativa);
    await trocar(tk, existe ? ativa : null, {animar: false});
  }
}
