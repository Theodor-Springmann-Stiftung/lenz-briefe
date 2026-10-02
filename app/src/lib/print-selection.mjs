// SPDX-License-Identifier: AGPL-3.0
// Copyright (c) 2026 Theodor Springmann Stiftung.

/** Describe the catalogue's OR within each filter and AND between filters. */
export function selectionDescription(people, places) {
  const clauses = [];
  const group = (names) => names.length > 1 ? `(${names.join(' ODER ')})` : names[0];
  if (people.length) clauses.push(`Korrespondenz mit ${group(people)}`);
  if (places.length) clauses.push(`Ortsbezug ${group(places)}`);
  return clauses.join(' UND ');
}
