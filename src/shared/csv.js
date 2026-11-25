// The first rows of a CSV file's text, for a preview. The whole file is not
// read: a labs table is tens of megabytes, and a preview needs twenty rows.

/**
 * Read a CSV text's header and its first rows.
 * @param {string} text The file's text, as R's `write.csv` writes it: comma separated, fields that need it in double quotes, a quote inside a field doubled.
 * @param {number} [limit] How many rows to read after the header.
 * @returns {{header: string[], rows: string[][]}} The column names and the rows, every value as text.
 */
export function firstRows(text, limit = 20) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  const source = String(text ?? '');
  for (let at = 0; at < source.length && records.length <= limit; at += 1) {
    const char = source[at];
    if (quoted) {
      if (char === '"') {
        if (source[at + 1] === '"') {
          field += '"';
          at += 1;
        } else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[at + 1] === '\n') at += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  // A last line with no line end is a record too.
  if (records.length <= limit && (field !== '' || record.length)) {
    record.push(field);
    records.push(record);
  }
  const [header = [], ...rows] = records;
  return { header, rows: rows.slice(0, limit) };
}
