// Pure logic for the receptionist's address question:
//   - no saved address  -> ask for the address
//   - one saved address -> "Is this for 12 Main St in Phoenix, or a different address?"
//   - several           -> ask by whatever tells them apart best (city, then ZIP, then street)
//   - caller answered   -> narrow down with their words ("the Phoenix one", "85004", "rental")

export type ChoiceAddress = {
  id: string;
  label: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
};

export const ADDRESS_CHOICE_STATUS = {
  NO_ADDRESSES: 'NO_ADDRESSES',
  ONE_MATCH: 'ONE_MATCH',
  NEEDS_CLARIFICATION: 'NEEDS_CLARIFICATION',
  NO_MATCH: 'NO_MATCH',
} as const;
export type AddressChoiceStatus =
  (typeof ADDRESS_CHOICE_STATUS)[keyof typeof ADDRESS_CHOICE_STATUS];

export type AskBy = 'city' | 'zip' | 'street' | 'label';

export type AddressChoice = {
  status: AddressChoiceStatus;
  // Set only for ONE_MATCH: the address the booking should use once the caller confirms.
  addressId: string | null;
  askBy: AskBy | null;
  options: { addressId: string; spoken: string }[];
  // A suggested sentence for the receptionist; the agent may reword it.
  prompt: string;
};

// On a tie the earlier field is easier for a caller to answer.
const ASK_BY_ORDER: readonly AskBy[] = ['city', 'zip', 'street', 'label'];

// Words callers put around the useful part: "the one in Phoenix", "my rental place".
const FILLER_WORDS = new Set([
  'the',
  'one',
  'in',
  'at',
  'on',
  'my',
  'our',
  'place',
  'house',
  'address',
  'zip',
  'code',
  'street',
  'st',
]);

export function buildAddressChoice(
  addresses: ChoiceAddress[],
  callerAnswer?: string,
): AddressChoice {
  if (addresses.length === 0) {
    return {
      status: ADDRESS_CHOICE_STATUS.NO_ADDRESSES,
      addressId: null,
      askBy: null,
      options: [],
      prompt: 'What is the address where you need the service, including the ZIP code?',
    };
  }
  const answer = callerAnswer?.trim();
  if (!answer) return buildQuestion(addresses);

  const matches = addresses.filter((address) => isMatch(address, answer));
  if (matches.length > 0) return buildQuestion(matches);
  const question = buildQuestion(addresses);
  return {
    ...question,
    status: ADDRESS_CHOICE_STATUS.NO_MATCH,
    addressId: null,
    // Quotes stripped: the caller's words go inside quotes in the agent's sentence.
    prompt: `I don't see an address matching "${answer.replace(/["“”]/g, '')}". ${question.prompt}`,
  };
}

function buildQuestion(addresses: ChoiceAddress[]): AddressChoice {
  const [only] = addresses;
  if (only && addresses.length === 1) {
    return {
      status: ADDRESS_CHOICE_STATUS.ONE_MATCH,
      addressId: only.id,
      askBy: null,
      options: [{ addressId: only.id, spoken: speakFull(only) }],
      prompt: `Is this for ${speakFull(only)}, or a different address?`,
    };
  }
  const askBy = pickAskBy(addresses);
  const options = addresses.map((address) => ({
    addressId: address.id,
    spoken: speakField(address, askBy),
  }));
  const spokenList = joinWithOr([...new Set(options.map((option) => option.spoken))]);
  return {
    status: ADDRESS_CHOICE_STATUS.NEEDS_CLARIFICATION,
    addressId: null,
    askBy,
    options,
    prompt: `I see ${String(addresses.length)} addresses on file: ${spokenList}. Which one is this for, or is it a new address?`,
  };
}

/** The field with the most different values, so one answer narrows the most. */
function pickAskBy(addresses: ChoiceAddress[]): AskBy {
  let best: AskBy = 'street';
  let bestDistinctCount = 0;
  for (const field of ASK_BY_ORDER) {
    const distinctCount = new Set(addresses.map((address) => normalize(speakField(address, field))))
      .size;
    if (distinctCount > bestDistinctCount) {
      best = field;
      bestDistinctCount = distinctCount;
    }
  }
  return best;
}

function speakField(address: ChoiceAddress, field: AskBy): string {
  if (field === 'city') return address.city;
  if (field === 'zip') return `ZIP ${address.zip}`;
  if (field === 'label') return address.label ?? speakFull(address);
  return speakFull(address);
}

function speakFull(address: ChoiceAddress): string {
  return `${address.street} in ${address.city}`;
}

function isMatch(address: ChoiceAddress, answer: string): boolean {
  const haystack = normalize(
    [address.label ?? '', address.street, address.city, address.state, address.zip].join(' '),
  );
  const words = normalize(answer)
    .split(' ')
    .filter((word) => word.length > 1 && !FILLER_WORDS.has(word));
  return words.length > 0 && words.every((word) => haystack.includes(word));
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function joinWithOr(values: string[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} or ${values[values.length - 1] ?? ''}`;
}
