// Arcano Masks & Mirrors — registro de configurações, teclas, ganchos e API.

import * as nucleo from "./formas.mjs";
import {aoDesenharHUD, abrirEditor, assinarConfiguracoes} from "./interface.mjs";

const {ID, t} = nucleo;

const TRANSICOES = [
  "nenhuma", "fade", "swirl", "waterDrop", "morph", "crosshatch", "wind", "waves",
  "whiteNoise", "hologram", "hole", "holeSwirl", "glitch", "dots"
];

/** Traduz nome, dica e opções das configurações e das teclas no idioma do módulo. */
function renomearConfiguracoes() {
  const renomear = item => {
    if ( item._afNome === undefined ) { item._afNome = item.name; item._afDica = item.hint; }
    item.name = item._afNome ? nucleo.traduzir(item._afNome) : item._afNome;
    item.hint = item._afDica ? nucleo.traduzir(item._afDica) : item._afDica;
  };
  for ( const [id, cfg] of game.settings.settings ) if ( id.startsWith(`${ID}.`) ) renomear(cfg);
  for ( const [id, tecla] of game.keybindings.actions ) if ( id.startsWith(`${ID}.`) ) renomear(tecla);
  const transicao = game.settings.settings.get(`${ID}.transicao`);
  if ( transicao ) transicao.choices = Object.fromEntries(TRANSICOES.map(k => [k, t(`Transicao.${k}`)]));
  const idioma = game.settings.settings.get(`${ID}.idioma`);
  if ( idioma ) idioma.choices = {...nucleo.IDIOMAS, auto: t("Idioma.auto")};
}

/**
 * Shift + clique no token passa para a próxima forma.
 * Só vale para token do próprio usuário que tenha formas; nos outros o Shift continua
 * somando o token à seleção. A troca acontece ao soltar o botão, então Shift + arrastar não troca.
 */
function instalarShiftClique() {
  const Token = foundry.canvas.placeables.Token;
  const clique = Token.prototype._onClickLeft;
  const soltar = Token.prototype._onUnclickLeft;
  const vale = (token, evento) => evento.shiftKey && game.settings.get(ID, "shiftClique")
    && token.document.isOwner && (nucleo.formasDe(nucleo.donoDasFormas(token.document)).length > 0);

  Token.prototype._onClickLeft = function(evento) {
    if ( !vale(this, evento) ) return clique.call(this, evento);
    this.layer.hud?.close();
    evento.interactionData.aformasTrocar = true;
    evento.stopPropagation();
  };
  Token.prototype._onUnclickLeft = function(evento) {
    if ( !evento.interactionData?.aformasTrocar ) return soltar.call(this, evento);
    evento.interactionData.aformasTrocar = false;
    evento.stopPropagation();
    nucleo.proxima(this).catch(e => console.error(`${ID} |`, e));
  };
}

Hooks.once("init", () => {
  game.settings.register(ID, "idioma", {
    name: "AFORMAS.Config.Idioma",
    hint: "AFORMAS.Config.IdiomaDica",
    scope: "client",
    config: true,
    type: String,
    default: "auto",
    choices: nucleo.IDIOMAS,
    requiresReload: true
  });
  game.settings.register(ID, "transicao", {
    name: "AFORMAS.Config.Transicao",
    hint: "AFORMAS.Config.TransicaoDica",
    scope: "world",
    config: true,
    type: String,
    default: "morph",
    choices: Object.fromEntries(TRANSICOES.map(k => [k, `AFORMAS.Transicao.${k}`]))
  });
  game.settings.register(ID, "duracao", {
    name: "AFORMAS.Config.Duracao",
    scope: "world",
    config: true,
    type: Number,
    default: 700,
    range: {min: 100, max: 3000, step: 50}
  });
  game.settings.register(ID, "jogadorConfigura", {
    name: "AFORMAS.Config.JogadorConfigura",
    hint: "AFORMAS.Config.JogadorConfiguraDica",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(ID, "shiftClique", {
    name: "AFORMAS.Config.ShiftClique",
    hint: "AFORMAS.Config.ShiftCliqueDica",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  instalarShiftClique();

  const selecionados = () => canvas.tokens?.controlled ?? [];
  game.keybindings.register(ID, "proxima", {
    name: "AFORMAS.Tecla.Proxima",
    hint: "AFORMAS.Tecla.ProximaDica",
    editable: [],
    onDown: () => {
      for ( const tk of selecionados() ) nucleo.proxima(tk);
      return selecionados().length > 0;
    }
  });
  game.keybindings.register(ID, "original", {
    name: "AFORMAS.Tecla.Original",
    editable: [],
    onDown: () => {
      for ( const tk of selecionados() ) nucleo.trocar(tk, null);
      return selecionados().length > 0;
    }
  });

  game.modules.get(ID).api = {
    /** api.trocar(token, "Nome ou id da forma") — null volta à original. */
    trocar: nucleo.trocar,
    original: (alvo, opcoes) => nucleo.trocar(alvo, null, opcoes),
    proxima: nucleo.proxima,
    formas: actor => nucleo.formasDe(actor),
    ativa: alvo => nucleo.formaAtiva(alvo?.document ?? alvo),
    salvarFormas: nucleo.salvarFormas,
    editar: abrirEditor
  };
});

Hooks.once("i18nInit", async () => {
  renomearConfiguracoes();
  await nucleo.carregarIdioma();
  renomearConfiguracoes();
});

Hooks.on("renderTokenHUD", aoDesenharHUD);
Hooks.on("renderSettingsConfig", assinarConfiguracoes);

// Token vinculado arrastado de novo, ou deixado em outra cena, acompanha a forma do personagem.
Hooks.on("createToken", (tokenDoc, opcoes, idUsuario) => {
  if ( idUsuario !== game.user.id ) return;
  nucleo.acertar(tokenDoc).catch(e => console.error(`${ID} |`, e));
});

Hooks.on("canvasReady", async () => {
  if ( !game.users.activeGM?.isSelf ) return;
  for ( const tk of canvas.scene?.tokens ?? [] ) {
    try { await nucleo.acertar(tk); }
    catch(e) { console.error(`${ID} |`, e); }
  }
});

Hooks.once("ready", () => console.log(`${ID} | ${t("Botao")} — pronto`));
