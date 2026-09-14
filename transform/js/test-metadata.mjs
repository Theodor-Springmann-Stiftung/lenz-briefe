import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { resolveRefs } from "./src/export.mjs";

function resolve(content, tag = "person", map = new Map()) {
  const node = new DOMParser().parseFromString(
    `<${tag} xmlns="https://lenz-archiv.de" ref="1" cert="low" erschlossen="true">${content}</${tag}>`,
    "application/xml"
  ).documentElement;
  return resolveRefs([node], map)[0];
}

test("plain annotations preserve existing fields for persons and locations", () => {
  const definition = { name: "Name", index: "1" };
  for (const tag of ["person", "location"]) {
    for (const text of ["vmtl.", "wahrscheinlich", "oder", ""]) {
      assert.deepEqual(resolve(text, tag, new Map([["1", definition]])), {
        ref: "1", cert: "low", erschlossen: "true", label: "Name", resolved: definition,
        annotationText: text,
        annotationParts: text ? [{ type: "text", text }] : []
      });
    }
  }
});

test("mixed content preserves links, nesting and whitespace even for unresolved references", () => {
  const result = resolve(
    ' vmtl. <!--not annotation--><![CDATA[oder ]]>' +
    '<wwwlink address="https://example.org/?a=1&amp;b=2">A &amp; B' +
    '<wwwlink address="https://example.org/inner"> innen</wwwlink>' +
    '</wwwlink> danach\n'
  );
  assert.equal(result.label, null);
  assert.equal(result.resolved, null);
  assert.equal(result.annotationText, "vmtl. oder A & B innen danach");
  assert.deepEqual(result.annotationParts, [
    { type: "text", text: " vmtl. oder " },
    { type: "wwwlink", address: "https://example.org/?a=1&b=2", children: [
      { type: "text", text: "A & B" },
      { type: "wwwlink", address: "https://example.org/inner", children: [
        { type: "text", text: " innen" }
      ] }
    ] },
    { type: "text", text: " danach\n" }
  ]);
});
