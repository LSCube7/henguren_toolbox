export type FieldFilter<T> = {
  field: keyof T;
  value: string;
};

export function toggleFieldFilter<T>(current: FieldFilter<T> | null, field: keyof T, value: string): FieldFilter<T> | null {
  return current?.field === field && current.value === value ? null : { field, value };
}

export function filterByField<T>(items: T[], filter: FieldFilter<T> | null): T[] {
  if (!filter) return items;
  return items.filter((item) => String(item[filter.field] ?? "") === filter.value);
}
