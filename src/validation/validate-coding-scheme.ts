import {
  RuleMethod,
  RuleMethodParameterCount,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { CodingSchemeProblem } from '../coding-interfaces';

type CodingValueType = 'numeric' | 'boolean' | 'string' | 'other' | 'unknown';

type CodingValueShape = {
  valueType: CodingValueType;
  multiple?: boolean;
  valuePositionLabels?: string[];
};

export const validateCodingScheme = (
  baseVariables: VariableInfo[],
  variableCodings: VariableCodingData[]
): CodingSchemeProblem[] => {
  const baseVarById = new Map<string, VariableInfo>();
  const problems: CodingSchemeProblem[] = [];
  const numericRuleMethods: RuleMethod[] = [
    'NUMERIC_MATCH',
    'NUMERIC_RANGE',
    'NUMERIC_FULL_RANGE',
    'NUMERIC_MIN',
    'NUMERIC_MORE_THAN',
    'NUMERIC_LESS_THAN',
    'NUMERIC_MAX'
  ];
  const booleanRuleMethods: RuleMethod[] = ['IS_TRUE', 'IS_FALSE'];

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

  const pushRuleParameterInvalid = (
    variableId: string,
    variableLabel: string,
    code: string
  ) => {
    problems.push({
      type: 'RULE_PARAMETER_INVALID',
      breaking: true,
      variableId,
      variableLabel,
      code
    });
  };

  const pushRuleRegexInvalid = (
    variableId: string,
    variableLabel: string,
    code: string
  ) => {
    problems.push({
      type: 'RULE_REGEX_INVALID',
      breaking: true,
      variableId,
      variableLabel,
      code
    });
  };

  const pushRuleNumericRangeInvalid = (
    variableId: string,
    variableLabel: string,
    code: string
  ) => {
    problems.push({
      type: 'RULE_NUMERIC_RANGE_INVALID',
      breaking: true,
      variableId,
      variableLabel,
      code
    });
  };

  const pushRulesetValueArrayPosInvalid = (
    variableId: string,
    variableLabel: string,
    code: string
  ) => {
    problems.push({
      type: 'RULESET_VALUE_ARRAY_POS_INVALID',
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

  const getCodeRef = (code: { id?: unknown }): string => (
    typeof code.id !== 'undefined' && code.id !== null ?
      String(code.id) :
      'null'
  );

  const getBaseVariableValueShape = (
    varInfo: VariableInfo | undefined
  ): CodingValueShape => {
    const multiple = varInfo?.multiple;
    const valuePositionLabels = varInfo?.valuePositionLabels;

    if (!varInfo?.type) {
      return { valueType: 'unknown', multiple, valuePositionLabels };
    }

    if (['integer', 'number'].includes(varInfo.type)) {
      return { valueType: 'numeric', multiple, valuePositionLabels };
    }

    if (varInfo.type === 'boolean') {
      return { valueType: 'boolean', multiple, valuePositionLabels };
    }

    if (varInfo.type === 'string') {
      return { valueType: 'string', multiple, valuePositionLabels };
    }

    return { valueType: 'other', multiple, valuePositionLabels };
  };

  const isKnownIncompatibleNumericRuleType = (
    valueType: CodingValueType
  ): boolean => (
    valueType !== 'unknown' &&
    !['numeric', 'boolean', 'string'].includes(valueType)
  );

  const isKnownIncompatibleBooleanRuleType = (
    valueType: CodingValueType
  ): boolean => (
    valueType !== 'unknown' &&
    !['numeric', 'boolean', 'string'].includes(valueType)
  );

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
  const codingById = new Map<string, VariableCodingData>();
  const codingsByAlias = new Map<string, VariableCodingData[]>();
  variableCodings.forEach(vc => {
    codingIdCounts.set(vc.id, (codingIdCounts.get(vc.id) ?? 0) + 1);
    codingIds.add(vc.id);
    codingById.set(vc.id, vc);
    if (vc.alias) {
      codingAliasCounts.set(
        vc.alias,
        (codingAliasCounts.get(vc.alias) ?? 0) + 1
      );
      codingsByAlias.set(vc.alias, [
        ...(codingsByAlias.get(vc.alias) ?? []),
        vc
      ]);
    }
  });

  const getSourceValueShape = (
    sourceId: string | undefined,
    visitedCodingIds: Set<string>
  ): CodingValueShape => {
    if (!sourceId) {
      return { valueType: 'unknown' };
    }

    const sourceCoding = codingById.get(sourceId);
    if (sourceCoding) {
      return getCodingValueShape(sourceCoding, visitedCodingIds);
    }

    return getBaseVariableValueShape(baseVarById.get(sourceId));
  };

  const getCodingValueShape = (
    coding: VariableCodingData,
    visitedCodingIds: Set<string> = new Set<string>()
  ): CodingValueShape => {
    if (visitedCodingIds.has(coding.id)) {
      return { valueType: 'unknown' };
    }

    const nextVisitedCodingIds = new Set(visitedCodingIds);
    nextVisitedCodingIds.add(coding.id);

    switch (coding.sourceType) {
      case 'BASE':
        return getBaseVariableValueShape(baseVarById.get(coding.id));
      case 'COPY_VALUE':
        return getSourceValueShape(coding.deriveSources?.[0], nextVisitedCodingIds);
      case 'CONCAT_CODE':
        return { valueType: 'string', multiple: false };
      case 'SUM_CODE':
      case 'SUM_SCORE':
      case 'SOLVER':
        return { valueType: 'numeric', multiple: false };
      case 'UNIQUE_VALUES':
        return { valueType: 'boolean', multiple: false };
      case 'BASE_NO_VALUE':
        return { valueType: 'other', multiple: false };
      case 'MANUAL':
      default:
        return { valueType: 'unknown' };
    }
  };

  const isDerivedVariable = (vc: VariableCodingData): boolean => (
    vc.sourceType !== 'BASE' && vc.sourceType !== 'BASE_NO_VALUE'
  );

  const isDerivedShadowingItsBaseSource = (
    vc: VariableCodingData
  ): boolean => {
    if (!vc.alias || vc.alias === vc.id || !isDerivedVariable(vc)) {
      return false;
    }

    const shadowedCoding = codingById.get(vc.alias);
    return Boolean(
      shadowedCoding &&
      shadowedCoding.sourceType === 'BASE' &&
      (vc.deriveSources ?? []).includes(shadowedCoding.id)
    );
  };

  const isAllowedAliasShadowingGroup = (alias: string): boolean => {
    const codingsWithAlias = codingsByAlias.get(alias) ?? [];
    const shadowedCoding = codingById.get(alias);
    if (!shadowedCoding || shadowedCoding.sourceType !== 'BASE') {
      return false;
    }

    const shadowingCodings = codingsWithAlias.filter(
      vc => vc.id !== shadowedCoding.id
    );
    return (
      shadowingCodings.length === 1 &&
      isDerivedShadowingItsBaseSource(shadowingCodings[0])
    );
  };

  variableCodings.forEach(vc => {
    if ((codingIdCounts.get(vc.id) ?? 0) > 1) {
      pushInvalidSourceProblem(vc.alias || vc.id, vc.label || '');
    }
    if (
      vc.alias &&
      (codingAliasCounts.get(vc.alias) ?? 0) > 1 &&
      !isAllowedAliasShadowingGroup(vc.alias)
    ) {
      pushInvalidSourceProblem(vc.alias || vc.id, vc.label || '');
    }
    if (
      vc.alias &&
      codingIds.has(vc.alias) &&
      vc.alias !== vc.id &&
      !isDerivedShadowingItsBaseSource(vc)
    ) {
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
    const varInfo = c.sourceType === 'BASE' ? baseVarById.get(c.id) : undefined;
    const codingValueShape = getCodingValueShape(c);

    if (c.sourceType === 'BASE') {
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
      const noValueVarInfo = baseVarById.get(c.id);
      if (noValueVarInfo && noValueVarInfo.type !== 'no-value') {
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
            pushRulesetValueArrayPosInvalid(
              c.alias || c.id,
              c.label || '',
              getCodeRef(code)
            );
          }

          if (typeof valueArrayPos === 'number' && valueArrayPos < 0) {
            pushRulesetValueArrayPosInvalid(
              c.alias || c.id,
              c.label || '',
              getCodeRef(code)
            );
          }

          if (
            typeof valueArrayPos !== 'undefined' &&
            codingValueShape.multiple === false
          ) {
            pushRulesetValueArrayPosInvalid(
              c.alias || c.id,
              c.label || '',
              getCodeRef(code)
            );
          }

          if (
            typeof valueArrayPos === 'number' &&
            codingValueShape.multiple === true &&
            (codingValueShape.valuePositionLabels?.length ?? 0) > 0 &&
            valueArrayPos >= (codingValueShape.valuePositionLabels?.length ?? 0)
          ) {
            pushRulesetValueArrayPosInvalid(
              c.alias || c.id,
              c.label || '',
              getCodeRef(code)
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
                getCodeRef(code)
              );
              return;
            }

            const params = r.parameters ?? [];

            if (
              typeof r.fragment !== 'undefined' &&
              (!c.fragmenting || r.fragment < -1 || !Number.isInteger(r.fragment))
            ) {
              pushRuleParameterInvalid(
                c.alias || c.id,
                c.label || '',
                getCodeRef(code)
              );
            }

            if (
              numericRuleMethods.includes(r.method) &&
              isKnownIncompatibleNumericRuleType(codingValueShape.valueType)
            ) {
              pushRuleParameterInvalid(
                c.alias || c.id,
                c.label || '',
                getCodeRef(code)
              );
            }

            if (
              booleanRuleMethods.includes(r.method) &&
              isKnownIncompatibleBooleanRuleType(codingValueShape.valueType)
            ) {
              pushRuleParameterInvalid(
                c.alias || c.id,
                c.label || '',
                getCodeRef(code)
              );
            }

            if (r.method === 'MATCH_REGEX') {
              const patterns = params.flatMap(p => p.split(/\r?\n/));
              patterns.forEach(p => {
                try {
                  // eslint-disable-next-line no-new
                  new RegExp(p);
                } catch (e) {
                  pushRuleRegexInvalid(
                    c.alias || c.id,
                    c.label || '',
                    getCodeRef(code)
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
                pushRuleParameterInvalid(
                  c.alias || c.id,
                  c.label || '',
                  getCodeRef(code)
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
                pushRuleNumericRangeInvalid(
                  c.alias || c.id,
                  c.label || '',
                  getCodeRef(code)
                );
              } else {
                const llNum = Number.parseFloat(ll);
                const ulNum = Number.parseFloat(ul);
                if (llNum > ulNum) {
                  pushRuleNumericRangeInvalid(
                    c.alias || c.id,
                    c.label || '',
                    getCodeRef(code)
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
