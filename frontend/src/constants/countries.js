// Shared country list. Codes resolved to English display names via Intl.DisplayNames,
// with a graceful fallback to the raw code when the API is unavailable.
export const COUNTRY_CODES = 'AF AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BR BN BG BF BI KH CM CA CV KY CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NP NL NZ NI NE NG NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW SA SN RS SG SK SI SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TG TO TT TN TR TM UG UA AE GB US UY UZ VU VE VN YE ZM ZW'.split(' ');

export const COUNTRY_OPTIONS = (() => {
  let names;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { names = null; }
  return COUNTRY_CODES
    .map((c) => ({ code: c, name: names ? (names.of(c) || c) : c }))
    .sort((a, b) => a.name.localeCompare(b.name));
})();

// Plain list of country names (used by selects that key on name).
export const COUNTRIES = COUNTRY_OPTIONS.map((c) => c.name);
