import { VNCondition, VNEffect, VNVariable } from '../types';

/**
 * StateEvaluator - Evaluates conditions and applies effects on variable state
 */
export class StateEvaluator {
  /**
   * Evaluate a single condition against current variable state
   */
  static evaluateCondition(
    condition: VNCondition,
    variables: VNVariable[]
  ): boolean {
    const variable = variables.find(v => v.id === condition.variableId);
    if (!variable) return false; // Or true? Decide on policy - default false means condition not met

    const currentValue = variable.currentValue;
    const targetValue = condition.value;

    switch (condition.operator) {
      case '==':
        return currentValue == targetValue;
      case '!=':
        return currentValue != targetValue;
      case '>':
        return Number(currentValue) > Number(targetValue);
      case '<':
        return Number(currentValue) < Number(targetValue);
      case '>=':
        return Number(currentValue) >= Number(targetValue);
      case '<=':
        return Number(currentValue) <= Number(targetValue);
      default:
        return true;
    }
  }

  /**
   * Evaluate multiple conditions (AND logic - all must be true)
   */
  static evaluateConditions(
    conditions: VNCondition[],
    variables: VNVariable[]
  ): boolean {
    return conditions.every(cond => this.evaluateCondition(cond, variables));
  }

  /**
   * Apply a single effect to variables (returns new array)
   */
  static applyEffect(
    effect: VNEffect,
    variables: VNVariable[]
  ): VNVariable[] {
    const newVars = variables.map(v => ({ ...v }));
    const variable = newVars.find(v => v.id === effect.variableId);

    if (!variable) return newVars;

    switch (effect.operation) {
      case 'set':
        variable.currentValue = effect.value;
        break;
      case 'add':
        variable.currentValue = Number(variable.currentValue) + Number(effect.value);
        break;
      case 'subtract':
        variable.currentValue = Number(variable.currentValue) - Number(effect.value);
        break;
      case 'toggle':
        variable.currentValue = !variable.currentValue;
        break;
    }

    return newVars;
  }

  /**
   * Apply multiple effects in sequence
   */
  static applyEffects(
    effects: VNEffect[],
    variables: VNVariable[]
  ): VNVariable[] {
    let newVars = this.cloneVariables(variables);
    effects.forEach(eff => {
      newVars = this.applyEffect(eff, newVars);
    });
    return newVars;
  }

  /**
   * Deep clone variables (for snapshot creation)
   */
  static cloneVariables(variables: VNVariable[]): VNVariable[] {
    return variables.map(v => ({
      ...v,
      currentValue: v.currentValue
    }));
  }
}
