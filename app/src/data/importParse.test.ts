import { describe, it, expect } from 'vitest';
import { parsePersona, parsePersonas, parseContact, contactForPersona, splitBlocks } from './importParse';

// Verbatim shapes from the target-account spreadsheet.
const HCA_PERSONAS = `Brenton Oswandel: Vice President, Revenue Cycle Transformation

Lynn Giddens: Vice President of Revenue Cycle`;

const HCA_CONTACTS = `Brenton Oswandel:
https://www.linkedin.com/in/brentonoswandel
brenton.oswandel@parallon.com
brenton.oswandel@gmail.com
(615) 344-9551
(904) 651-3152
Nashville, Tennessee, 37203, United States

Lynn Giddens-Branscum:
https://www.linkedin.com/in/lynn-giddens-branscum-8a61414
(940) 627-5921
(817) 938-8803
Haslet, Texas, 76052, United States`;

describe('parsePersona', () => {
  it('splits on a colon', () => {
    expect(parsePersona('Brenton Oswandel: Vice President, Revenue Cycle Transformation')).toEqual({
      name: 'Brenton Oswandel',
      title: 'Vice President, Revenue Cycle Transformation',
    });
  });

  it('splits at the job title when there is no separator', () => {
    expect(parsePersona('Steve Scharmann Vice President of Revenue Cycle')).toEqual({
      name: 'Steve Scharmann',
      title: 'Vice President of Revenue Cycle',
    });
    expect(parsePersona('James Logsdon Chief Revenue Officer')).toEqual({
      name: 'James Logsdon',
      title: 'Chief Revenue Officer',
    });
  });

  it('drops the comma between a name and its role', () => {
    expect(parsePersona('Sarah Cole, Vice President of National Net Revenue Management')).toEqual({
      name: 'Sarah Cole',
      title: 'Vice President of National Net Revenue Management',
    });
  });

  it('handles a middot separator', () => {
    expect(parsePersona('Carlos Vega · Practice Owner')).toEqual({ name: 'Carlos Vega', title: 'Practice Owner' });
  });

  it('keeps a bare name with no role', () => {
    expect(parsePersona('Dana Whitfield')).toEqual({ name: 'Dana Whitfield', title: '' });
  });

  it('ignores a URL that landed in the persona column', () => {
    expect(parsePersona('https://www.linkedin.com/in/steve-scharmann')).toBeNull();
  });
});

describe('parsePersonas', () => {
  it('returns one entry per person in a multi-person cell', () => {
    expect(parsePersonas(HCA_PERSONAS)).toEqual([
      { name: 'Brenton Oswandel', title: 'Vice President, Revenue Cycle Transformation' },
      { name: 'Lynn Giddens', title: 'Vice President of Revenue Cycle' },
    ]);
  });

  it('splits people separated by single newlines', () => {
    expect(parsePersonas('Ann Diaz Director of Billing\nBob Kent VP Patient Access')).toHaveLength(2);
  });

  it('returns nothing for an empty cell', () => {
    expect(parsePersonas('')).toEqual([]);
    expect(parsePersonas(null)).toEqual([]);
  });
});

describe('parseContact', () => {
  it('extracts emails, phones, LinkedIn URL and mailing address', () => {
    const blocks = splitBlocks(HCA_CONTACTS);
    expect(blocks).toHaveLength(2);
    expect(parseContact(blocks[0])).toEqual({
      emails: 'brenton.oswandel@parallon.com, brenton.oswandel@gmail.com',
      phone: '(615) 344-9551, (904) 651-3152',
      linkedinUrl: 'https://www.linkedin.com/in/brentonoswandel',
      mailingAddress: 'Nashville, Tennessee, 37203, United States',
    });
  });

  it('omits fields that are absent', () => {
    expect(parseContact('https://www.linkedin.com/in/x')).toEqual({
      linkedinUrl: 'https://www.linkedin.com/in/x',
    });
  });
});

describe('contactForPersona', () => {
  const personas = parsePersonas(HCA_PERSONAS);
  const blocks = splitBlocks(HCA_CONTACTS);

  it('matches each person to their own block by surname, not position', () => {
    // "Lynn Giddens" must find the "Lynn Giddens-Branscum:" block.
    expect(contactForPersona(personas[1], 1, blocks).phone).toBe('(940) 627-5921, (817) 938-8803');
    expect(contactForPersona(personas[0], 0, blocks).emails).toContain('brenton.oswandel@parallon.com');
  });

  it('shares a single block across everyone', () => {
    const shared = splitBlocks('steve.scharmann@commonspirit.org\n(312) 741-7000');
    expect(contactForPersona(personas[1], 1, shared).emails).toBe('steve.scharmann@commonspirit.org');
  });

  it('returns nothing when there are no contact details', () => {
    expect(contactForPersona(personas[0], 0, [])).toEqual({});
  });
});
