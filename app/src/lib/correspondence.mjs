/** The people exchanging a letter with Lenz, excluding people on his own side.
 * @param {import('./edition').Letter} letter
 * @param {string} focalPerson
 */
export function correspondentRefs(letter, focalPerson = '1') {
  const senders = new Set(
    letter.events.filter((event) => event.type === 'sent')
      .flatMap((event) => event.persons.map((person) => person.ref)),
  );
  const recipients = new Set(
    letter.events.filter((event) => event.type === 'received')
      .flatMap((event) => event.persons.map((person) => person.ref)),
  );
  return [...new Set([
    ...(senders.has(focalPerson) ? recipients : []),
    ...(recipients.has(focalPerson) ? senders : []),
  ])].filter((ref) => ref !== focalPerson);
}

/** Preserve the catalogue's date order, including its ordering of tied/undated letters.
 * @param {import('./edition').Letter[]} letters
 * @param {import('./edition').Letter} current
 */
export function correspondenceNavigation(letters, current) {
  const exchanges = letters.map((letter) => ({
    id: letter.letter,
    refs: correspondentRefs(letter),
  }));
  return correspondentRefs(current).map((ref) => {
    const sequence = exchanges.filter((letter) => letter.refs.includes(ref));
    const index = sequence.findIndex((letter) => letter.id === current.letter);
    return {
      ref,
      previous: index > 0 ? sequence[index - 1].id : null,
      next: index >= 0 ? sequence[index + 1]?.id ?? null : null,
    };
  });
}

/** @param {{ previous: string | null, next: string | null }} option */
export function hasOtherLetters(option) {
  return Boolean(option.previous || option.next);
}

/** Select an available exchange, or return undefined when there is nothing to navigate.
 * @template {{ ref: string, previous: string | null, next: string | null }} T
 * @param {T[]} options
 * @param {string | null} requested
 * @returns {T | undefined}
 */
export function selectCorrespondence(options, requested = null) {
  return options.find((option) => option.ref === requested && hasOtherLetters(option))
    || options.find(hasOtherLetters);
}
