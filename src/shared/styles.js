// The look of the portfolio, the builder and the study view. Every colour and font is a custom property on `.sb`, so a
// page that hosts it can set its own: `.sb { --sb-accent: … }`. The defaults
// are safety.viz's: warm paper, a plum accent, small mono labels, pill buttons.

export const STYLE_ID = 'study-builder-styles';

const DARK =
  '--sb-card:#1c2226;--sb-ink:#e8e6e1;--sb-soft:#9aa5ab;--sb-line:#3a4349;--sb-rule:#2f373c;--sb-accent:#d9a3dd;--sb-accent-soft:#33243a;--sb-on-accent:#1c2226;--sb-warn:#f0c674;--sb-warn-soft:#3a2f17;--sb-bad:#f09a9a;--sb-ok:#8fd3a6;--sb-ok-soft:#1d3326;--sb-blue:#8cc4e6;--sb-blue-soft:#1b2f3b;--sb-sink:#232a2e';

export const STYLES = `
.sb{--sb-card:#fff;--sb-ink:#1f2328;--sb-soft:#5b6470;--sb-line:#c9cdc8;--sb-rule:#e4e6e3;--sb-accent:#6c3270;--sb-accent-soft:#f1e8f2;--sb-on-accent:#fff;--sb-warn:#7a4b00;--sb-warn-soft:#fbf0d9;--sb-bad:#a12a2a;--sb-ok:#1c5a34;--sb-ok-soft:#dcefe2;--sb-blue:#1d5a80;--sb-blue-soft:#e3eef5;--sb-sink:#f1f2ee;--sb-mono:ui-monospace,"IBM Plex Mono",SFMono-Regular,Menlo,monospace;--sb-serif:Georgia,"Iowan Old Style",serif;--sb-sans:inherit;box-sizing:border-box;color:var(--sb-ink);font-family:var(--sb-sans);font-size:.95rem;line-height:1.5}
@media (prefers-color-scheme:dark){.sb:not([data-theme=light]){${DARK}}}
.sb[data-theme=dark]{${DARK}}
.sb *,.sb *::before,.sb *::after{box-sizing:border-box}
.sb button{font:inherit;color:inherit;cursor:pointer}
.sb button:disabled{cursor:default}
.sb :focus-visible{outline:2px solid var(--sb-accent);outline-offset:2px}
.sb h2{margin:0;font:500 1.9rem/1.15 var(--sb-serif)}
.sb h3{margin:1.3rem 0 .5rem;font:600 .7rem/1.2 var(--sb-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--sb-soft)}
.sb h4{margin:0 0 .4rem;font-size:.9rem;font-weight:600}
.sb p{margin:0}
.sb-screen{display:flex;flex-direction:column;gap:.6rem;min-width:0}
.sb-lede{margin-top:.3rem!important;color:var(--sb-soft)}
.sb-soft{color:var(--sb-soft);font-size:.84rem;line-height:1.4}
.sb-foot{margin-top:1rem!important}
.sb-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:.8rem 1.5rem}
.sb-row{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem}
.sb-button{min-height:2.75rem;padding:0 1rem;border:1px solid var(--sb-ink);border-radius:999px;background:var(--sb-card);font-size:.82rem;font-weight:600;white-space:nowrap}
.sb-button:disabled{opacity:.55}
.sb-primary{background:var(--sb-accent);border-color:var(--sb-accent);color:var(--sb-on-accent)!important}
.sb-link{min-height:2.75rem;padding:0;border:0;border-radius:0;background:none;color:var(--sb-accent)!important;font-weight:500;text-decoration:underline}
.sb-file{display:inline-flex}
.sb-said{padding:.5rem .8rem;border-radius:8px;background:var(--sb-sink);font-size:.88rem}
.sb-said[data-kind=problem]{background:none;border:1px solid var(--sb-bad);color:var(--sb-bad)}
.sb-pill{align-self:flex-start;font:600 .64rem/1 var(--sb-mono);letter-spacing:.06em;text-transform:uppercase;padding:.3rem .5rem;border-radius:999px;white-space:nowrap;background:var(--sb-accent-soft);color:var(--sb-accent)}
.sb-pill[data-kind=saved]{background:var(--sb-blue-soft);color:var(--sb-blue)}
.sb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr));gap:.9rem}
.sb-card{display:flex;flex-direction:column;gap:.45rem;min-width:0;padding:1rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:12px}
.sb-card-new{border-style:dashed;background:none}
.sb-card-name{font-size:1.02rem;line-height:1.3}
.sb-card-foot{margin-top:auto;padding-top:.5rem}
.sb-card-foot .sb-primary{flex:1}
.sb-studies{overflow-x:auto;max-width:100%}
.sb-studies-table th,.sb-studies-table td{padding:.7rem .8rem;text-align:left;vertical-align:middle;border-top:1px solid var(--sb-rule)}
.sb-studies-table thead th{border-top:0;font:600 .68rem/1.2 var(--sb-mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--sb-soft)}
.sb-study-name{min-width:14rem;font-weight:500}
.sb-study-name strong{display:block;font-size:.95rem;font-weight:600}
.sb-study-name span,.sb-study-data span.sb-soft{display:block;font-size:.8rem}
.sb-study-data{min-width:11rem}
.sb-data{display:inline-block;padding:.2rem .55rem;border-radius:999px;font-size:.72rem;font-weight:600;white-space:nowrap;border:1px solid var(--sb-line)}
.sb-data[data-data="ready"]{background:var(--sb-accent);color:var(--sb-on-accent);border-color:var(--sb-accent)}
.sb-study-act .sb-row{flex-wrap:nowrap;justify-content:flex-end}
.sb-list{background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:12px}
.sb-item{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .9rem;padding:.7rem 1rem;border-top:1px solid var(--sb-rule)}
.sb-item:first-child{border-top:0}
.sb-item-words{flex:1 1 16rem;min-width:0;display:flex;flex-direction:column}
.sb-describe{flex-direction:row;flex-wrap:wrap;align-items:flex-start;gap:1.5rem 2.5rem}
.sb-describe-main{flex:999 1 30rem;min-width:0;display:flex;flex-direction:column}
.sb-summary{flex:1 1 17rem;max-width:22rem;display:flex;flex-direction:column;gap:.8rem;padding:1.2rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:14px}
.sb-summary h3{margin:0}
.sb-summary .sb-row .sb-button{flex:1}
.sb-trial{display:flex;flex-direction:column;gap:.8rem}
.sb-fields{display:flex;flex-wrap:wrap;gap:.8rem 1rem;align-items:flex-end}
.sb-field{flex:1 1 8rem;min-width:0;display:flex;flex-direction:column;gap:.3rem}
.sb-input{width:100%;min-height:2.75rem;padding:0 .7rem;border:1px solid var(--sb-line);border-radius:10px;background:var(--sb-card);color:var(--sb-ink);font:inherit;font-size:1.05rem;font-weight:500}
.sb-seg{display:flex;border:1px solid var(--sb-line);border-radius:10px;overflow:hidden;background:var(--sb-card)}
.sb-seg button{flex:1;min-height:2.75rem;padding:0 .55rem;font-size:.9rem;border:0;border-left:1px solid var(--sb-rule);background:none;font-weight:500;white-space:nowrap}
.sb-seg button:first-child{border-left:0}
.sb-seg button[aria-pressed=true]{background:var(--sb-accent);color:var(--sb-on-accent)}
.sb-pipe{display:flex;flex-wrap:wrap;align-items:stretch;gap:.6rem}
.sb-pipe-pair{display:flex;flex-direction:column;gap:.5rem}
.sb-layer{display:flex;flex-direction:column;justify-content:center;gap:.15rem;width:8.2rem;min-height:3.4rem;padding:.5rem .7rem;border:1px solid var(--sb-line);border-radius:12px;background:var(--sb-card);text-align:left}
.sb-layer[aria-pressed=true]{border-color:var(--sb-accent);box-shadow:inset 0 0 0 1px var(--sb-accent)}
.sb-layer[aria-pressed=false]{opacity:.6;border-style:dashed}
.sb-layer strong{font-size:.9rem}
.sb-arrow{align-self:center;color:var(--sb-soft);font-size:1.2rem}
.sb-chips{display:flex;flex-wrap:wrap;gap:.45rem}
.sb-chip{min-height:2.4rem;padding:0 .8rem;border:1px solid var(--sb-line);border-radius:999px;background:var(--sb-card);font-size:.84rem;font-weight:500}
.sb-chip[aria-pressed=true]{background:var(--sb-accent-soft);border-color:var(--sb-accent);color:var(--sb-accent)}
.sb-chip:disabled[aria-pressed=true]{background:var(--sb-sink);border-color:var(--sb-sink);color:var(--sb-soft)}
.sb-protocol{display:flex;flex-direction:column;gap:.6rem;min-width:0}
.sb-protocol-ask{margin-top:.8rem!important;display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .8rem}
.sb-schedule{overflow-x:auto;max-width:100%;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px}
.sb-grid{border-collapse:collapse;font-size:.8rem}
.sb-grid th,.sb-grid td{padding:.35rem .5rem;border-bottom:1px solid var(--sb-rule);border-right:1px solid var(--sb-rule);text-align:center;vertical-align:top}
.sb-grid thead th{min-width:5.5rem;font-weight:600;background:var(--sb-sink)}
.sb-grid th small{display:block;font-weight:400;color:var(--sb-soft);font-size:.7rem}
.sb-grid tbody th,.sb-grid thead th:first-child{position:sticky;left:0;z-index:1;min-width:13rem;text-align:left;background:var(--sb-card)}
.sb-grid thead th:first-child{background:var(--sb-sink)}
.sb-grid tbody th{font-weight:500;display:flex;flex-wrap:wrap;align-items:center;gap:.3rem .5rem;border-right:1px solid var(--sb-rule)}
.sb-grid tr[data-simulated=false] th span:first-child,.sb-grid tr[data-simulated=false] td{color:var(--sb-soft)}
.sb-grid td{color:var(--sb-accent)}
.sb-grid input[type=checkbox]{width:1.1rem;height:1.1rem;accent-color:var(--sb-accent)}
.sb-grid-visit{display:block}
.sb-grid-day{width:4.2rem;min-height:2rem;margin:.2rem 0;padding:0 .3rem;border:1px solid var(--sb-line);border-radius:6px;background:var(--sb-card);color:var(--sb-ink);font:inherit;text-align:center}
.sb-grid-remove{display:block;margin:0 auto;min-width:2rem;min-height:2rem;border:0;border-radius:6px;background:none;color:var(--sb-soft)!important}
.sb-grid-remove:hover{background:var(--sb-sink)}
.sb-pill[data-kind=none]{background:var(--sb-sink);color:var(--sb-soft)}
.sb-facts{margin:0;display:grid;grid-template-columns:auto 1fr;gap:.4rem 1rem;font-size:.9rem}
.sb-facts dt{color:var(--sb-soft)}
.sb-facts dd{margin:0;text-align:right;font-weight:600}
.sb-warn{padding:.6rem .7rem;border-radius:8px;background:var(--sb-warn-soft);color:var(--sb-warn);font-size:.84rem}
.sb-problems{margin:0;padding:.6rem .7rem .6rem 1.6rem;border:1px solid var(--sb-bad);border-radius:8px;color:var(--sb-bad);font-size:.86rem}
p.sb-problems{padding-left:.7rem}
.sb-steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:.5rem;font-size:.9rem}
.sb-steps li{display:flex;align-items:center;gap:.6rem;color:var(--sb-soft)}
.sb-steps li::before{content:"";width:.9rem;height:.9rem;border-radius:50%;border:2px solid var(--sb-line);flex:none}
.sb-steps li[data-step=done]::before{background:var(--sb-ok);border-color:var(--sb-ok)}
.sb-steps li[data-step=now]{color:var(--sb-ink);font-weight:600}
.sb-steps li[data-step=now]::before{border-color:var(--sb-accent);border-top-color:transparent;animation:sb-spin .8s linear infinite}
@keyframes sb-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sb-steps li[data-step=now]::before{animation:none;background:var(--sb-accent)}}
.sb-title{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .8rem}
.sb-title .sb-pill{align-self:center}
.sb-facts-row{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem}
.sb-fact{padding:.3rem .65rem;border-radius:999px;background:var(--sb-sink);font-size:.82rem}
.sb-viewer{margin-top:.6rem;min-width:0}
.sb-viewer .sv{--sv-accent:var(--sb-accent);--sv-accent-soft:var(--sb-accent-soft);--sv-on-accent:var(--sb-on-accent);--sv-card:var(--sb-card);--sv-ink:var(--sb-ink);--sv-soft:var(--sb-soft);--sv-rule:var(--sb-rule);--sv-line:var(--sb-line);--sv-sink:var(--sb-sink)}
.sb-tiles{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(9rem,1fr));gap:.6rem}
.sb-tile{display:flex;flex-direction:column;padding:.7rem .8rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px}
.sb-tile-value{font-size:1.5rem;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums}
.sb-tile-label{font-size:.84rem}
.sb-over-lower{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));gap:1rem}
.sb-over{min-width:0}
.sb-table{border-collapse:collapse;width:100%;font-size:.84rem;background:var(--sb-card);border:1px solid var(--sb-rule);border-radius:10px}
.sb-table th{text-align:left;padding:.4rem .7rem;border-bottom:1px solid var(--sb-line);font-weight:600}
.sb-table td{padding:.35rem .7rem;border-bottom:1px solid var(--sb-rule);font-variant-numeric:tabular-nums}
.sb-caveats{font-size:.86rem;color:var(--sb-soft)}
.sb-caveats summary{cursor:pointer;min-height:2.4rem;line-height:2.4rem;text-decoration:underline}
.sb-caveats ul{margin:.2rem 0 0;padding-left:1.2rem}
`;

/**
 * Put their styles in a document, once.
 * @param {Document} doc The document.
 * @returns {void}
 */
export function injectStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  doc.head.append(style);
}
