import { VariableCodingData } from '@iqbspecs/coding-scheme';

export interface VariableGraphNode {
  id: string;
  level: number;
  sources: string[];
  page: string;
}

const resolveCommonPage = (
  currentPage: string | null,
  newPage: string
): string | null => {
  if (currentPage === null) {
    return newPage;
  }
  return currentPage === newPage ? currentPage : '';
};

export const getVariableDependencyTree = (
  variableCodings: VariableCodingData[]
): VariableGraphNode[] => {
  const graph: VariableGraphNode[] = variableCodings
    .filter(c => c.sourceType === 'BASE')
    .map(c => ({
      id: c.id,
      level: 0,
      sources: [],
      page: c.page || ''
    }));

  const baseNoValueCount = variableCodings.filter(
    c => c.sourceType === 'BASE_NO_VALUE'
  ).length;
  const maxGraphLength = variableCodings.length - baseNoValueCount;

  let dependenciesResolved = true;
  while (dependenciesResolved && graph.length < maxGraphLength) {
    dependenciesResolved = false;

    const processVariableCoding = (vc: VariableCodingData): boolean => {
      const existingNode = graph.find(node => node.id === vc.id);

      if (vc.sourceType !== 'BASE_NO_VALUE' && !existingNode) {
        const deriveSources = vc.deriveSources ?? [];
        let maxLevel = 0;
        let commonPage: string | null = null;

        const allSourcesResolved = deriveSources.every(sourceId => {
          const sourceNode = graph.find(node => node.id === sourceId);
          if (sourceNode) {
            maxLevel = Math.max(maxLevel, sourceNode.level);
            commonPage = resolveCommonPage(commonPage, sourceNode.page);
            return true;
          }
          return false;
        });

        if (allSourcesResolved) {
          graph.push({
            id: vc.id,
            level: maxLevel + 1,
            sources: [...deriveSources],
            page: commonPage || ''
          });
          return true;
        }
      }
      return false;
    };

    let anyDependenciesResolved = false;
    variableCodings.forEach(vc => {
      if (processVariableCoding(vc)) {
        anyDependenciesResolved = true;
      }
    });
    dependenciesResolved = anyDependenciesResolved;
  }

  if (dependenciesResolved) {
    return graph;
  }

  throw new Error('Circular dependency detected in the coding scheme');
};
