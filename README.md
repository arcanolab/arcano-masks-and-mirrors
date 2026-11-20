# Arcano Masks & Mirrors

*by [Arcano Lab](https://www.patreon.com/arcanolab) · Foundry VTT v14*

One token, many faces. Save as many looks as you want on a character and switch between them in a click: wild shapes, disguises, a wounded version, a mount. Only the appearance changes. The actor and its sheet are never swapped, so nothing breaks.

## Features
- **Saved forms per character** — token image, optional portrait, width × height and scale. Blank size fields stay the same as the original.
- **Token HUD button** — a palette with a thumbnail for each form; the first one is always the original.
- **Shift + click** a token to move to the next form (can be turned off).
- **Animated transition** — 13 Foundry effects, or none, with adjustable duration.
- **The original is always recoverable** — it is captured once and every switch starts from it, so sizes never stack.
- **Linked tokens** (player characters) change every token of that character in the scene, the portrait and the prototype token. **Unlinked tokens** (NPCs) change one at a time.
- **Players can set up their own forms**, or only switch between the ones the GM created.
- Works with dynamic token rings.
- **Module language** — follow Foundry, English or Português (Brasil).

## How to use
1. Right-click a token and press the mask button on the HUD.
2. Press the gear to open the forms window, add a form and pick its image.
3. Click a thumbnail to switch. Or hold Shift and click the token.

Keybindings "Next form" and "Back to original form" are available under Configure Controls (no key by default).

## Macro
```js
const api = game.modules.get("arcano-formas").api;
api.trocar(token, "Bull");   // form name or id
api.original(token);         // back to the original
api.proxima(token);          // next form in the list
api.editar(token.actor);     // open the forms window
```

## Requirements
- Foundry VTT v14. Works with any game system.

## Install
Paste the manifest link from the Arcano Lab Patreon post (or the Arcano Hub) into **Add-on Modules → Install Module → Manifest URL**.

---

## Português
Um token, várias caras. Guarde quantas formas quiser no personagem (imagem, retrato, tamanho e escala) e troque com um clique no botão da máscara do HUD ou com **Shift + clique** no token. Só a aparência muda: a ficha nunca é trocada, e a forma original fica sempre guardada. Idioma do módulo: seguir o Foundry, English ou Português (Brasil).

© Arcano Lab — see LICENSE.
