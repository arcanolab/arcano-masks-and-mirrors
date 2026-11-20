// Masks & Mirrors — botão no HUD do token e janela de configuração.

import {
  ID, t, donoDasFormas, formasDe, formaAtiva, imagemOriginal, podeConfigurar, trocar, salvarFormas
} from "./formas.mjs";

const esc = v => Handlebars.escapeExpression(v ?? "");
const ehVideo = src => /\.(webm|mp4|m4v|ogv)(\?.*)?$/i.test(src ?? "");
const miniatura = (src, classe) => ehVideo(src)
  ? `<video class="${classe}" src="${esc(src)}" muted loop autoplay playsinline></video>`
  : `<img class="${classe}" src="${esc(src)}" alt="">`;

/* ------------------------------------------------------------------ */
/*  Assinatura Arcano Lab                                              */
/* ------------------------------------------------------------------ */

const PATREON = "https://www.patreon.com/arcanolab";
const LOGO = `modules/${ID}/assets/arcanolab.svg`;

/** Assinatura Arcano Lab com link do Patreon (janela das formas e configurações do módulo). */
export const assinaturaHTML = () => `
  <footer class="aformas-assinatura">
    <div class="aformas-marca">
      <img src="${LOGO}" alt="Arcano Lab">
      <div>
        <strong>Arcano Masks &amp; Mirrors</strong>
        <span>${esc(t("Assinatura.by"))}</span>
        <em>${esc(t("Assinatura.tagline"))}</em>
      </div>
    </div>
    <a class="aformas-patreon" href="${PATREON}" target="_blank" rel="noopener">
      <i class="fa-brands fa-patreon"></i> ${esc(t("Assinatura.cta"))}
    </a>
  </footer>`;

export function assinarConfiguracoes(app, elemento) {
  const raiz = elemento instanceof HTMLElement ? elemento : elemento?.[0];
  const campo = raiz?.querySelector(`[name="${ID}.transicao"]`);
  if ( !campo ) return;
  const caixa = campo.closest(".tab[data-tab]") ?? campo.closest("section") ?? campo.closest(".form-group")?.parentElement;
  if ( !caixa || caixa.querySelector(".aformas-assinatura") ) return;
  const div = document.createElement("div");
  div.className = "aformas aformas-cfg-assinatura";
  div.innerHTML = assinaturaHTML();
  caixa.append(div);
}

/* ------------------------------------------------------------------ */
/*  HUD                                                                */
/* ------------------------------------------------------------------ */

export function aoDesenharHUD(hud, html) {
  const raiz = html instanceof HTMLElement ? html : html?.[0];
  const tokenDoc = hud.document;
  if ( !raiz || !tokenDoc?.actor || !tokenDoc.isOwner ) return;
  const dono = donoDasFormas(tokenDoc);
  const formas = formasDe(dono);
  const configura = podeConfigurar(dono);
  if ( !formas.length && !configura ) return;

  raiz.querySelectorAll(".aformas").forEach(el => el.remove());
  const coluna = raiz.querySelector(".col.right");
  if ( !coluna ) return;

  const ativa = formaAtiva(tokenDoc);
  const item = (id, nome, src) => `
    <a class="aformas-item ${id === ativa ? "ativa" : ""}" data-forma="${esc(id ?? "")}" data-tooltip-text="${esc(nome)}">
      ${miniatura(src, "aformas-mini")}
    </a>`;
  const itens = [item(null, t("Original"), imagemOriginal(tokenDoc))];
  for ( const f of formas ) itens.push(item(f.id, f.nome, f.img));
  if ( configura ) itens.push(`
    <a class="aformas-item aformas-cfg" data-configurar data-tooltip-text="${esc(t("Configurar"))}">
      <i class="fa-solid fa-gear" inert></i>
    </a>`);

  coluna.insertAdjacentHTML("beforeend", `
    <button type="button" class="control-icon aformas" data-action="togglePalette" data-palette="aformas"
            data-tooltip aria-label="${esc(t("Botao"))}">
      <i class="aformas-icone" inert></i>
    </button>
    <div class="palette aformas aformas-paleta" data-palette="aformas">${itens.join("")}</div>`);

  const paleta = coluna.querySelector(".aformas-paleta");
  paleta.addEventListener("click", async ev => {
    const alvo = ev.target.closest(".aformas-item");
    if ( !alvo ) return;
    ev.preventDefault();
    ev.stopPropagation();
    if ( "configurar" in alvo.dataset ) return abrirEditor(dono);
    const feito = await trocar(tokenDoc, alvo.dataset.forma || null);
    if ( !feito ) return;
    paleta.querySelectorAll(".aformas-item").forEach(el => el.classList.toggle("ativa", el === alvo));
  });
}

/* ------------------------------------------------------------------ */
/*  Editor                                                             */
/* ------------------------------------------------------------------ */

const {ApplicationV2} = foundry.applications.api;

