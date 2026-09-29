import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correspondentRefs, correspondenceNavigation, hasOtherLetters, selectCorrespondence } from '../src/lib/correspondence.mjs';

const letter = (id, senders, recipients) => ({
  letter: id,
  events: [
    { type: 'sent', persons: senders.map((ref) => ({ ref })) },
    { type: 'received', persons: recipients.map((ref) => ({ ref })) },
  ],
});

test('correspondents are opposite Lenz, in either direction, excluding co-authors and duplicates', () => {
  assert.deepEqual(correspondentRefs(letter('1', ['1', '7'], ['3', '6', '3'])), ['3', '6']);
  assert.deepEqual(correspondentRefs(letter('2', ['9', '11'], ['1', '7'])), ['9', '11']);
  assert.deepEqual(correspondentRefs(letter('3', ['7'], ['3'])), []);
  assert.deepEqual(correspondentRefs(letter('4', ['1'], [])), []);
  assert.deepEqual(correspondentRefs(letter('5', ['1'], ['1'])), []);
});

test('navigation follows catalogue order across outgoing and incoming letters, skipping unrelated exchanges', () => {
  const letters = [
    letter('50', ['1'], ['2']),
    letter('30', ['1'], ['3']),
    letter('10', ['2'], ['1']),
    letter('40', ['2'], ['3']),
    letter('20', ['1', '2'], ['3']),
    letter('60', ['1'], ['2']),
  ];
  assert.deepEqual(correspondenceNavigation(letters, letters[2]), [
    { ref: '2', previous: '50', next: '60' },
  ]);
  assert.deepEqual(correspondenceNavigation(letters, letters[0]), [
    { ref: '2', previous: null, next: '10' },
  ]);
  assert.deepEqual(correspondenceNavigation(letters, letters[5]), [
    { ref: '2', previous: '10', next: null },
  ]);
});

test('a shared letter has independent neighbours for each correspondence and no self-links', () => {
  const letters = [
    letter('1', ['1'], ['2']),
    letter('2', ['1'], ['3']),
    letter('3', ['2', '3', '3', '4'], ['1']),
    letter('4', ['1'], ['3']),
    letter('5', ['2'], ['1']),
  ];
  assert.deepEqual(correspondenceNavigation(letters, letters[2]), [
    { ref: '2', previous: '1', next: '5' },
    { ref: '3', previous: '2', next: '4' },
    { ref: '4', previous: null, next: null },
  ]);
  assert.deepEqual(correspondenceNavigation(letters, letter('6', ['7'], ['8'])), []);
});

test('navigation is omitted when a single correspondent has no other letters', () => {
  const current = letter('1', ['1'], ['2']);
  const options = correspondenceNavigation([current, letter('2', ['1'], ['3'])], current);
  assert.equal(options.length, 1);
  assert.equal(hasOtherLetters(options[0]), false);
  assert.equal(selectCorrespondence(options), undefined);
  assert.equal(selectCorrespondence(options, '2'), undefined);
});

test('navigation is omitted when every correspondent of a shared letter has no other letters', () => {
  const current = letter('1', ['1'], ['2', '3']);
  const options = correspondenceNavigation([current, letter('2', ['1'], ['4'])], current);
  assert.equal(options.length, 2);
  assert.equal(options.some(hasOtherLetters), false);
  assert.equal(selectCorrespondence(options), undefined);
  assert.equal(selectCorrespondence(options, '3'), undefined);
  assert.equal(selectCorrespondence([]), undefined);
});

test('unavailable correspondents remain in the menu but are skipped by default and URL selection', () => {
  const letters = [
    letter('1', ['1'], ['3']),
    letter('2', ['2', '3', '4'], ['1']),
    letter('3', ['1'], ['4']),
  ];
  const options = correspondenceNavigation(letters, letters[1]);
  assert.deepEqual(options.map((option) => [option.ref, hasOtherLetters(option)]), [
    ['2', false], ['3', true], ['4', true],
  ]);
  assert.equal(selectCorrespondence(options)?.ref, '3');
  assert.equal(selectCorrespondence(options, '2')?.ref, '3');
  assert.equal(selectCorrespondence(options, 'unknown')?.ref, '3');
  assert.equal(selectCorrespondence(options, '4')?.ref, '4');
});
