/** Keep newly selected options in place until the menu closes. */
export function createFilterOptionOrder(options) {
  let promoted = new Set();
  return (selected, promote = false) => {
    promoted = new Set(promote ? selected : [...promoted].filter((option) => selected.has(option)));
    return {
      promoted,
      ordered: [...options.filter((option) => promoted.has(option)), ...options.filter((option) => !promoted.has(option))],
    };
  };
}
