// study.viewer's look. Every colour and font is a custom property on `.sv`,
// so a page that hosts it can set its own: `.sv { --sv-accent: … }`. The
// defaults are safety.viz's: warm paper, a plum accent, small mono labels.

export const VIEWER_STYLE_ID = 'study-viewer-styles';

const DARK =
  '--sv-card:#1c2226;--sv-ink:#e8e6e1;--sv-soft:#9aa5ab;--sv-line:#3a4349;--sv-rule:#2f373c;--sv-accent:#d9a3dd;--sv-accent-soft:#33243a;--sv-on-accent:#1c2226;--sv-warn:#f0c674;--sv-warn-soft:#3a2f17;--sv-ok:#8fd3a6;--sv-ok-soft:#1d3326;--sv-sink:#232a2e';

export const VIEWER_STYLES = `
.sv{--sv-card:#fff;--sv-ink:#1f2328;--sv-soft:#5b6470;--sv-line:#c9cdc8;--sv-rule:#e4e6e3;--sv-accent:#6c3270;--sv-accent-soft:#f1e8f2;--sv-on-accent:#fff;--sv-warn:#7a4b00;--sv-warn-soft:#fbf0d9;--sv-ok:#1c5a34;--sv-ok-soft:#dcefe2;--sv-sink:#f4f5f2;--sv-mono:ui-monospace,"IBM Plex Mono",SFMono-Regular,Menlo,monospace;--sv-sans:inherit;box-sizing:border-box;display:flex;flex-wrap:wrap;gap:0 1.5rem;color:var(--sv-ink);font-family:var(--sv-sans);font-size:.9rem;line-height:1.45}
@media (prefers-color-scheme:dark){.sv:not([data-theme=light]){${DARK}}}
.sv[data-theme=dark]{${DARK}}
.sv *,.sv *::before,.sv *::after{box-sizing:border-box}
.sv button{font:inherit;color:inherit;cursor:pointer}
.sv :focus-visible{outline:2px solid var(--sv-accent);outline-offset:2px}
.sv-rail{flex:1 1 13rem;max-width:17rem;min-width:0;display:flex;flex-direction:column;gap:.1rem;padding:0 0 1rem}
.sv-main{flex:999 1 28rem;min-width:0;display:flex;flex-direction:column;gap:.7rem}
.sv-find,.sv-input{min-height:2.5rem;padding:0 .6rem;border:1px solid var(--sv-line);border-radius:8px;background:var(--sv-card);color:var(--sv-ink);font:inherit}
.sv-find{width:100%;margin:0 0 .4rem}
.sv-group{display:flex;justify-content:space-between;padding:.8rem .6rem .3rem;font:600 .68rem/1.2 var(--sv-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--sv-soft)}
.sv-pick{display:flex;justify-content:space-between;align-items:center;gap:.6rem;width:100%;min-height:2.5rem;padding:.3rem .6rem;border:0;border-radius:8px;background:none;text-align:left}
.sv-pick:hover{background:var(--sv-sink)}
.sv-pick[aria-current=true]{background:var(--sv-accent-soft);color:var(--sv-accent);font-weight:600}
.sv-pick-name{min-width:0;overflow-wrap:anywhere}
.sv-pick-rows{font:500 .74rem/1 var(--sv-mono);color:var(--sv-soft);font-variant-numeric:tabular-nums}
.sv-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:.6rem 1rem}
.sv-title{margin:0;font-size:1.35rem;font-weight:600;line-height:1.2}
.sv-title-about{margin-left:.6rem;font-size:.9rem;font-weight:400;color:var(--sv-soft)}
.sv-meta,.sv-soft{color:var(--sv-soft);font-size:.82rem}
.sv-meta{margin:.2rem 0 0}
.sv-note{margin:.3rem 0 0;display:inline-block;padding:.2rem .5rem;border-radius:6px;background:var(--sv-warn-soft);color:var(--sv-warn);font-size:.82rem}
.sv-label{font:600 .68rem/1.2 var(--sv-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--sv-soft)}
.sv-button{min-height:2.5rem;padding:0 .9rem;border:1px solid var(--sv-ink);border-radius:999px;background:var(--sv-card);font-size:.8rem;font-weight:600;white-space:nowrap}
.sv-primary{background:var(--sv-accent);border-color:var(--sv-accent);color:var(--sv-on-accent)!important}
.sv-todo{border-color:var(--sv-warn);color:var(--sv-warn)!important}
.sv-views{display:flex;flex-wrap:wrap;gap:0 1.4rem;border-bottom:1px solid var(--sv-rule)}
.sv-view{min-height:2.6rem;padding:0 .1rem;border:0;border-bottom:3px solid transparent;background:none;color:var(--sv-soft)!important;font-weight:500}
.sv-view[aria-selected=true]{border-color:var(--sv-accent);color:var(--sv-ink)!important;font-weight:600}
.sv-body{display:flex;flex-direction:column;gap:.7rem;min-width:0}
.sv-filters{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .5rem}
.sv-chip{min-height:2.1rem;padding:0 .7rem;border:0;border-radius:999px;background:var(--sv-accent-soft);color:var(--sv-accent)!important;font-size:.8rem;font-weight:500}
.sv-add{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem}
.sv-count{margin:0 0 0 auto}
.sv-scroll{overflow-x:auto;max-width:100%;background:var(--sv-card);border:1px solid var(--sv-rule);border-radius:10px}
.sv-grid{border-collapse:collapse;width:100%;font:.78rem/1.3 var(--sv-mono)}
.sv-grid th{text-align:left;padding:.4rem .7rem;border-bottom:1px solid var(--sv-line);font-weight:600;white-space:nowrap;vertical-align:bottom}
.sv-grid th small{display:block;font-weight:400;color:var(--sv-soft)}
.sv-grid td{padding:.4rem .7rem;border-bottom:1px solid var(--sv-rule);white-space:nowrap;max-width:22rem;overflow:hidden;text-overflow:ellipsis}
.sv-grid tr:last-child td{border-bottom:0}
.sv-sort{padding:0;border:0;background:none;font:inherit;font-weight:600}
.sv-link{padding:0;border:0;background:none;color:var(--sv-accent)!important;text-decoration:underline;font:inherit}
.sv-foot{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.5rem}
.sv-columns{background:var(--sv-card);border:1px solid var(--sv-rule);border-radius:10px;overflow-x:auto}
.sv-column{display:grid;grid-template-columns:var(--sv-tracks);gap:.8rem;align-items:center;min-width:52rem;padding:.5rem .8rem;border-top:1px solid var(--sv-rule)}
.sv-column>*{min-width:0;overflow-wrap:anywhere}
.sv-column-head{border-top:0;background:var(--sv-sink);font:600 .66rem/1.2 var(--sv-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--sv-soft)}
.sv-column-name b{font:600 .8rem/1.3 var(--sv-mono);overflow-wrap:anywhere}
.sv-tag{margin-left:.4rem;font:500 .64rem/1 var(--sv-mono);color:var(--sv-soft)}
.sv-used{display:inline-block;padding:.25rem .45rem;border-radius:999px;background:var(--sv-ok-soft);color:var(--sv-ok);font:600 .64rem/1 var(--sv-mono);letter-spacing:.05em;text-transform:uppercase}
.sv-bars{display:flex;align-items:flex-end;gap:2px;height:2rem;overflow:hidden}
.sv-bar{flex:1;min-width:4px;padding:0;border:0;border-radius:2px 2px 0 0;background:var(--sv-accent);opacity:.6}
.sv-bar:hover{opacity:1}
.sv-person{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem}
.sv-person-pick{font-weight:600;max-width:16rem}
.sv-person .sv-primary{margin-left:auto}
.sv-step{padding:0;width:2.5rem;font-size:1.1rem}
.sv-blocks{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,24rem),1fr));gap:.8rem}
.sv-block{min-width:0;display:flex;flex-direction:column;gap:.4rem}
.sv-block-head{display:flex;justify-content:space-between;align-items:baseline;gap:.6rem}
.sv-block-head .sv-link{font-weight:600}
.sv-block-more{margin:0}
.sv-empty{padding:1rem;border:1px dashed var(--sv-line);border-radius:10px;color:var(--sv-soft)}
`;

/**
 * Put the viewer's styles in a document, once.
 * @param {Document} doc The document.
 * @returns {void}
 */
export function injectViewerStyles(doc) {
  if (doc.getElementById(VIEWER_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = VIEWER_STYLE_ID;
  style.textContent = VIEWER_STYLES;
  doc.head.append(style);
}
