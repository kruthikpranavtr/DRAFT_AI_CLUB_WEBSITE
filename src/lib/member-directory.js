export function mergeMembers(current,incoming) {
  return [...new Map([...current,...incoming].map(member => [member.id,member])).values()];
}
