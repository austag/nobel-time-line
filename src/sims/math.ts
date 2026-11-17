import katex from 'katex';

// 해설 HTML 안의 $...$ 와 $$...$$ 를 수식으로 바꾼다.
// MathML로 내보내서 KaTeX 글꼴과 CSS 없이도 브라우저가 그린다.
function tex(src: string, display: boolean): string {
  try {
    return katex.renderToString(src, { displayMode: display, output: 'mathml', throwOnError: false });
  } catch {
    return `<code>${src.replace(/</g, '&lt;')}</code>`;
  }
}

export function renderMath(html: string): string {
  return html
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, s: string) => `<div class="eq">${tex(s, true)}</div>`)
    .replace(/\$([^$\n]+?)\$/g, (_, s: string) => tex(s, false));
}
