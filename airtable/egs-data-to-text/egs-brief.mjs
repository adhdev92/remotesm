export function composeBrief(groups, options = {}) {
  const minStrength = options.minStrength ?? 0.6;
  const maxInsights = options.maxInsights ?? 6;
  const all = Object.values(groups)
    .flatMap((items) => Array.isArray(items) ? items : [])
    .filter((insight) => insight && typeof insight.sentence === 'string' && insight.strength >= minStrength)
    .sort((a, b) => b.strength - a.strength);
  const selected = [];
  const usedKinds = new Set();
  for (const insight of all) {
    if (selected.length >= maxInsights) break;
    if (usedKinds.has(insight.kind)) continue;
    selected.push(insight);
    usedKinds.add(insight.kind);
  }
  return { selected, text: selected.map((insight) => `• ${insight.sentence}`).join('\n') };
}
export default composeBrief;
