import assert from "node:assert/strict";
import test from "node:test";
import { filterByField, toggleFieldFilter } from "./wenchang-filter.ts";

const items = [
  { name: "甲", author: "A", grade: "一" },
  { name: "乙", author: "A", grade: "二" },
  { name: "丙", author: "B", grade: "一" }
];

test("filters Wenchang rows by the selected field", () => {
  assert.deepEqual(filterByField(items, { field: "author", value: "A" }), items.slice(0, 2));
  assert.deepEqual(filterByField(items, { field: "grade", value: "一" }), [items[0], items[2]]);
  assert.equal(filterByField(items, null), items);
});

test("toggles the same Wenchang filter and replaces another one", () => {
  const selected = toggleFieldFilter(null, "author", "A");
  assert.deepEqual(selected, { field: "author", value: "A" });
  assert.equal(toggleFieldFilter(selected, "author", "A"), null);
  assert.deepEqual(toggleFieldFilter(selected, "grade", "一"), { field: "grade", value: "一" });
});
