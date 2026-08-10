/**
 * Parsers for the target-account spreadsheet, whose cells pack several values
 * into one field:
 *
 *   "RCM Leader / Target Persona"  → one or more "Name: Role" entries
 *   "LinkedIn / Target"            → per-person block of profile URL, emails,
 *                                    phones and a city/state/ZIP line
 *
 * Each person becomes its own lead row, so these helpers split the cells and
 * match contact blocks back to the right person (by name, else by position).
 */

export interface ParsedPersona {
  name: string;
  title: string;
}

export interface ParsedContact {
  emails?: string;
  phone?: string;
  linkedinUrl?: string;
  mailingAddress?: string;
}

/** Job-title words used to find the name/role boundary when there's no separator. */
const ROLE_WORDS =
  /\b(vice\s+president|president|chief|officer|director|manager|owner|administrator|head\s+of|executive|principal|partner|supervisor|controller|founder|vp|svp|avp|evp|ceo|cfo|coo|cro|cio|cmo)\b/i;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+\w/g;
/** At least 10 characters of digits/punctuation, so ZIP codes don't match. */
const PHONE = /\+?\(?\d[\d()\t .-]{8,}\d/g;
const LINKEDIN = /https?:\/\/(?:www\.)?linkedin\.com\/[^\s,]+/gi;

/** Lines that hold a URL or an email are never phone numbers or addresses. */
function plainLines(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('@') && !/https?:\/\/|linkedin\.com/i.test(line));
}

/** Splits a cell into per-person blocks on blank lines. */
export function splitBlocks(cell?: string | null): string[] {
  if (!cell) return [];
  const blocks = cell
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  // A single block holding several role-bearing lines means one person per line.
  if (blocks.length === 1) {
    const lines = blocks[0].split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.filter((l) => ROLE_WORDS.test(l)).length > 1) return lines;
  }
  return blocks;
}

/** "Brenton Oswandel: Vice President, Revenue Cycle" → { name, title } */
export function parsePersona(entry: string): ParsedPersona | null {
  const text = entry.replace(/\s*\r?\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // A bare URL is a contact detail that landed in the wrong column, not a person.
  if (!text || /^https?:\/\//i.test(text)) return null;

  const clean = (name: string) => name.replace(/[,:;·\-–—\s]+$/, '').trim();

  // 1. Explicit separator.
  const separated = text.match(/^(.{2,60}?)\s*[:·|]\s*(.+)$/) ?? text.match(/^(.{2,60}?)\s+[–—]\s+(.+)$/);
  if (separated) return { name: clean(separated[1]), title: separated[2].trim() };

  // 2. First job-title word starts the role ("Steve Scharmann Vice President of...").
  const role = ROLE_WORDS.exec(text);
  if (role && role.index > 0) {
    return { name: clean(text.slice(0, role.index)), title: text.slice(role.index).trim() };
  }

  // 3. Comma, then give up and treat the whole cell as a name.
  const comma = text.indexOf(',');
  if (comma > 1) return { name: clean(text.slice(0, comma)), title: text.slice(comma + 1).trim() };
  return { name: text, title: '' };
}

export function parsePersonas(cell?: string | null): ParsedPersona[] {
  return splitBlocks(cell)
    .map(parsePersona)
    .filter((p): p is ParsedPersona => p !== null && p.name !== '');
}

/** Pulls emails, phones, a LinkedIn URL and a mailing address out of one block. */
export function parseContact(block?: string | null): ParsedContact {
  if (!block) return {};
  const emails = block.match(EMAIL) ?? [];
  const linkedin = block.match(LINKEDIN) ?? [];
  const lines = plainLines(block);
  const phones = lines.flatMap((line) => line.match(PHONE) ?? []);

  const address = lines
    .filter((l) => l.includes(',') && !/^\+?\(?\d[\d()\t .-]{8,}\d$/.test(l))
    // Prefer a line that ends in a country or state-like token.
    .sort((a, b) => Number(/\b(United States|USA|Canada|[A-Z]{2})\s*$/.test(b)) - Number(/\b(United States|USA|Canada|[A-Z]{2})\s*$/.test(a)))[0];

  const contact: ParsedContact = {};
  if (emails.length) contact.emails = emails.join(', ');
  if (phones.length) contact.phone = phones.map((p) => p.trim()).join(', ');
  if (linkedin.length) contact.linkedinUrl = linkedin[0];
  if (address) contact.mailingAddress = address;
  return contact;
}

/**
 * Matches each persona to a contact block: by leading name when the block is
 * labelled ("Brenton Oswandel:"), otherwise by position. A single block is
 * shared by everyone, since the sheet often lists shared switchboard details.
 */
export function contactForPersona(
  persona: ParsedPersona,
  index: number,
  blocks: string[],
): ParsedContact {
  if (blocks.length === 0) return {};
  if (blocks.length === 1) return parseContact(blocks[0]);

  const surname = persona.name.split(/\s+/).filter(Boolean).pop()?.toLowerCase();
  const byName = surname
    ? blocks.find((b) => b.split(/\r?\n/)[0]?.toLowerCase().includes(surname))
    : undefined;
  return parseContact(byName ?? blocks[index] ?? blocks[0]);
}
