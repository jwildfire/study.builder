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
.sb-layer-choices{display:grid;gap:.4rem;padding:.8rem 1rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px}
.sb-layer-choice{display:flex;align-items:flex-start;gap:.55rem;font-size:.86rem;line-height:1.4;color:var(--sb-soft)}
.sb-layer-choice strong{color:var(--sb-ink)}
.sb-layer-choice input{margin:.2rem 0 0;width:1rem;height:1rem;flex:none;accent-color:var(--sb-accent)}
.sb-domains{margin:.6rem 0 0;padding:.55rem 1rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px;font-size:.86rem}
.sb-domains-summary{cursor:pointer;color:var(--sb-soft)}
.sb-domains-summary strong{color:var(--sb-ink)}
.sb-domains-hint{color:var(--sb-accent);text-decoration:underline}
.sb-domains[open] .sb-domains-hint{display:none}
.sb-domain-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(13rem,1fr));gap:.15rem 1rem;margin:.6rem 0 .2rem;padding:0;list-style:none}
.sb-domain-line{display:flex;align-items:center;gap:.45rem;padding:.12rem 0;min-width:0}
.sb-domain-line input{margin:0;width:.95rem;height:.95rem;flex:none;accent-color:var(--sb-accent)}
.sb-domain[data-on=false] .sb-domain-name{color:var(--sb-soft)}
.sb-domain-note{font:500 .62rem/1 var(--sb-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--sb-soft);white-space:nowrap}
.sb-domain-note[data-kind=large]{color:var(--sb-warn)}
.sb-layer-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 .6rem;border-bottom:1px solid var(--sb-rule)}
.sb-layer-tab{appearance:none;display:inline-flex;align-items:baseline;gap:.5rem;padding:.5rem .8rem;margin-bottom:-1px;background:transparent;border:1px solid transparent;border-bottom:2px solid transparent;border-radius:8px 8px 0 0;color:var(--sb-soft);font:inherit;font-weight:600;cursor:pointer}
.sb-layer-tab[aria-selected=true]{color:var(--sb-ink);border-bottom-color:var(--sb-accent)}
.sb-layer-tab:hover{color:var(--sb-accent)}
.sb-layer-tab:focus-visible{outline:2px solid var(--sb-accent);outline-offset:2px}
.sb-layer-count{font:500 .68rem/1 var(--sb-mono);color:var(--sb-soft)}
.sb-layer-about{color:var(--sb-soft);font-size:.86rem;margin:0 0 .7rem;max-width:60rem}
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
.sb-browser{display:grid;grid-template-columns:minmax(13rem,19rem) minmax(0,1fr);gap:.8rem;align-items:start}
@media (max-width:760px){.sb-browser{grid-template-columns:1fr}}
.sb-table-list{margin:0;padding:.25rem;list-style:none;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px;max-height:32rem;overflow:auto}
.sb-table-pick{appearance:none;display:flex;align-items:baseline;gap:.5rem;width:100%;padding:.24rem .5rem;background:transparent;border:0;border-radius:6px;color:var(--sb-ink);font:inherit;font-size:.84rem;line-height:1.3;text-align:left;cursor:pointer}
.sb-table-pick:hover{background:var(--sb-rule)}
.sb-table-pick[aria-current=true]{background:var(--sb-accent);color:var(--sb-on-accent)}
.sb-table-pick:focus-visible{outline:2px solid var(--sb-accent);outline-offset:1px}
.sb-pick-name{font-weight:600;white-space:nowrap}
.sb-pick-id{flex:1 1 auto;min-width:0;font:500 .64rem/1.3 var(--sb-mono);opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-pick-rows{flex:none;font:600 .7rem/1.3 var(--sb-mono);opacity:.85}
.sb-viewer{min-width:0;padding:.8rem 1rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px}
.sb-viewer-head{display:flex;flex-wrap:wrap;align-items:flex-start;gap:.6rem}
.sb-viewer-title{display:flex;flex-wrap:wrap;align-items:baseline;gap:.2rem .6rem;min-width:0}
.sb-viewer-title h4{margin:0;font-size:1.05rem}
.sb-viewer-meta{color:var(--sb-soft);font-size:.82rem;margin:.15rem 0 0}
.sb-viewer-tabs{display:flex;gap:.3rem;margin:.7rem 0 .5rem;border-bottom:1px solid var(--sb-rule)}
.sb-viewer-tab{appearance:none;padding:.35rem .7rem;margin-bottom:-1px;background:transparent;border:0;border-bottom:2px solid transparent;color:var(--sb-soft);font:500 .7rem/1 var(--sb-mono);letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.sb-viewer-tab[aria-selected=true]{color:var(--sb-ink);border-bottom-color:var(--sb-accent)}
.sb-viewer-tab:hover{color:var(--sb-accent)}
.sb-viewer-tab:focus-visible{outline:2px solid var(--sb-accent);outline-offset:2px}
.sb-viewer-foot{display:flex;align-items:center;gap:.6rem;margin-top:.5rem}
.sb-th-note{display:block;font-weight:500;opacity:.75;text-transform:none}
.sb-overview{display:grid;gap:1rem}
.sb-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr));gap:.5rem;margin:0;padding:0;list-style:none}
.sb-tile{display:flex;flex-direction:column;gap:.1rem;padding:.6rem .8rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px}
.sb-tile-value{font-size:1.5rem;font-weight:600;line-height:1.1}
.sb-tile-label{font-size:.82rem}
.sb-tile-note{font:500 .68rem/1.3 var(--sb-mono);color:var(--sb-soft)}
.sb-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(10rem,1fr));gap:.6rem 1rem;margin:0;padding:.7rem 1rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px}
.sb-fact{min-width:0}
.sb-facts dt{font:500 .64rem/1.2 var(--sb-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--sb-soft)}
.sb-facts dd{margin:.1rem 0 0;font-size:.9rem}
.sb-overview-lower{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:1rem}
.sb-overview h5,.sb-viewer h5{margin:0 0 .4rem;font:600 .68rem/1.2 var(--sb-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--sb-soft)}
.sb-scroll{overflow:auto;max-height:26rem;border:1px solid var(--sb-rule);border-radius:8px}
.sb-table{border-collapse:collapse;width:100%;font-size:.8rem}
.sb-table th,.sb-table td{text-align:left;vertical-align:top;padding:.3rem .6rem;border-bottom:1px solid var(--sb-rule);white-space:nowrap}
.sb-table th{position:sticky;top:0;background:var(--sb-card);font:600 .68rem/1.3 var(--sb-mono);color:var(--sb-soft)}
.sb-table td{font-family:var(--sb-mono)}
.sb-table[data-kind=wrap] td{white-space:normal;font-family:inherit}
.sb-table[data-kind=wrap] td:nth-child(2){min-width:11rem}
.sb-table[data-kind=wrap] td:last-child{min-width:12rem}
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
