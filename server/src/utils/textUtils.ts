import { Marker } from '../types';

/**
 * Common and extended HTML named entities mapping to their decoded characters.
 */
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  dagger: '†',
  Dagger: '‡',
  bull: '•',
  hellip: '…',
  permil: '‰',
  prime: '′',
  Prime: '″',
  lsaquo: '‹',
  rsaquo: '›',
  oline: '‾',
  euro: '€',
  trade: '™',
  copy: '©',
  reg: '®',
  sect: '§',
  deg: '°',
  plusmn: '±',
  sup1: '¹',
  sup2: '²',
  sup3: '³',
  acute: '´',
  micro: 'µ',
  para: '¶',
  middot: '·',
  cedil: '¸',
  ordm: 'º',
  ordf: 'ª',
  laquo: '«',
  raquo: '»',
  frac14: '¼',
  frac12: '½',
  frac34: '¾',
  iquest: '¿',
  iexcl: '¡',
  cent: '¢',
  pound: '£',
  curren: '¤',
  yen: '¥',
  brvbar: '¦',
  uml: '¨',
  not: '¬',
  shy: '',
  macr: '¯',
  times: '×',
  divide: '÷',
  Agrave: 'À',
  Aacute: 'Á',
  Acirc: 'Â',
  Atilde: 'Ã',
  Auml: 'Ä',
  Aring: 'Å',
  AElig: 'Æ',
  Ccedil: 'Ç',
  Egrave: 'È',
  Eacute: 'É',
  Ecirc: 'Ê',
  Euml: 'Ë',
  Igrave: 'Ì',
  Iacute: 'Í',
  Icirc: 'Î',
  Iuml: 'Ï',
  ETH: 'Ð',
  Ntilde: 'Ñ',
  Ograve: 'Ò',
  Oacute: 'Ó',
  Ocirc: 'Ô',
  Otilde: 'Õ',
  Ouml: 'Ö',
  Oslash: 'Ø',
  Ugrave: 'Ù',
  Uacute: 'Ú',
  Ucirc: 'Û',
  Uuml: 'Ü',
  Yacute: 'Ý',
  THORN: 'Þ',
  szlig: 'ß',
  agrave: 'à',
  aacute: 'á',
  acirc: 'â',
  atilde: 'ã',
  auml: 'ä',
  aring: 'å',
  aelig: 'æ',
  ccedil: 'ç',
  egrave: 'è',
  eacute: 'é',
  ecirc: 'ê',
  euml: 'ë',
  igrave: 'ì',
  iacute: 'í',
  icirc: 'î',
  iuml: 'ï',
  eth: 'ð',
  ntilde: 'ñ',
  ograve: 'ò',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  ouml: 'ö',
  oslash: 'ø',
  ugrave: 'ù',
  uacute: 'ú',
  ucirc: 'û',
  uuml: 'ü',
  yacute: 'ý',
  thorn: 'þ',
  yuml: 'ÿ',
  OElig: 'Œ',
  oelig: 'œ',
  Scaron: 'Š',
  scaron: 'š',
  Yuml: 'Ÿ',
  fnof: 'ƒ',
  circ: 'ˆ',
  tilde: '˜',
  larr: '←',
  uarr: '↑',
  rarr: '→',
  darr: '↓',
  harr: '↔',
  minus: '−',
  le: '≤',
  ge: '≥',
  ne: '≠',
  equiv: '≡',
  infin: '∞',
  asymp: '≈',
  sim: '∼',
};

/**
 * Decodes HTML entities (decimal, hexadecimal, named entities) and literal unicode escape sequences.
 * Handles nested/double-encoded entities through iterative passes.
 */
export function decodeHtmlEntities(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  let str = String(input);
  if (!str) return '';

  // Max 5 iterations to resolve nested/double-encoded entities (e.g., &amp;#8211;)
  for (let i = 0; i < 5; i++) {
    const prev = str;

    // 1. Decode numeric hex entities: &#x2013; or &#X2013;
    str = str.replace(/&#[xX]([0-9a-fA-F]+);?/g, (match, hex) => {
      try {
        const code = parseInt(hex, 16);
        if (code >= 0 && code <= 0x10ffff) {
          return String.fromCodePoint(code);
        }
      } catch {
        // Keep match on failure
      }
      return match;
    });

    // 2. Decode numeric decimal entities: &#8211; or &#038;
    str = str.replace(/&#([0-9]+);?/g, (match, dec) => {
      try {
        const code = parseInt(dec, 10);
        if (code >= 0 && code <= 0x10ffff) {
          return String.fromCodePoint(code);
        }
      } catch {
        // Keep match on failure
      }
      return match;
    });

    // 3. Decode literal unicode escape sequences: \u0026 or \u{2013}
    str = str.replace(/\\u([0-9a-fA-F]{4})/gi, (match, hex) => {
      try {
        const code = parseInt(hex, 16);
        return String.fromCharCode(code);
      } catch {
        return match;
      }
    });
    str = str.replace(/\\u\{([0-9a-fA-F]+)\}/gi, (match, hex) => {
      try {
        const code = parseInt(hex, 16);
        if (code >= 0 && code <= 0x10ffff) {
          return String.fromCodePoint(code);
        }
      } catch {
        // Keep match on failure
      }
      return match;
    });

    // 4. Decode named HTML entities: &amp;, &ndash;, etc.
    str = str.replace(/&([a-zA-Z]+);/g, (match, name) => {
      return Object.prototype.hasOwnProperty.call(NAMED_HTML_ENTITIES, name)
        ? NAMED_HTML_ENTITIES[name]
        : match;
    });

    if (str === prev) break;
  }

  return str.trim();
}

/**
 * Sanitizes a single Marker object by decoding all text fields.
 */
export function cleanMarker(marker: Marker): Marker {
  return {
    ...marker,
    title: decodeHtmlEntities(marker.title),
    category: marker.category ? decodeHtmlEntities(marker.category) : marker.category,
    country: marker.country ? decodeHtmlEntities(marker.country) : marker.country,
    tags: Array.isArray(marker.tags) ? marker.tags.map(t => decodeHtmlEntities(t)) : marker.tags,
  };
}

/**
 * Sanitizes an array of Marker objects.
 */
export function cleanMarkerList(markers: Marker[]): Marker[] {
  if (!Array.isArray(markers)) return [];
  return markers.map(cleanMarker);
}
