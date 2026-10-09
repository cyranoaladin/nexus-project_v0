export function markdownToHtml(md: string): string {
  if (!md) return '<p class="text-neutral-200">Contenu non disponible.</p>';

  // Source HTML is always text. Only markup generated below can reach the sink.
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Tables
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split("|").filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) return "___TABLE_SEP___";
      return `<tr>${cells.map((c) => `<td class="px-4 py-2.5 border-b border-white/[0.06] text-neutral-100 text-sm">${c}</td>`).join("")}</tr>`;
    })
    .replace(/((<tr>.*<\/tr>\n?)+)/g, (block) => {
      const rows = block.split("\n").filter((r) => r.startsWith("<tr>"));
      if (rows.length === 0) return block;
      const headerRow = rows[0]
        .replace(/<td /g, '<th ')
        .replace(/<\/td>/g, "</th>")
        .replace(/text-neutral-100/g, "text-neutral-300 font-semibold");
      const bodyRows = rows.slice(1).filter((r) => !r.includes("___TABLE_SEP___"));
      return `<div class="overflow-x-auto my-5 rounded-[14px] border border-white/[0.08]"><table class="w-full text-sm"><thead class="bg-surface-elevated">${headerRow}</thead><tbody>${bodyRows.join("")}</tbody></table></div>`;
    })
    .replace(/___TABLE_SEP___/g, "");

  html = html
    .replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold text-white mt-5 mb-2">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-6 mb-2 flex items-center gap-2"><span class="w-1 h-5 bg-brand-accent rounded-full inline-block"></span>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3 pb-2 border-b border-white/[0.08]">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-neutral-200">$1</em>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="text-neutral-100 ml-6 list-decimal leading-relaxed">$1</li>')
    .replace(/^\*\s+(.+)$/gm, '<li class="text-neutral-100 ml-6 list-disc leading-relaxed">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="text-neutral-100 ml-6 list-disc leading-relaxed">$1</li>')
    .replace(/((<li class="text-neutral-100 ml-6 list-disc[^"]*">.*<\/li>\n?)+)/g, '<ul class="space-y-1.5 my-3">$1</ul>')
    .replace(/((<li class="text-neutral-100 ml-6 list-decimal[^"]*">.*<\/li>\n?)+)/g, '<ol class="space-y-1.5 my-3">$1</ol>')
    .replace(/\n\n/g, '</p><p class="text-neutral-200 leading-relaxed my-2">')
    .replace(/<p class="text-neutral-200 leading-relaxed my-2"><\/p>/g, "");

  return html;
}