export class EditorFormas extends ApplicationV2 {
  constructor(actor, opcoes={}) {
    super({id: `aformas-editor-${actor.id}`, ...opcoes});
    this.actor = actor;
    this.lista = formasDe(actor);
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["aformas", "aformas-editor", "standard-form"],
    window: {icon: "aformas-icone", resizable: true, contentClasses: ["standard-form"]},
    position: {width: 580, height: "auto"},
    form: {handler: EditorFormas.#aoSalvar, closeOnSubmit: true, submitOnChange: false},
    actions: {
      adicionar: EditorFormas.#aoAdicionar,
      remover: EditorFormas.#aoRemover
    }
  };

  get title() {
    return t("TituloEditor", {nome: this.actor.name});
  }

  async _renderHTML() {
    const linhas = this.lista.map(f => `
      <fieldset class="aformas-linha" data-id="${esc(f.id)}">
        <legend>${esc(f.nome)}</legend>
        <div class="aformas-previa">${miniatura(f.img || "icons/svg/mystery-man.svg", "aformas-mini")}</div>
        <div class="aformas-campos">
          <div class="form-group">
            <label>${esc(t("Nome"))}</label>
            <div class="form-fields"><input type="text" data-campo="nome" value="${esc(f.nome)}"></div>
          </div>
          <div class="form-group">
            <label>${esc(t("Imagem"))}</label>
            <div class="form-fields">
              <file-picker data-campo="img" name="img-${esc(f.id)}" type="imagevideo" value="${esc(f.img)}"></file-picker>
            </div>
          </div>
          <div class="form-group">
            <label>${esc(t("Retrato"))}</label>
            <div class="form-fields">
              <file-picker data-campo="retrato" name="retrato-${esc(f.id)}" type="image" value="${esc(f.retrato)}"></file-picker>
            </div>
          </div>
          <div class="form-group aformas-medidas">
            <label>${esc(t("Largura"))} × ${esc(t("Altura"))} · ${esc(t("Escala"))}</label>
            <div class="form-fields">
              <input type="number" data-campo="largura" min="0.25" step="0.25" placeholder="${esc(t("Manter"))}" value="${esc(f.largura)}">
              <span>×</span>
              <input type="number" data-campo="altura" min="0.25" step="0.25" placeholder="${esc(t("Manter"))}" value="${esc(f.altura)}">
              <span>·</span>
              <input type="number" data-campo="escala" min="0.2" max="3" step="0.05" placeholder="${esc(t("Manter"))}" value="${esc(f.escala)}">
            </div>
          </div>
        </div>
        <button type="button" class="aformas-remover icon fa-solid fa-trash" data-action="remover"
                data-tooltip aria-label="${esc(t("Remover"))}"></button>
      </fieldset>`).join("");

    const caixa = document.createElement("div");
    caixa.className = "aformas-corpo";
    caixa.innerHTML = `
      <div class="aformas-lista">
        ${linhas || `<p class="aformas-vazio">${esc(t("Vazio"))}</p>`}
      </div>
      <p class="hint">${esc(t("DicaTamanho"))}</p>
      <footer class="form-footer">
        <button type="button" data-action="adicionar"><i class="fa-solid fa-plus" inert></i> ${esc(t("Adicionar"))}</button>
        <button type="submit"><i class="fa-solid fa-floppy-disk" inert></i> ${esc(t("Salvar"))}</button>
      </footer>
      ${assinaturaHTML()}`;
    return caixa;
  }

  _replaceHTML(resultado, conteudo) {
    conteudo.replaceChildren(resultado);
    // Miniatura acompanha a imagem escolhida.
    conteudo.querySelectorAll('.aformas-linha [data-campo="img"]').forEach(campo => {
      campo.addEventListener("change", () => {
        const previa = campo.closest(".aformas-linha").querySelector(".aformas-previa");
        previa.innerHTML = miniatura(campo.value || "icons/svg/mystery-man.svg", "aformas-mini");
      });
    });
  }

  /** Lê o que está digitado na janela para this.lista. */
  #ler() {
    const numero = v => (Number(v) > 0 ? Number(v) : null);
    this.lista = Array.from(this.element.querySelectorAll(".aformas-linha")).map(linha => {
      const campo = nome => linha.querySelector(`[data-campo="${nome}"]`)?.value ?? "";
      return {
        id: linha.dataset.id,
        nome: String(campo("nome")).trim() || t("NomePadrao"),
        img: String(campo("img")).trim(),
        retrato: String(campo("retrato")).trim(),
        largura: numero(campo("largura")),
        altura: numero(campo("altura")),
        escala: numero(campo("escala"))
      };
    });
  }

  static #aoAdicionar() {
    this.#ler();
    this.lista.push({
      id: foundry.utils.randomID(), nome: t("NomePadrao"), img: "", retrato: "",
      largura: null, altura: null, escala: null
    });
    return this.render();
  }

  static #aoRemover(evento, alvo) {
    this.#ler();
    const id = alvo.closest(".aformas-linha")?.dataset.id;
    this.lista = this.lista.filter(f => f.id !== id);
    return this.render();
  }

  static async #aoSalvar() {
    this.#ler();
    const validas = [];
    for ( const f of this.lista ) {
      if ( f.img ) validas.push(f);
      else ui.notifications.warn(t("Aviso.SemImagem", {forma: f.nome}));
    }
    await salvarFormas(this.actor, validas);
    canvas.hud?.token?.rendered && canvas.hud.token.render();
  }
}

export function abrirEditor(actor) {
  if ( !podeConfigurar(actor) ) {
    ui.notifications.warn(t("Aviso.SemPermissao"));
    return null;
  }
  const app = new EditorFormas(actor);
  app.render({force: true});
  return app;
}
