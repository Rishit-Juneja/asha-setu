"""Hindi number words 1-99 (Devanagari + common romanizations) and "X sau Y".

Hindi numbers are irregular (71 = ikhattar, not "sattar ek"), so this is a table.
Used for BP and age, the numbers an ASHA speaks most and that matter most.
"""

import re

_TABLE = """
1 ek एक|2 do दो|3 teen तीन|4 char chaar चार|5 paanch panch पांच पाँच|6 chhe chhah che छह छः छे
7 saat सात|8 aath आठ|9 nau नौ|10 das दस|11 gyarah gyaarah ग्यारह|12 barah baarah बारह
13 terah तेरह|14 chaudah चौदह|15 pandrah पंद्रह पन्द्रह|16 solah सोलह|17 satrah सत्रह|18 atharah athaarah अठारह
19 unnis unnees उन्नीस|20 bees bis बीस|21 ikkis ikkees इक्कीस|22 bais baees baais बाईस|23 teis teees तेईस
24 chaubis chaubees चौबीस|25 pachchis pachchees pachees pachis पच्चीस|26 chhabbis chhabbees chabbis छब्बीस
27 sattais sattaees सत्ताईस|28 atthais atthaees athais अट्ठाईस अठाईस|29 untis untees उनतीस|30 tees तीस
31 iktis ikattees इकतीस|32 battis battees बत्तीस|33 taintis taintees तैंतीस|34 chautis chauntees चौंतीस
35 paintis paintees पैंतीस|36 chhattis chhattees छत्तीस|37 saintis saintees सैंतीस|38 adtis adtees अड़तीस
39 untalis untaalees उनतालीस|40 chalis chaalis chaalees चालीस|41 iktalis इकतालीस|42 bayalis बयालीस
43 taintalis तैंतालीस|44 chavalis चवालीस|45 paintalis पैंतालीस|46 chhiyalis छियालीस|47 saintalis सैंतालीस
48 adtalis अड़तालीस|49 unchas उनचास|50 pachas pachaas पचास|51 ikyavan इक्यावन|52 bavan baavan बावन
53 tirpan तिरपन|54 chauvan चौवन|55 pachpan पचपन|56 chhappan छप्पन|57 sattavan सत्तावन|58 atthavan अट्ठावन
59 unsath उनसठ|60 saath sath साठ|61 iksath इकसठ|62 basath baasath बासठ|63 tirsath तिरसठ|64 chausath चौंसठ
65 painsath पैंसठ|66 chhiyasath छियासठ|67 sadsath सड़सठ|68 adsath अड़सठ|69 unhattar उनहत्तर|70 sattar सत्तर
71 ikhattar इकहत्तर|72 bahattar बहत्तर|73 tihattar तिहत्तर|74 chauhattar चौहत्तर|75 pachhattar पचहत्तर
76 chhihattar छिहत्तर|77 sathattar satattar सतहत्तर|78 athhattar athattar अठहत्तर|79 unasi उन्यासी|80 assi अस्सी
81 ikyasi इक्यासी|82 bayasi बयासी|83 tirasi तिरासी|84 chaurasi चौरासी|85 pachasi पचासी|86 chhiyasi छियासी
87 sattasi सत्तासी|88 athasi athaasi अठासी|89 navasi नवासी|90 nabbe नब्बे|91 ikyanve इक्यानवे|92 banve baanve बानवे
93 tiranve तिरानवे|94 chauranve चौरानवे|95 pachanve पचानवे|96 chhiyanve छियानवे|97 sattanve सत्तानवे
98 atthanve अट्ठानवे|99 ninyanve निन्यानवे
"""

WORDS: dict[str, int] = {}
for _entry in _TABLE.replace("\n", "|").split("|"):
    if _entry.strip():
        _value, *_words = _entry.split()
        WORDS.update({w: int(_value) for w in _words})

HUNDRED = r"(?:sau|सौ)"
_WORD = "|".join(sorted(map(re.escape, WORDS), key=len, reverse=True))
# "ek sau sattar" / "sau das" / "nabbe" / "एक सौ दस"
NUMBER = rf"(?:(?:(?:{_WORD})\s+)?{HUNDRED}(?:\s+(?:{_WORD}))?|(?:{_WORD}))"
_NUMBER_RE = re.compile(rf"^(?:(?P<h>{_WORD})\s+)?(?P<sau>{HUNDRED})?\s*(?P<rest>{_WORD})?$")


def parse(phrase: str) -> int | None:
    match = _NUMBER_RE.match(phrase.strip().lower())
    if not match or not (match["sau"] or match["rest"]):
        return None
    if match["sau"]:
        hundreds = WORDS[match["h"]] if match["h"] else 1
        return hundreds * 100 + (WORDS[match["rest"]] if match["rest"] else 0)
    if match["h"]:
        return None
    return WORDS[match["rest"]]


BP_RE = re.compile(
    rf"(?<![\wऀ-ॿ])({NUMBER})\s+(?:bata|baata|by|बटा|बाई)\s*({NUMBER})(?![\wऀ-ॿ])",
    re.IGNORECASE,
)


def normalize_bp(text: str) -> str:
    """'ek sau sattar bata ek sau das' -> '170/110' so the digit BP regex can read it."""

    def replace(match: re.Match) -> str:
        high, low = parse(match.group(1)), parse(match.group(2))
        return f"{high}/{low}" if high and low else match.group(0)

    return BP_RE.sub(replace, text)


if __name__ == "__main__":
    assert parse("ek sau sattar") == 170 and parse("एक सौ दस") == 110
    assert parse("sau das") == 110 and parse("nabbe") == 90 and parse("सौ") == 100
    assert normalize_bp("BP ek sau sattar bata ek sau das hai") == "BP 170/110 hai"
    assert normalize_bp("बीपी एक सौ चालीस बटा नब्बे है") == "बीपी 140/90 है"
    print("ok", len(WORDS), "words")
