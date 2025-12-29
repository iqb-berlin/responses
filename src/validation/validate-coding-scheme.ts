import {
  RuleMethodParameterCount,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { CodingSchemeProblem } from '../coding-interfaces';

export const validateCodingScheme = (
  baseVariables: VariableInfo[],
  variableCodings: VariableCodingData[]
): CodingSchemeProblem[] => {
  const baseVarById = new Map<string, VariableInfo>();
  const problems: CodingSchemeProblem[] = [];

  const pushRuleParameterMismatch = (
    variableId: string,
    variableLabel: string,
    code: string
  ) => {
    problems.push({
      type: 'RULE_PARAMETER_COUNT_MISMATCH',
      breaking: true,
      variableId,
      variableLabel,
      code
    });
  };

  const isFiniteNumberString = (s: unknown): boolean => {
    if (typeof s !== 'string') return false;
    const n = Number.parseFloat(s);
    return Number.isFinite(n);
  };

  const pushInvalidSourceProblem = (
    variableId: string,
    variableLabel: string
  ) => {
    problems.push({
      type: 'INVALID_SOURCE',
      breaking: true,
      variableId,
      variableLabel
    });
  };

  const baseVarIdCounts = new Map<string, number>();
  baseVariables.forEach(bv => {
    if (bv?.id) {
      baseVarById.set(bv.id, bv);
      baseVarIdCounts.set(bv.id, (baseVarIdCounts.get(bv.id) ?? 0) + 1);
    }
  });
  [...baseVarIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .forEach(([id]) => {
      pushInvalidSourceProblem(id, '');
    });

  const codingIdCounts = new Map<string, number>();
  const codingAliasCounts = new Map<string, number>();
  const codingIds = new Set<string>();
  variableCodings.forEach(vc => {
    codingIdCounts.set(vc.id, (codingIdCounts.get(vc.id) ?? 0) + 1);
    codingIds.add(vc.id);
    if (vc.alias) {
      codingAliasCounts.set(
        vc.alias,
        (codingAliasCounts.get(vc.alias) ?? 0) + 1
      );
    }
  });

  variableCodings.forEach(vc => {
    if ((codingIdCounts.get(vc.id) ?? 0) > 1) {
      pushInvalidSourceProblem(vc.alias || vc.id, vc.label || '');
    }
    if (vc.alias && (codingAliasCounts.get(vc.alias) ?? 0) > 1) {
      pushInvalidSourceProblem(vc.alias || vc.id, vc.label || '');
    }
    if (vc.alias && codingIds.has(vc.alias) && vc.alias !== vc.id) {
      pushInvalidSourceProblem(vc.alias || vc.id, vc.label || '');
    }
  });

  const allDerivedVariableIds: string[] = variableCodings
    .filter(
      vc => vc.sourceType !== 'BASE' && vc.sourceType !== 'BASE_NO_VALUE'
    )
    .map(vc => vc.id);
  const allBaseVariableInfoIds = baseVariables.map(bv => bv.id);
  const allPossibleSourceIds = [
    ...allBaseVariableInfoIds,
    ...allDerivedVariableIds
  ];

  const variableValuesCopied: string[] = [];
  variableCodings
    .filter(vc => vc.sourceType === 'COPY_VALUE')
    .forEach(vc => {
      variableValuesCopied.push(...(vc.deriveSources ?? []));
    });

  variableCodings.forEach(c => {
    if (c.sourceType === 'BASE') {
      const varInfo = baseVarById.get(c.id);
      if (varInfo?.type === 'no-value') {
        problems.push({
          type: 'INVALID_SOURCE',
          breaking: true,
          variableId: c.alias || c.id,
          variableLabel: c.label || ''
        });
      }
      if (allBaseVariableInfoIds.indexOf(c.id) < 0) {
        problems.push({
          type: 'SOURCE_MISSING',
          breaking: true,
          variableId: c.alias || c.id,
          variableLabel: c.label || ''
        });
      }
    } else if (c.sourceType === 'BASE_NO_VALUE') {
      const varInfo = baseVarById.get(c.id);
      if (varInfo && varInfo.type !== 'no-value') {
        problems.push({
          type: 'INVALID_SOURCE',
          breaking: true,
          variableId: c.alias || c.id,
          variableLabel: c.label || ''
        });
      }
      if (allBaseVariableInfoIds.indexOf(c.id) < 0) {
        problems.push({
          type: 'SOURCE_MISSING',
          breaking: true,
          variableId: c.alias || c.id,
          variableLabel: c.label || ''
        });
      }
    } else if (c.deriveSources && c.deriveSources.length > 0) {
      if (c.sourceType === 'COPY_VALUE') {
        if (c.deriveSources.length > 1) {
          problems.push({
            type: 'MORE_THAN_ONE_SOURCE',
            breaking: false,
            variableId: c.alias || c.id,
            variableLabel: c.label || ''
          });
        }
        if (
          allPossibleSourceIds.indexOf(c.deriveSources[0]) >= 0 &&
          allBaseVariableInfoIds.indexOf(c.deriveSources[0]) < 0
        ) {
          problems.push({
            type: 'VALUE_COPY_NOT_FROM_BASE',
            breaking: false,
            variableId: c.alias || c.id,
            variableLabel: c.label || ''
          });
        }
      } else if (c.deriveSources.length === 1) {
        problems.push({
          type: 'ONLY_ONE_SOURCE',
          breaking: false,
          variableId: c.alias || c.id,
          variableLabel: c.label || ''
        });
      }
      c.deriveSources.forEach(s => {
        if (allPossibleSourceIds.indexOf(s) < 0) {
          problems.push({
            type: 'SOURCE_MISSING',
            breaking: true,
            variableId: c.alias || c.id,
            variableLabel: c.label || ''
          });
        }
      });
    } else {
      problems.push({
        type: 'SOURCE_MISSING',
        breaking: true,
        variableId: c.alias || c.id,
        variableLabel: c.label || ''
      });
    }

    if ((c.codes?.length ?? 0) > 0) {
      c.codes?.forEach(code => {
        code.ruleSets?.forEach(rs => {
          const valueArrayPos = rs.valueArrayPos;
          const isAllowedValueArrayPos =
            typeof valueArrayPos === 'undefined' ||
            typeof valueArrayPos === 'number' ||
            ['ANY', 'ANY_OPEN', 'SUM', 'LENGTH'].includes(
              String(valueArrayPos)
            );

          if (!isAllowedValueArrayPos) {
            pushRuleParameterMismatch(
              c.alias || c.id,
              c.label || '',
              code.id ? code.id.toString(10) : 'null'
            );
          }

          if (typeof valueArrayPos === 'number' && valueArrayPos < 0) {
            pushRuleParameterMismatch(
              c.alias || c.id,
              c.label || '',
              code.id ? code.id.toString(10) : 'null'
            );
          }

          rs.rules.forEach(r => {
            const parameterCount = r.parameters ? r.parameters.length : 0;
            const expectedParameterCount = RuleMethodParameterCount[r.method];

            const isMismatch =
              expectedParameterCount < 0 ?
                parameterCount < 1 :
                parameterCount !== expectedParameterCount;

            if (isMismatch) {
              pushRuleParameterMismatch(
                c.alias || c.id,
                c.label || '',
                code.id ? code.id.toString(10) : 'null'
              );
              return;
            }

            const params = r.parameters ?? [];

            if (r.method === 'MATCH_REGEX') {
              const patterns = params.flatMap(p => p.split(/\r?\n/));
              patterns.forEach(p => {
                try {
                  // eslint-disable-next-line no-new
                  new RegExp(p);
                } catch (e) {
                  pushRuleParameterMismatch(
                    c.alias || c.id,
                    c.label || '',
                    code.id ? code.id.toString(10) : 'null'
                  );
                }
              });
            }

            if (
              [
                'NUMERIC_MATCH',
                'NUMERIC_LESS_THAN',
                'NUMERIC_MORE_THAN',
                'NUMERIC_MAX',
                'NUMERIC_MIN'
              ].includes(r.method)
            ) {
              const values = params.flatMap(p => p.split(/\r?\n/));
              if (values.some(v => !isFiniteNumberString(v))) {
                pushRuleParameterMismatch(
                  c.alias || c.id,
                  c.label || '',
                  code.id ? code.id.toString(10) : 'null'
                );
              }
            }

            if (
              r.method === 'NUMERIC_RANGE' ||
              r.method === 'NUMERIC_FULL_RANGE'
            ) {
              const ll = params[0];
              const ul = params[1];
              if (!isFiniteNumberString(ll) || !isFiniteNumberString(ul)) {
                pushRuleParameterMismatch(
                  c.alias || c.id,
                  c.label || '',
                  code.id ? code.id.toString(10) : 'null'
                );
              } else {
                const llNum = Number.parseFloat(ll);
                const ulNum = Number.parseFloat(ul);
                if (llNum > ulNum) {
                  pushRuleParameterMismatch(
                    c.alias || c.id,
                    c.label || '',
                    code.id ? code.id.toString(10) : 'null'
                  );
                }
              }
            }
          });
        });
      });
    } else if (variableValuesCopied.indexOf(c.id) < 0) {
      if (c.sourceType !== 'BASE_NO_VALUE') {
        problems.push({
          type: 'VACANT',
          breaking: false,
          variableId: c.alias || c.id,
          variableLabel: c.label || ''
        });
      }
    }
  });

  return problems;
};
