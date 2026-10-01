export type SegmentOperator = "equals"|"not_equals"|"contains"|"does_not_contain"|"greater_than"|"less_than"|"before"|"after"|"is_empty"|"is_not_empty"|"in"|"not_in";
export type SegmentRule = { field: string; operator: SegmentOperator; value?: string };
export type SegmentGroup = { operator: "and"|"or"; children: SegmentRule[] };

function comparable(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
export function evaluateRule(contact: Record<string, unknown>, rule: SegmentRule) {
  const actual = comparable(contact[rule.field]); const expected = comparable(rule.value);
  switch(rule.operator){
    case "equals": return actual.toLowerCase()===expected.toLowerCase();
    case "not_equals": return actual.toLowerCase()!==expected.toLowerCase();
    case "contains": return actual.toLowerCase().includes(expected.toLowerCase());
    case "does_not_contain": return !actual.toLowerCase().includes(expected.toLowerCase());
    case "greater_than": return Number(actual)>Number(expected);
    case "less_than": return Number(actual)<Number(expected);
    case "before": return !!actual && new Date(actual)<new Date(expected);
    case "after": return !!actual && new Date(actual)>new Date(expected);
    case "is_empty": return !actual;
    case "is_not_empty": return !!actual;
    case "in": return expected.split(",").map(v=>v.trim().toLowerCase()).includes(actual.toLowerCase());
    case "not_in": return !expected.split(",").map(v=>v.trim().toLowerCase()).includes(actual.toLowerCase());
    default: return false;
  }
}
export function evaluateGroup(contact: Record<string, unknown>, group: SegmentGroup){
  if(!group.children.length) return true;
  const outcomes=group.children.map(rule=>evaluateRule(contact,rule));
  return group.operator==="and"?outcomes.every(Boolean):outcomes.some(Boolean);
}
