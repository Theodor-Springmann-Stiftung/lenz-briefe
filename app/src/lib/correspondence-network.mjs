/** Lenz's correspondents: one spoke per partner, weighted by shared letters. */
export function correspondenceStar(letters, visibleIds, people, hubId) {
  const nodes = new Map();
  const edges = new Map();
  for (const letter of letters) {
    if (!visibleIds.has(letter.id)) continue;
    const senders = [...new Set(letter.senders)].filter(id => people[id]);
    const recipients = [...new Set(letter.recipients)].filter(id => people[id]);
    const participants = new Set([...senders, ...recipients]);
    if (!participants.has(hubId)) continue;
    for (const id of participants) {
      nodes.set(id, { id, name: people[id], count: (nodes.get(id)?.count || 0) + 1 });
      if (id === hubId) continue;
      edges.set(id, { source: hubId, target: id, count: (edges.get(id)?.count || 0) + 1 });
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
