interface DependencyNode {
  id: string;
  dependsOn: string[];
}

/**
 * Returns the first dependency cycle found as a path (e.g. ["a", "b", "a"]),
 * or null when the graph is acyclic. Unknown dependency ids are ignored here;
 * referential integrity is the schema's responsibility.
 */
export function findDependencyCycle(nodes: DependencyNode[]): string[] | null {
  const edges = new Map(nodes.map((n) => [n.id, n.dependsOn]));
  const visiting = new Set<string>();
  const done = new Set<string>();

  const walk = (id: string, path: string[]): string[] | null => {
    if (done.has(id)) return null;
    if (visiting.has(id)) return [...path.slice(path.indexOf(id)), id];
    visiting.add(id);
    path.push(id);
    for (const dep of edges.get(id) ?? []) {
      if (!edges.has(dep)) continue;
      const cycle = walk(dep, path);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(id);
    done.add(id);
    return null;
  };

  for (const node of nodes) {
    const cycle = walk(node.id, []);
    if (cycle) return cycle;
  }
  return null;
}
