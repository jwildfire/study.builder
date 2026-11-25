// study.builder's look. Every colour and font is a custom property on `.sb`,
// so a page that hosts the widget can set its own: `.sb { --sb-accent: … }`.

export const STYLE_ID = 'study-builder-styles';

export const STYLES = `
.sb{--sb-bg:transparent;--sb-card:#fff;--sb-ink:#1f2328;--sb-soft:#5b6470;--sb-line:#cfd3cf;--sb-rule:#e4e6e3;--sb-accent:#6c3270;--sb-on-accent:#fff;--sb-warn:#9a5b00;--sb-warn-bg:#fdf3e1;--sb-bad:#a12a2a;--sb-ok:#2d6a3e;--sb-mono:ui-monospace,"IBM Plex Mono",SFMono-Regular,Menlo,monospace;--sb-sans:inherit;box-sizing:border-box;color:var(--sb-ink);background:var(--sb-bg);font-family:var(--sb-sans);font-size:1rem;line-height:1.5;max-width:72rem}
@media (prefers-color-scheme:dark){.sb:not([data-theme=light]){--sb-card:#1c2226;--sb-ink:#e8e6e1;--sb-soft:#9aa5ab;--sb-line:#3a4349;--sb-rule:#2f373c;--sb-accent:#d9a3dd;--sb-on-accent:#1c2226;--sb-warn:#ffb866;--sb-warn-bg:#3a2a14;--sb-bad:#f09a9a;--sb-ok:#7fcf95}}
.sb[data-theme=dark]{--sb-card:#1c2226;--sb-ink:#e8e6e1;--sb-soft:#9aa5ab;--sb-line:#3a4349;--sb-rule:#2f373c;--sb-accent:#d9a3dd;--sb-on-accent:#1c2226;--sb-warn:#ffb866;--sb-warn-bg:#3a2a14;--sb-bad:#f09a9a;--sb-ok:#7fcf95}
.sb *,.sb *::before,.sb *::after{box-sizing:border-box}
.sb h2{margin:0 0 .3rem;font-size:1.35rem;font-weight:600;line-height:1.2}
.sb h3{margin:1.6rem 0 .5rem;font:600 .72rem/1.2 var(--sb-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--sb-soft)}
.sb p{margin:0 0 .8rem}
.sb-pitch{color:var(--sb-soft);max-width:60rem}
.sb-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(12rem,1fr));gap:.8rem 1rem;padding:1rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px}
.sb-field{display:flex;flex-direction:column;gap:.3rem;min-width:0}
.sb-label{font:500 .68rem/1.2 var(--sb-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--sb-soft)}
.sb-hint{font-size:.74rem;line-height:1.3;color:var(--sb-soft)}
.sb-input{width:100%;padding:.36rem .5rem;border:1px solid var(--sb-line);border-radius:8px;background:var(--sb-card);color:var(--sb-ink);font:inherit;font-family:var(--sb-mono);font-size:.82rem}
.sb-input:focus-visible,.sb-button:focus-visible,.sb-card:focus-visible{outline:2px solid var(--sb-accent);outline-offset:2px}
.sb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.6rem;margin:0;padding:0;list-style:none}
.sb-card{display:flex;flex-direction:column;gap:.25rem;padding:.7rem .8rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px;min-width:0}
.sb-card[data-on=false]{opacity:.62}
.sb-card[data-open=true]{border-color:var(--sb-accent);box-shadow:0 0 0 1px var(--sb-accent)}
.sb-card-head{display:flex;align-items:center;gap:.5rem}
.sb-card-head input{margin:0;width:1rem;height:1rem;accent-color:var(--sb-accent)}
.sb-card-name{font-weight:600;min-width:0;overflow-wrap:anywhere}
.sb-card-id{margin-left:auto;font:500 .68rem/1 var(--sb-mono);color:var(--sb-soft);white-space:nowrap}
.sb-card-grain{font-size:.8rem;line-height:1.35;color:var(--sb-soft)}
.sb-card-foot{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem;margin-top:auto;padding-top:.3rem}
.sb-tag{font:500 .64rem/1 var(--sb-mono);letter-spacing:.04em;text-transform:uppercase;padding:.22rem .4rem;border-radius:999px;border:1px solid var(--sb-line);color:var(--sb-soft);white-space:nowrap}
.sb-tag[data-kind=large]{color:var(--sb-warn);border-color:var(--sb-warn)}
.sb-rows{font:600 .78rem/1 var(--sb-mono);color:var(--sb-ok);white-space:nowrap}
.sb-button{appearance:none;display:inline-flex;align-items:center;gap:.4em;font:500 .7rem/1 var(--sb-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--sb-ink);background:var(--sb-card);border:1px solid var(--sb-line);border-radius:999px;padding:.45rem .8rem;cursor:pointer}
.sb-button:hover{color:var(--sb-accent);border-color:var(--sb-accent)}
.sb-button:disabled{opacity:.55;cursor:default}
.sb-button[data-kind=primary]{color:var(--sb-on-accent);background:var(--sb-accent);border-color:var(--sb-accent)}
.sb-button[data-kind=primary]:hover{color:var(--sb-on-accent);opacity:.88}
.sb-button[data-kind=small]{padding:.3rem .55rem;font-size:.64rem;margin-left:auto}
.sb-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:1rem 0}
.sb-status{color:var(--sb-soft);font-size:.9rem}
.sb-spin{display:inline-block;width:.8rem;height:.8rem;margin-right:.4rem;vertical-align:-.1rem;border:2px solid var(--sb-line);border-top-color:var(--sb-accent);border-radius:50%;animation:sb-turn .8s linear infinite}
@keyframes sb-turn{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sb-spin{animation:none}}
.sb-box{padding:.8rem 1rem;margin:0 0 1rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px}
.sb-box[data-kind=problem]{border-left:3px solid var(--sb-bad)}
.sb-box[data-kind=note]{background:var(--sb-warn-bg);border-color:var(--sb-warn);color:var(--sb-ink)}
.sb-box ul,.sb-list{margin:0;padding-left:1.15rem}
.sb-list{color:var(--sb-soft);font-size:.86rem}
.sb-list li{margin:.2rem 0}
.sb-detail{padding:1rem;margin:1rem 0;background:var(--sb-card);border:1px solid var(--sb-accent);border-radius:10px;min-width:0}
.sb-detail-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.6rem;margin:0 0 .2rem}
.sb-detail-head h4{margin:0;font-size:1.05rem}
.sb-detail-meta{color:var(--sb-soft);font-size:.85rem}
.sb-detail h5{margin:1rem 0 .4rem;font:600 .68rem/1.2 var(--sb-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--sb-soft)}
.sb-scroll{overflow:auto;max-height:22rem;border:1px solid var(--sb-rule);border-radius:8px}
.sb-table{border-collapse:collapse;width:100%;font-size:.8rem}
.sb-table th,.sb-table td{text-align:left;vertical-align:top;padding:.3rem .6rem;border-bottom:1px solid var(--sb-rule);white-space:nowrap}
.sb-table th{position:sticky;top:0;background:var(--sb-card);font:600 .68rem/1.3 var(--sb-mono);color:var(--sb-soft)}
.sb-table td{font-family:var(--sb-mono)}
.sb-table[data-kind=wrap] td{white-space:normal;font-family:inherit}
.sb-table[data-kind=wrap] td:first-child,.sb-table[data-kind=wrap] td[data-code]{font-family:var(--sb-mono);white-space:nowrap}
`;

/**
 * Put the styles in a document, once.
 * @param {Document} [doc] The document.
 * @returns {void}
 */
export function injectStyles(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  doc.head.append(style);
}
